# Real-time Job Sync — Postgres LISTEN/NOTIFY → SSE bridge

**Date:** 2026-06-25
**PR:** (this one)
**Scope:** browser ↔ worker job-state synchronization for audio generation
**Status:** flag-gated, default OFF — opt-in for browser side via `NEXT_PUBLIC_REALTIME_JOB_SYNC=true`

---

## Why this exists

This week we shipped two patches for the *symptom* of UI/worker drift:

- **#404** — page-aware progress estimate to stop the bar parking at 95 % when worker hadn't pushed the next update yet
- **#415** — `isRetryImminent` polling check to stop the UI declaring "failed" during the brief window before the worker re-queues

Both fixed visible bugs. Neither fixed the *structural* cause: the UI polls `/api/jobs/[id]` every 2 s, the worker writes async, and real state drifts visible to the user for up to ~2 s every time something changes. Peter caught the partial-completion bug from this exact gap; future bugs in this class are inevitable as long as polling is our only channel.

The fix is a real real-time channel: Postgres `LISTEN/NOTIFY` (built in, no new infra) bridged to the browser via SSE (the same pattern we already use for orchestrator routes in PRs #394, #402, #403).

## Goals

| # | Goal | How we measure |
|---|---|---|
| G1 | Progress updates visible in < 100 ms instead of < 2000 ms | Wall-clock from `updateJobProgress` write to client `onmessage` fire |
| G2 | Zero new infrastructure | No Redis pubsub, no WebSocket server, no realtime-DB SaaS |
| G3 | Backwards-compatible — existing polling continues to work | Flag default OFF; client falls back to polling on any SSE error |
| G4 | Connection count drops by ~30× per active user | 1 long-lived SSE vs ~30 polls/min |
| G5 | DB load drops — no `findUnique` every 2 s per active user | Postgres connection metric pre/post |

## Non-goals

- Real-time notifications, presence, or activity feed (separate feature; this lays foundation but doesn't ship that)
- Replacing the existing job-status polling entirely (kept as fallback)
- Changing the job-status JSON shape — same fields stream over SSE as the polling endpoint returns
- Solving the multi-instance worker-fan-out problem (would need a real broker; deferred until we have multiple worker processes per env)

---

## Architecture

```
┌──────────────────────────────┐                                 ┌──────────────────┐
│   Worker (existing)          │                                 │   Browser        │
│                              │                                 │                  │
│ updateJobProgress(jobId)     │                                 │ EventSource(/api/│
│   │                          │                                 │   jobs/[id]/    │
│   ├─► prisma.job.update(...) │                                 │   stream)       │
│   │                          │                                 │     │            │
│   └─► notifyJobUpdate(id)    │                                 │     ▼            │
│           │                  │                                 │ useJobStream     │
│           ▼                  │                                 │  (hook)         │
│       NOTIFY job:{id}        │                                 │     │            │
└───────────┬──────────────────┘                                 └──┬──────────────┘
            │                                                       │
            ▼                                                       │
  ┌─────────────────────────────────────────────┐                   │
  │              Postgres pub/sub                │                  │
  │   (built-in; channel name "job:{id}")        │                  │
  └─────────────────────┬───────────────────────┘                   │
                        │                                            │
                        ▼                                            │
  ┌────────────────────────────────────────┐                         │
  │   Web service                          │                         │
  │                                        │                         │
  │   /api/jobs/[id]/stream                │                         │
  │     │                                  │                         │
  │     ├─ withAuth + ownership check      │                         │
  │     ├─ open dedicated pg.Client (NOT   │                         │
  │     │   Prisma — needs LISTEN holdable)│                         │
  │     ├─ pg.query("LISTEN job:{id}")     │                         │
  │     ├─ send initial state from DB      │                         │
  │     ├─ pg.on('notification', ev →      │                         │
  │     │     fetch + push to SSE)         │                         │
  │     ├─ 25s heartbeat                   │                         │
  │     └─ on client disconnect:           │                         │
  │         UNLISTEN, release pg.Client    │                         │
  └────────────────────────────────────────┘                         │
                                                                     │
                                                       ──────────────┘
```

### Why LISTEN/NOTIFY + SSE specifically

| Alternative | Why we didn't choose it |
|---|---|
| WebSockets | Requires a separate WS server, doesn't fit Render's per-request lambda-ish model on web. SSE is one-way (server → client) which is all we need here. |
| Polling with conditional GET / ETag | Reduces traffic but still polls; doesn't fix the visibility-latency problem |
| Redis pubsub | Requires Upstash/Render Redis to maintain pub/sub channels; we have Redis only for rate-limit + queue, not currently configured for pubsub. Adds infra dependency. |
| Realtime SaaS (Pusher, Ably, Supabase Realtime) | New external dependency, new auth surface, recurring cost. Solves a problem we don't have (multi-region replication). |
| Postgres LISTEN/NOTIFY (chosen) | Already in our stack. No new infra. Worker already touches DB on every progress update. Free piggyback. |

### Why SSE specifically (vs returning JSON over a long-poll endpoint)

We've used SSE four times this month (#394, #402, #403, #404 wrapper). The infrastructure for it — heartbeats every 25 s to survive Render's 300 s inter-service proxy timeout, `flushHeaders()` lock-point handling, `Content-Type: text/event-stream` — is well-trodden. EventSource is a built-in browser API with auto-reconnect.

---

## Components

### 1. `notifyJobUpdate(jobId)` helper (worker side)

Tiny helper called immediately after every successful `prisma.job.update({ progress })`:

```ts
// packages/web/lib/realtime/notify-job-update.ts
import { prisma } from '@/lib/db';

export async function notifyJobUpdate(jobId: string): Promise<void> {
  try {
    // pg_notify with the jobId as payload. Channel format is `job:{id}`
    // so SSE handlers can LISTEN on exactly the channel they care about.
    await prisma.$executeRawUnsafe(`NOTIFY "job:${jobId}"`);
  } catch (err) {
    // Non-fatal: NOTIFY is a perf optimization. If it fails, the client's
    // existing polling fallback still catches the update in ≤2 s.
    // No throw — never let a notification failure cascade into a real
    // pipeline failure.
  }
}
```

**Design rules:**

- **Light NOTIFY payload** — we send just the channel name, not the full job state. SSE handler refetches from DB. Avoids:
  - 8 KB pg_notify size limit (we'd hit it on big segment arrays)
  - Race conditions between concurrent writes (always get DB-of-truth)
  - Coupling worker code to SSE wire format
- **Fail silent** — polling is the safety net. NOTIFY failure ≠ pipeline failure.

### 2. `getListenClient()` helper (web side)

Web's SSE endpoint can't reuse Prisma's connection pool — Prisma serializes queries through pooled connections and won't hold a `LISTEN` indefinitely. We need a dedicated `pg.Client` per active SSE connection.

```ts
// packages/web/lib/realtime/job-listen-pool.ts
import { Client } from 'pg';

export async function openJobListenClient(jobId: string, onNotify: () => void) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`LISTEN "job:${jobId}"`);
  client.on('notification', () => onNotify());
  return {
    close: async () => {
      try { await client.query(`UNLISTEN "job:${jobId}"`); } catch {}
      try { await client.end(); } catch {}
    },
  };
}
```

**Connection budget:** Each SSE client holds 1 pg connection. Render Postgres default limit is ~20 connections; we share with Prisma. **Hard cap of 16 simultaneous SSE clients per web instance** is enforced in the endpoint to leave Prisma headroom. If we exceed cap, endpoint returns 503 and client falls back to polling.

### 3. `/api/jobs/[id]/stream` SSE endpoint

```
GET /api/jobs/[id]/stream
  → text/event-stream
    initial: full JobStatus from DB
    on NOTIFY: refetch + push delta
    every 25 s: heartbeat
    on disconnect: UNLISTEN + release
```

Auth: same `withAuth` + ownership check pattern as `/api/jobs/[id]/route.ts`. We reuse the exact same JSON shape returned by the polling endpoint so the client can swap channels without changing the consumer.

### 4. `useJobStream(jobId)` client hook

```ts
// packages/web/hooks/use-job-stream.ts
// EventSource consumer; mirrors the polling-based JobStatus shape.
// Falls back to polling if SSE fails to open or drops repeatedly.
```

**Behavior:**

- Open EventSource on mount; close on unmount
- Receive initial state immediately
- Each `data:` event = a JobStatus JSON; set state directly
- On `error`: count consecutive failures; after 3 in 30 s → permanently fall back to polling for this session
- Heartbeats (SSE comments) are ignored by EventSource — no app handling needed

### 5. Wire-in to `generate-button.tsx`

Gated on `NEXT_PUBLIC_REALTIME_JOB_SYNC=true` (env). When on:
- `useJobStream(jobId)` instead of the existing `setInterval(pollJobStatus, 2000)`
- Polling code stays in place as the auto-fallback path

When off (default): no behavior change.

### 6. Feature flag rollout

| Stage | Flag | Behavior |
|---|---|---|
| 0 — merge | OFF | No client opens SSE. Worker still emits NOTIFY (harmless, no listeners). Zero behavior change. |
| 1 — dev validation | `NEXT_PUBLIC_REALTIME_JOB_SYNC=true` on dev | Dev users open SSE; we observe Sentry + Render logs for connection counts, errors, fallback rate |
| 2 — prod canary | Same env on prod for staff IPs only (Cloudflare rule or feature-flag service) | Real-world validation under prod load |
| 3 — full rollout | Flag default ON in `next.config.js` env block | Polling remains for legacy clients (cached JS); SSE for new sessions |
| 4 — eventual cleanup | Remove polling path | Far future; ~2 release cycles after canary is stable |

We're shipping **stage 0** in this PR.

---

## Concurrency + connection management

### Connection budget arithmetic

| Source | Connections | Notes |
|---|---|---|
| Prisma pool | up to 8 | Per `lib/db.ts` constant |
| pg.Client per SSE | up to **16** | Hard cap enforced in endpoint |
| Misc (cron, migrations) | ~2 | Bursty |
| **Total ceiling** | **~26** | Just over Render Postgres default (20) — needs verification |

**Risk:** if 16 concurrent SSE clients + 8 Prisma + 2 misc = 26, we exceed the Postgres limit and Prisma queries start blocking. Mitigations:

- The 16 cap is conservative; can lower to 12 if we see contention
- Stage 1 (dev) validation will show real concurrent-connection numbers — we won't ship to prod until we've measured
- Future option: shared pg.Pool + LISTEN multiplexing on a single connection (more complex; deferred)

### What happens on errors

| Failure | Behavior |
|---|---|
| pg.Client connect fails | Endpoint returns 503; client falls back to polling |
| LISTEN query fails | Same — 503 + fallback |
| Notification handler throws | Logged + swallowed; SSE connection stays open |
| Client EventSource drops | Auto-reconnect (built-in); we count drops and switch to polling after 3 in 30 s |
| Worker NOTIFY fails | Silent — polling fallback still catches the update |
| Server crashes mid-stream | EventSource reconnects to a fresh pg.Client + LISTEN |

The cardinal rule: **polling is the safety net.** Anything that fails on the SSE path degrades to the existing polling-based UI. No regressions possible.

---

## Testing

### Unit
- `notifyJobUpdate` — calls `$executeRawUnsafe` with correct channel; swallows errors
- `getListenClient` (mocked pg) — registers LISTEN; cleanup calls UNLISTEN + end
- `useJobStream` — opens EventSource; falls back after 3 errors; cleans up on unmount

### Integration smoke (manual, dev only)
- Open a job in browser with flag on, watch live progress vs flag-off polling
- Verify update latency drops from ~2000 ms to < 100 ms
- Disconnect network mid-stream → verify reconnect, then fallback after repeated failures

### What we are NOT testing tonight
- Real Postgres LISTEN behavior (requires an integration test harness with a live DB). Manual dev validation covers this.
- Long-term connection-budget behavior under high concurrency (will surface in stage-1 dev validation telemetry)

---

## Open questions / explicit deferrals

| Question | Status |
|---|---|
| Should we share one pg.Client across all SSE clients (LISTEN multiplexing)? | Deferred. Worth it if we hit the 16 cap. |
| Should the SSE endpoint also accept long-poll fallback queries? | No — keep transports clean. Polling endpoint stays separate. |
| Should we add a job-completion-specific channel (`job-completed:{id}`)? | No — the same `job:{id}` channel covers all transitions. |
| What happens on worker process restart mid-job? | Existing polling fallback covers it. SSE will reconnect when worker emits next NOTIFY. |
| Multi-region deploy? | Not in scope. LISTEN/NOTIFY is per-DB instance; we have one DB per env. |

---

## Rollout schedule (proposed)

| Day | Action |
|---|---|
| 0 (this PR) | Merge with flag default OFF |
| 0–7 | Dev validation: `NEXT_PUBLIC_REALTIME_JOB_SYNC=true` in Doppler/dev. Observe logs, connection counts, error rate |
| 7 | If clean: enable for staff IPs on prod |
| 14 | If clean: flip flag default ON in `next.config.js` env block |
| 30+ | If still clean: remove the polling path |

---

## Concrete cost / size

| Aspect | Cost |
|---|---|
| New runtime dependency | `pg` (~150 KB minified; already a transitive dep via Prisma — pure code-side install) |
| New files | 4 source + 4 test = 8 files, ~600 LOC total |
| Schema change | None |
| Migration | None |
| Recurring infra cost | $0 (Postgres pub/sub is included) |
| Per-deploy build memory impact | Negligible (~5 MB) |

---

## What this unlocks

Once stable, the same LISTEN/NOTIFY + SSE bridge is the foundation for:

- Live in-app notifications (replaces the current 30 s polling in the notification bell)
- Live multi-user presence (who's viewing this project right now)
- Live audio-segment-ready streaming to the player (push-driven instead of polled)
- Operator-side "live job timeline" view for support

None of those ship in this PR. But the infrastructure exists once this lands.
