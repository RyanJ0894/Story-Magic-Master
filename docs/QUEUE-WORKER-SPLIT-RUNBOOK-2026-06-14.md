# Queue worker split runbook

**Status:** ready to execute, **NOT** yet executed.
**Risk:** medium — creates a new Render service, redeploys web + orchestrator, rebalances DB pool ceilings.
**Time window:** ideally Saturday morning, ~30 min hands-on + ~10 min watching.
**Rollback:** documented at the bottom, takes ~3 min.

This runbook documents the change in `render.yaml` (and the matching Doppler/Render dashboard updates) that converts the queue worker from "embedded in the Next.js process" to "its own Render Background Worker service." It also rebalances the per-service DB connection ceilings so we stay under Render Postgres basic-256mb's 22-connection cap.

## Why we're doing this

PR #273 (STORY-MAGIC-1G) added a defensive 5-second `Promise.race` timeout on `/api/jobs/[id]` so polling clients see a fast 503 instead of a 5-minute hang. That fixes the *symptom*. The actual mechanism is:

1. The web service runs an embedded queue worker. Both worker and HTTP handlers share the same Prisma client → same pool of 8 connections.
2. During generation, the worker dequeues and processes a job, holding 1–3 connections for the duration (which can be 10+ min for a 15-page script).
3. If a user generates while polling the job-status endpoint from another browser tab, the worker's long-lived connections can starve the polling endpoint's incoming requests.
4. Polling endpoints wait in the pool queue. They wait minutes. Sentry records "Stuck handler: 296681ms (5 min)" with `status: 200` — the query did eventually complete, just very late.

The architectural fix is to give the worker its own service with its own pool. That's what this runbook executes.

## What changes

| Surface | Before | After |
|---|---|---|
| Web service runs queue worker | yes (embedded via `instrumentation.ts`) | **no** (gated off by `WORKER_MODE=standalone`) |
| Standalone worker service exists | no | **yes** (`story-magic-worker`, runs `pnpm worker`) |
| Web `DATABASE_CONNECTION_LIMIT` | 8 (default) | **6** |
| Worker `DATABASE_CONNECTION_LIMIT` | n/a | **6** |
| Orch `DATABASE_CONNECTION_LIMIT` | 8 (default) | **6** |
| Total DB connections reserved | 16 / 22 cap | **18 / 22 cap** |
| Monthly cost | $0 (same services) | **+$7** (one new Render starter service) |

## How env / secrets work in this repo — the established conventions

Recapping what we've learned so the worker service gets set up the same way (see memory and the per-thread incidents from 2026-06-13):

- **Doppler `story-magic` / `prd` is the source of truth for secrets.** Edits to env values happen in Doppler, never in the Render dashboard, never directly on the running container. The native sync between Doppler and Render (live as of 2026-06-09) triggers automated redeploys within ~1–2 min when values change.
- **`render.yaml` declares the SHAPE of each service** — which env keys exist, whether they have static values or come from a secret (`sync: false`) or from a database reference (`fromDatabase: …`). It does NOT carry secret values.
- **`buildCommand`** still lives in `render.yaml` BUT every doppler-aware step in it wraps the actual work in `doppler run --` so the build has access to the same secrets the runtime does. This is how `bash scripts/install-whisper.sh` worked for the orchestrator (PR #270).
- **`startCommand`** also wraps in `doppler run --` so the runtime gets the Doppler-synced env.
- **H3's CI lint** (`scripts/check-env-source.js`) flags _new_ `envVars:` blocks and _new_ `buildCommand:` lines as drift signals. The worker block in this PR introduces an `envVars:` block — that's expected for a brand-new service; the lint comment-bypass mechanism (`// envSource: allow`) is documented in `docs/ENV-SOURCE-OF-TRUTH.md`.
- **Doppler→Render native sync handles the new service automatically** once Render creates `story-magic-worker` from `render.yaml` and connects it to the Doppler config. No extra wiring needed; just like the existing `srv-d5mmo2emcj7s73c6ffr0` / `…ffs0` services.
- **The non-secret values live in `render.yaml`** — `DATABASE_CONNECTION_LIMIT`, `WORKER_MODE`, `QUEUE_CONCURRENCY`, etc. These don't need to be in Doppler since they're not secrets.

After this runbook executes:
- The worker service will pull all `sync: false` values (Clerk, Sentry, Upstash, OpenAI, SERVICE_SECRET_KEY, ORCHESTRATOR_URL) from Doppler automatically via the native sync.
- We do NOT need to manually set those values in the Render dashboard.
- We do NOT need to manually duplicate them in Doppler — they're already in the `story-magic` / `prd` config from the web service's prior sync.

## Pre-flight (5 min, before executing)

- [ ] **Confirm Doppler→Render native sync is healthy.** Trigger a no-op sync:
  ```bash
  # Sanity: set a harmless variable, observe the deploy
  doppler secrets set DEPLOY_HEALTH_CHECK="$(date +%s)" --project story-magic --config prd
  # Watch both srv-d5mmo2emcj7s73c6ffr0 and srv-d5mmo2emcj7s73c6ffs0 — should each kick a deploy
  ```
- [ ] **Note the current commit on main + the latest "live" deploy on both services.** Used as the rollback target.
  ```bash
  git rev-parse --short origin/main
  curl -s -H "Authorization: Bearer $RENDER_KEY" "https://api.render.com/v1/services/srv-d5mmo2emcj7s73c6ffr0/deploys?limit=1" | jq -r '.[0].deploy.id, .[0].deploy.commit.id'
  curl -s -H "Authorization: Bearer $RENDER_KEY" "https://api.render.com/v1/services/srv-d5mmo2emcj7s73c6ffs0/deploys?limit=1" | jq -r '.[0].deploy.id, .[0].deploy.commit.id'
  ```
- [ ] **Check current queue state.** If a generation is mid-flight, wait for it to finish first.
  ```sql
  SELECT id, status, "currentStep", "createdAt", "updatedAt"
  FROM "Job"
  WHERE status IN ('pending', 'in_progress')
  ORDER BY "createdAt" DESC LIMIT 10;
  ```
- [ ] **Sentry baseline:** note the issue count for `kind:handler-stuck` and `provider:database` in the last 6 h. These will both drop to zero after the split.

## Execution (15 min)

### Step 1 — Merge the IaC PR

The PR that pairs with this runbook touches `render.yaml` only. After merging to main:

- Render auto-deploys `story-magic-web` (it has new env: `WORKER_MODE=standalone`, lower `DATABASE_CONNECTION_LIMIT`)
- Render auto-deploys `story-magic-orchestrator` (lower `DATABASE_CONNECTION_LIMIT`)
- Render **creates** `story-magic-worker` (new service from the uncommented block) — first deploy takes ~5–7 min

```bash
gh pr merge <PR> --admin --squash --delete-branch
```

### Step 2 — Watch all three services come live

```bash
# Poll-until-live (about 5–8 min total)
for svc in srv-d5mmo2emcj7s73c6ffr0 srv-d5mmo2emcj7s73c6ffs0 <NEW-WORKER-SVC-ID>; do
  while true; do
    s=$(curl -s -H "Authorization: Bearer $RENDER_KEY" "https://api.render.com/v1/services/$svc/deploys?limit=1" | jq -r '.[0].deploy.status')
    echo "$svc: $s"
    [ "$s" = "live" ] && break
    [ "$s" = "build_failed" ] && { echo "ABORT: build failed"; exit 2; }
    sleep 20
  done
done
```

The new worker service ID is visible in the Render dashboard after the first deploy creates it; capture it via:
```bash
curl -s -H "Authorization: Bearer $RENDER_KEY" "https://api.render.com/v1/services?name=story-magic-worker" | jq -r '.[0].service.id'
```

### Step 3 — Verify the embedded worker is OFF on the web service

```bash
# Should NOT see "Worker starting" log line on the new web deploy.
# Should see "[queue] WORKER_MODE=standalone — skipping embedded worker boot"
curl -s -H "Authorization: Bearer $RENDER_KEY" \
  "https://api.render.com/v1/logs?ownerId=tea-d4000h95pdvs738r19qg&resource=srv-d5mmo2emcj7s73c6ffs0&type=service&direction=backward&limit=200" \
  | jq -r '.logs[].message' \
  | grep -iE "worker|queue" | head -20
```

### Step 4 — Verify the standalone worker IS running

```bash
# Should see "Worker starting" with the new workerId
curl -s -H "Authorization: Bearer $RENDER_KEY" \
  "https://api.render.com/v1/logs?ownerId=tea-d4000h95pdvs738r19qg&resource=<NEW-WORKER-SVC-ID>&type=service&direction=backward&limit=200" \
  | jq -r '.logs[].message' \
  | head -20
```

Expected first lines (from `worker.ts`'s startup):
```
Worker starting { workerId: 'worker-<pid>-<ts>', pollIntervalMs: 5000, ... }
```

### Step 5 — End-to-end smoke

Generate a 3-page test script in the web app. Watch:

- **Browser network tab:** `/api/jobs/[id]` should respond in < 200 ms throughout (was 5+ min worst case before)
- **Worker logs:** dequeue + progress events as the job moves through steps
- **Web logs:** NO queue-related lines

### Step 6 — Mark the runbook executed

Update this doc at the bottom with the execution timestamp and the new worker service ID.

## Verification probes (run any time after)

- `/health` on web: unchanged
- `/health` on orch: unchanged
- New worker has no public HTTP endpoint by design; verify via Render dashboard or log query
- Sentry: `kind:handler-stuck` issues should stop accumulating within ~6 h

## Rollback (if something goes wrong)

The fastest path is dashboard-driven, not git-driven:

1. **Render dashboard → `story-magic-worker` → suspend** (stops the standalone worker)
2. **Render dashboard → `story-magic-web` → Environment** → set `WORKER_MODE` to anything except `standalone` (or delete the var)
3. **Manually deploy** the web service via Render dashboard
4. The embedded worker boots in `instrumentation.ts` again; load comes back, polling endpoints regain the long latency we're trying to fix

After confirming rollback works, revert the IaC PR via:
```bash
git revert <merge-commit>
git push origin main
```

(This will trigger another redeploy, returning to the pre-runbook state.)

---

## Limits we're stacking under

- Render Postgres **basic-256mb plan: 22 connections max**.
- After this change: web 6 + orch 6 + worker 6 = **18**. Headroom of 4 for migrations, health checks, ad-hoc psql.
- If we ever need more, the upgrade path is `basic-256mb → basic-1gb` ($+13/mo, 197 connections). That's a future PR.

## Why per-service connection limits matter

Without the rebalance, the default Prisma pool size is `num_physical_cpus * 2 + 1`. On Render starter instances (0.5 CPU) that resolves to 5–8. Without an explicit limit, three services could fight for >24 connections and hit the DB ceiling. The explicit `DATABASE_CONNECTION_LIMIT=6` on each service caps the math.

## Execution record

| Status | When | Who | Notes |
|---|---|---|---|
| Runbook written | 2026-06-14 (overnight) | Claude | Paired with IaC PR awaiting Chris's approval |
| Runbook executed | _pending_ | _pending_ | _new worker service id will be recorded here_ |
