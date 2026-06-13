# Story Magic — Operational Hardening Appraisal

**Date:** 2026-06-13
**Author:** Chris Therriault (synthesis from a 24h incident-driven session)
**Status:** Active sprint plan — items H1–H8 below

---

## Why this doc exists

A single ~24h session shipped 11 production hotfixes — Stripe redirect cache, voice catalog seed, OpenAI quota top-up, SW skip cross-origin audio, rate-limit per-user, Sentry coverage gaps, render.yaml tar `--overwrite`, banner-redis check, OpenAI failover chain, parenthetical strip, notes silent-fail, pdf-parse timeout, and ultimately the pdf-parse → unpdf migration. Every one of those was a real user-impacting bug that should have been caught upstream.

This isn't unusual for the system's surface area, but it isn't acceptable either. This doc names the structural causes and lays out a sprint plan to address them in order of leverage.

---

## What broke today, classified

| Class | Today's examples | Structural cause |
|---|---|---|
| **Self-inflicted from recent PRs** | PR #214 migration 0040 changed types → 42804 (#221); pipeline FK violations (#223); sw.js v4 over-matched R2 (#242); pdf-parse timeout (#248/#249) | Velocity outpacing post-merge regression checks |
| **Vendor / upstream rot** | pdf-parse unmaintained since 2018; Groq 20 RPM cap; OpenAI embeddings quota; Upstash dissolved; pdfjs-dist worker fragility | "Mature" libraries aren't, free tiers cap, services disappear |
| **Manual ops not automated** | Voice catalog never seeded in prod (#246); whisper.cpp never installed; e2e test user had 0 credits; Clerk prod test user didn't exist | "One-off in prod later" → "why isn't it working in prod" 3 weeks later |
| **Env / coordination drift** | render.yaml `buildCommand` never synced to Render service; REDIS_URL external vs internal; Clerk dev secret tried against prod; OpenAI key exhausted while Doppler said set | Three sources of truth (render.yaml, Doppler, service-level overrides) drifting independently |
| **Caching layers compounding** | Next router cache holding pre-upgrade tier (#247); voice catalog 5-min TTL; sw.js CACHE_NAME bump for #242; embedded queue worker starving HTTP requests | Five caches × three services = inconsistency is the default state |
| **Build vs runtime confusion** | `/usr/local/bin` read-only at runtime; `/var/data` only mounted at runtime; whisper.cpp install hit both | Render filesystem quirks don't surface until you try something new |
| **Race conditions** | job_logs FK violation (worker writes after project delete); server-action ID stale during deploy window | No graceful-shutdown / quiescence pattern |
| **Observability blind spots** | 499s from Cloudflare invisible to Sentry; rate-limit 429s invisible until #245; whisper degradation flooded logs but never reached Sentry | Logging ≠ monitoring |

---

## The structural why

Story Magic's surface area is **large for the team size**:

- **2 services** (web Next.js + Express orchestrator)
- **~11 vendor integrations** (Clerk, Stripe, Anthropic, OpenAI, ElevenLabs, Groq, Render Postgres, Render KV, R2/S3, Sentry, Checkly)
- **5 cache layers** (Next RSC, Service Worker, orchestrator in-memory, Redis rate-limit, browser HTTP)
- **2 storage paradigms** (relational + object) with FK cascades touching both
- **A real-time media pipeline** (audio, alignment, mixing) on top of all of that
- **Multi-tenant** (master + sub-account + enterprise + reader roles)
- **Per-environment Clerk + Stripe + Doppler + Render setups** that must stay in lockstep

Each new feature touches 3-5 of those. Each integration is a seam. Each cache is one more place inconsistency can hide. The bug rate is proportional to that surface — not to skill or care.

The architecture is sound. The **operational layer hasn't grown up with the integration count**.

---

## What we ARE doing well (don't reset these)

- Branch protection on `main` with codeowner approval + 3 CI checks
- Doppler→Render native sync is live (when used)
- Sentry is wired and ingesting
- 96 web test files / 1312 tests + 57 orchestrator files / 839 tests, all green on every PR
- The PR queue tonight (244–249) all landed via review or admin-merge with passing CI
- E2E smoke that exercises the real production stack with teardown (PR #240)
- TypeScript strict mode active across both packages
- Pull request templates and CI gates are working

---

## The sprint plan — 8 items, ordered by leverage

Each item has a **why** (what symptom it eliminates), **deliverable**, **acceptance criteria**, **estimate**, and **sequence**. Items are tagged H1–H8 (for "hardening 1..8"); use those tags in PR titles.

### Phase A — Observability + race elimination (2 days)

Each of these turns "user reports it" into "Sentry pages us" or "the bug can't happen."

---

#### **H1** — Sentry slow-path spans + handler duration breadcrumbs

**Why:** 499s and pdf-parse hangs were invisible until users reported them. Cloudflare killed the requests at 100s without anything reaching Sentry. We need handler-level timing on every request.

**Deliverable:**
- `packages/web/lib/api/timing.ts` — `withTiming(handler)` wrapper
- Wrap `withAuth` and `withProjectAuth` middleware so every API route automatically gets timing
- Emit Sentry breadcrumb on every request with `route`, `duration_ms`, `status`
- Emit `Sentry.captureMessage('Slow handler')` at level=warning when `duration_ms > 5000`
- Emit `level=error` when `duration_ms > 15000` (we're losing the request to Cloudflare)
- Orchestrator: same pattern, on Express route handlers — wrap via middleware

**Acceptance:**
- Run the e2e smoke; verify Sentry breadcrumbs for `/api/projects/upload`, `/api/generate`, `/api/jobs/[id]` appear with `duration_ms` tagged
- Manually trigger a 6s sleep handler in dev; confirm a `level=warning` Sentry message appears
- Zero perf regression: handler-overhead < 0.5ms

**Estimate:** 3 SP (~1 day)
**Sequence:** First — unblocks visibility for everything else

---

#### **H4** — Defensive prisma writes near cascade-delete boundaries

**Why:** `job_logs_job_id_fkey` violation today was a worker writing after the project (and its cascade-deleted jobs) was already gone. This is a *class* of bug — any `prisma.update` or `prisma.create` near a cascadable parent record can race.

**Deliverable:**
- `packages/web/lib/db/safe-update.ts` — `safeUpdate(model, args)` that returns `null` on P2025 instead of throwing
- `packages/web/lib/db/safe-create.ts` — same shape, swallows FK violations (P2003) with a warn log
- Audit every `prisma.update`, `prisma.create` site that references `job`, `jobLog`, `audioOutput`, `sceneRender`, `timeline`, `ttsStem`, `alignment` — replace with safe variants OR wrap in try/catch with the named Prisma error codes
- ESLint rule (or grep pre-commit) flagging un-guarded prisma writes against these tables

**Acceptance:**
- Reproduce the FK violation in a unit test (mock project delete mid-flight); confirm the safe write returns null + logs a structured warning
- Search shows no remaining un-guarded writes to the 7 tables above
- 1 ESLint violation on intentional misuse (test it)

**Estimate:** 4 SP (~1.5 days)
**Sequence:** Parallel with H1

---

#### **H8** — Prod manifest endpoint: "what's actually deployed right now"

**Why:** Multiple times today we asked "is prod = main + #X + #Y?" and needed three separate API calls (Render deploy state, Doppler config hash, git commit on web vs orch). Make it one URL.

**Deliverable:**
- `packages/web/app/api/admin/manifest/route.ts` — returns `{web: {commit, deployedAt, dopplerConfigHash, envPresence}, orchestrator: {commit, deployedAt, ...}, drift: {...}}`
- The orchestrator exposes `/internal/manifest` consumed by the web
- `commit` comes from `process.env.RENDER_GIT_COMMIT` or a build-time injection
- `envPresence` is just `{KEY_NAME: true|false}` — no values
- `drift` = `{webCommit !== orchCommit}` etc.
- Auth: `withAdminAuth` (admin-only)

**Acceptance:**
- Hit `/api/admin/manifest` in prod, get all 4 keys back, no secrets exposed
- Hit it again after a deploy; the new commit shows in <30s
- The `drift` field flips to `true` if you deploy web only

**Estimate:** 3 SP (~1 day)
**Sequence:** Independent — anyone can start

---

### Phase B — Self-healing + drift prevention (2 days)

These prevent the "deploy then run a one-off" failure mode from recurring.

---

#### **H2** — Boot-time idempotent seed framework

**Why:** PR #246 (voice catalog auto-seed) worked. Apply the same pattern everywhere a fresh env would otherwise need manual bootstrap.

**Deliverable:**
- `packages/orchestrator/src/lib/seed/index.ts` — `runBootSeeds()` calls all registered seeders in order, after server.listen, deferred 2s, with bounded concurrency
- Existing `seedVoiceCatalogIfEmpty` registers via the new framework
- New seeders:
  - `seedDefaultPlans` — ensure Stripe price IDs match the `plans` config in DB
  - `seedSystemConfig` — set `system_config` row defaults for any newly-introduced keys
- Each seeder is fail-soft (warn on error, never block boot)
- Each seeder logs structured `{seeder, action, rows}` on completion

**Acceptance:**
- Drop voice catalog table; orchestrator boots; catalog repopulates within 5s
- All seeders run on every boot; idempotent (running twice = no extra writes)

**Estimate:** 4 SP (~1.5 days)
**Sequence:** After H1 (so we have the timing signal on seeders too)

---

#### **H3** — Single source of truth for env — Doppler-only

**Why:** Today the whisper.cpp install was specified in render.yaml's `buildCommand` but never propagated to the Render service's actual `buildCommand` (Render doesn't auto-sync render.yaml after initial provision). Result: weeks of "the deploy is broken and we don't know why."

**Deliverable:**
- `docs/ENV-SOURCE-OF-TRUTH.md` — Doppler is THE source for env vars + buildCommand; render.yaml is a one-time bootstrap template, NOT operational config
- Strip all `envVars` blocks from render.yaml (leave only resource definitions: services, disks, plan, region)
- Add a CI lint script `scripts/check-env-source.js` that fails CI if render.yaml is modified to add an `envVars` block or change `buildCommand` (forces edits to go through Doppler / Render service settings)
- Slack-style runbook in `docs/RUNBOOK.md` for "how to change a build command in prod" (Render service settings, NOT render.yaml)

**Acceptance:**
- The CI lint rejects a test PR that adds an env var to render.yaml
- The doc clearly states the precedence and contains the exact Doppler dashboard URL for prod

**Estimate:** 2 SP (~half day)
**Sequence:** Independent

---

### Phase C — Eliminate recurring failure modes (2-3 days)

---

#### **H5** — Audit + replace unmaintained deps

**Why:** pdf-parse was the explicit casualty today, but the same risk lurks in any pre-2023 npm package. Find them before they hang.

**Deliverable:**
- `scripts/audit-stale-deps.js` — reads package.json, hits the npm registry for each dep, reports `{name, version, lastPublishedAt, daysSinceLastPublish}` sorted by staleness
- Output to `docs/DEPS-AUDIT-2026-06-13.md` with traffic-light coloring (red >2y, yellow >1y, green <1y)
- For each red entry, find the modern equivalent (notes column)
- Track replacements as a sprint backlog (with the pdf-parse → unpdf migration as the worked example)

**Acceptance:**
- Audit report identifies at least 3 red-light deps with concrete replacement candidates
- One additional red dep is migrated in a follow-up PR

**Estimate:** 3 SP (~1 day)
**Sequence:** Independent

---

#### **H6** — Real-user fixture corpus for parse-screenplay CI

**Why:** All our PDF tests mock pdf-parse with synthetic strings. Real screenwriting tool exports break in ways our test suite never sees. Chris's file is exactly the kind of thing we should be testing against.

**Deliverable:**
- `packages/web/tests/fixtures/screenplay/` directory
- At minimum: 1 Final Draft FDX, 1 Highland PDF, 1 Word .docx with title page, 1 Chris's "DIG - 3 Page Sample" (with permission), 1 scanned/OCR-needed PDF
- Integration test that runs `parseScreenplay` on each, asserts `pageCount > 0` and the text contains expected scene-heading markers
- README in the fixtures dir explaining how to add a fixture without leaking sensitive content (strip everything but structure + first 10 lines)
- Gitignore real fixtures, commit anonymized representative ones

**Acceptance:**
- CI runs the integration test on every PR touching `lib/upload/`
- A future PDF parsing library swap can prove it doesn't regress

**Estimate:** 2 SP (~half day) — most cost is asking Chris/Ryan for files

---

#### **H7** — Quiescent shutdown for orchestrator embedded worker

**Why:** Today's `job_logs_job_id_fkey` violation and the 502s during the OpenAI key rotation both root back to a worker that doesn't honor SIGTERM gracefully.

**Deliverable:**
- `packages/web/lib/queue/worker.ts` — register SIGTERM handler that:
  1. Stops accepting new jobs from the queue
  2. Waits up to 30s for in-flight jobs to finish
  3. Atomically marks any still-in-flight jobs as `status=interrupted, error=server_redeploying` so the next instance can resume them
- HTTP: drain in-flight requests with `server.close(callback)` before exit
- Test: spin up a worker, queue 3 jobs, send SIGTERM after the first starts; assert all 3 reach a terminal state in the DB

**Acceptance:**
- Reproduce the FK race in a test; confirm it's gone with the new shutdown path
- A real redeploy doesn't leave any "running" jobs that are actually dead

**Estimate:** 5 SP (~2 days) — touches both Express and Next.js processes
**Sequence:** After H4 (uses safe-update there)

---

## Execution order — week of 2026-06-13

| Day | Items | Estimate |
|---|---|---|
| Mon (today, partial) | Appraisal doc + scaffolding + H8 manifest endpoint (read-only, low risk) | 3 SP |
| Tue | H1 timing + H4 defensive writes (parallel) | 7 SP |
| Wed | H3 env SoT + H5 deps audit (parallel) | 5 SP |
| Thu | H2 boot-seed framework | 4 SP |
| Fri | H7 quiescent shutdown | 5 SP |
| Backlog | H6 fixture corpus (needs file permissions) | 2 SP |

**Total: ~26 SP over a 5-day sprint.** Comfortably fits if no fires intervene.

If fires intervene: H1 + H8 alone (a single day of focused work) cut the "users find it before us" rate by an estimated **60-70%** based on what got reported today.

---

## What this doc is NOT

- A roadmap for new features (separate doc)
- A tech debt backlog (see `docs/ROADMAP-2026-06-09-EOD.md` for that)
- An apology — the system is doing what its scope demands. We're investing in the operational layer to match.

---

## Single line summary

> Today's incidents weren't bad luck — they were structurally inevitable given the integration surface and lack of operational tooling. This sprint plan addresses each cause class with a specific deliverable. Items H1, H4, and H8 alone eliminate the majority of the user-visible fragility within 2 days of focused work.
