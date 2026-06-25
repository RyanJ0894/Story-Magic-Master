# Story Magic — Product Requirements (incremental update 2026-06-25)

**Date:** 2026-06-25
**Author:** Chris Therriault
**Status:** Incremental update on top of `docs/REQUIREMENTS-2026-06-14.md` (v3.6.0)
**Supersedes:** REQUIREMENTS-2026-06-14.md
**Target version:** v3.7.0 (sampling architecture + real-time job sync)

This file lists **only** the requirements that changed status or were added since 2026-06-14. For the OPS/voice/alignment baseline see REQUIREMENTS-2026-06-14.md; for the cost-opt arc see REQUIREMENTS-2026-06-09.md; for the full 24-section product baseline see REQUIREMENTS-2026-06-03.md.

> Legend: P0 = Must have | P1 = High value | P2 = Nice to have
> Status: COMPLETE | PARTIAL | NOT IMPL | DEFERRED | BLOCKED

---

## NEW SECTION 29 — Real-Time Job-Status Sync

The 2 s polling pattern at `/api/jobs/[id]` couldn't keep the UI and the worker in sync when a job advanced state between polls. PR #423 (open against main, merged into dev for soak) introduces a Postgres LISTEN/NOTIFY → Server-Sent Events bridge so the worker can push status changes to the browser the moment they happen.

Flag-gated, defaults OFF. The existing 2 s polling endpoint remains the authoritative fallback for any client whose SSE connection fails.

| Req ID | Requirement | Priority | Planned Implementation | Status | Notes |
|--------|-------------|----------|------------------------|--------|-------|
| REQ-RT-29.1 | Worker emits `NOTIFY "job:{id}"` after every job status / progress mutation; payload is channel-only (no row body) so it stays under Postgres's 8 KB NOTIFY limit | P1 | `packages/web/lib/realtime/notify-job-update.ts`; called from `lib/queue/service.ts::updateJobProgress` | PARTIAL | PR #423 open. Producer wired and fire-and-forget; the consumer side is what's pending. |
| REQ-RT-29.2 | Web service maintains a dedicated `pg.Client` pool separate from Prisma, capped at `MAX_SSE_LISTENERS=16` per instance; counter reserves the slot synchronously before `await client.connect()` (no TOCTOU); over-cap requests get HTTP 503 + Retry-After so the client falls back to polling | P0 | `packages/web/lib/realtime/job-listen-pool.ts` | PARTIAL | PR #423. TOCTOU regression fixed in commit `fd91ba3` after delta review found N concurrent attaches could bypass the cap. New unit test pins the synchronous-reservation contract. |
| REQ-RT-29.3 | `GET /api/jobs/[id]/stream` returns `text/event-stream`; requires auth + owner check (same shape as `/api/jobs/[id]`) before attaching the listener; emits initial state immediately, refetches on every NOTIFY, sends a `:heartbeat\n\n` every 25 s to keep Render's proxy + browser EventSource alive | P1 | `packages/web/app/api/jobs/[id]/stream/route.ts` | PARTIAL | PR #423. Cleanup-leak BLOCKER (controller-stash vs `this`-read mismatch in `cancel()`) fixed in `fd91ba3` — closure now shared between `start()` and `cancel()`. |
| REQ-RT-29.4 | `use-job-stream` hook (EventSource consumer) falls back to the 2 s polling path after 3 errors within a 30 s window; counter window-prunes correctly so transient blips don't permanently demote the user to polling | P1 | `packages/web/hooks/use-job-stream.ts` | PARTIAL | PR #423. |
| REQ-RT-29.5 | The SSE route is gated by a server-side feature flag so a direct hit to `/api/jobs/<own>/stream` cannot burn a listener slot when the feature is off | P1 | Server-side feature flag check at top of `route.ts` | NOT IMPL | Delta-review finding R-4 — open for Sprint A. Flag check currently lives only on the React call-site. |
| REQ-RT-29.6 | `_resetListenerCountForTesting` (test-only helper in the pool) is gated by `NODE_ENV === 'test'` so prod code paths can't mutate the counter | P2 | `packages/web/lib/realtime/job-listen-pool.ts` + optional ESLint `no-restricted-imports` rule | NOT IMPL | Delta-review finding R-3 — open for Sprint A. |

---

## NEW SECTION 30 — Build Pipeline Hygiene

A multi-PR OOM saga (#416 → #422) exhausted five config-only mitigations before discovering that the real fix was inlining `NODE_OPTIONS='--max-old-space-size=4096'` in `packages/web/package.json`'s build script — the env-var version was being stripped before reaching `next build`. The saga left tech debt; this section memorializes both the fix and the cleanup items.

| Req ID | Requirement | Priority | Planned Implementation | Status | Notes |
|--------|-------------|----------|------------------------|--------|-------|
| REQ-BUILD-30.1 | Web's `next build` runs under a 4 GB V8 heap via inline `NODE_OPTIONS=--max-old-space-size=4096` in `packages/web/package.json::scripts.build`; env-var form is unreliable through the Doppler/pnpm/worker chain | P0 | `packages/web/package.json` | COMPLETE | PR #422. Diagnostic: V8 GC trace `Mark-Compact NNN (XXXX) MB` — `(2065 MB)` = unfixed, `(4400 MB)` = fixed. See memory `feedback_next_build_oom_inline_node_options`. |
| REQ-BUILD-30.2 | `experimental.webpackBuildWorker: true` in `next.config.js` isolates webpack compilation to a worker process (~15–30% peak memory reduction reported upstream) | P2 | `packages/web/next.config.js:51` | COMPLETE | PR #420. **Flag for revert** once 30.1 holds across three clean prod builds — it's an experimental flag and we no longer strictly need it. |
| REQ-BUILD-30.3 | Build-time TypeScript check is skipped via `typescript.ignoreBuildErrors: true`; the safety net moved to a separate CI job (`pnpm typecheck` on both packages) | P1 | `packages/web/next.config.js:127` + `.github/workflows/ci.yml::lint-and-typecheck` | COMPLETE | PR #418. CI still typechecks; the gate just moved layers. |
| REQ-BUILD-30.4 | Server + client source maps are skipped (`serverSourceMaps: false`, `productionBrowserSourceMaps: false`); Sentry's webpack plugin handles symbolication independently via its own upload path | P1 | `packages/web/next.config.js` + `sentryConfig.hideSourceMaps` | COMPLETE | PR #419. **Verification owed:** spot-check a recent prod Sentry error to confirm stack traces are still useful. |
| REQ-BUILD-30.5 | `render.yaml` `plan:` declarations must match the live Render dashboard — silent drift here (the 2026-06-13 incident pattern) is prohibited | P1 | `render.yaml` web service `plan:` field | PARTIAL | PR #425 open: declares `plan: pro` but live dashboard is on standard after the live revert. Fix is a 1-line edit. |
| REQ-BUILD-30.6 | `productionBrowserSourceMaps` declared exactly once in `next.config.js` — duplicates from the saga removed | P2 | `packages/web/next.config.js:118` (delete) | PARTIAL | PR #425 open. Cosmetic cleanup. |

---

## Updated Sections (delta from 2026-06-14)

### Section 25 — Cost Optimization / Sampling Architecture (Phases A–E SHIPPED)

The Phases A–E sampling architecture roadmap was the headline arc since 2026-06-14. All five phases merged; each is **flag-gated and defaults to shadow / off** so the existing pipeline remains the canonical path until Ryan signs off on each phase's output quality.

| Req ID | Status change | Notes |
|--------|---------------|-------|
| REQ-SAMPLE-25.A (Phase A — deterministic CharacterIndex + IntroStitcher in shadow mode) | NOT IMPL → COMPLETE | PR #408. Default OFF; emits shadow telemetry via `dev-shadow-telemetry-summary.ts`. |
| REQ-SAMPLE-25.B (Phase B — `VoiceAssignmentAgent.assignFromSample`, flag-gated) | NOT IMPL → COMPLETE | PR #409. |
| REQ-SAMPLE-25.C (Phase C — extraction mode switch: `legacy` / `hybrid` / `deterministic`) | NOT IMPL → COMPLETE | PR #411. Hybrid mode tracking Jaccard distribution awaits Ryan-validated test scripts (RYAN-TASK-2). |
| REQ-SAMPLE-25.D (Phase D — adaptive chunks + cue pre-tagging + Pass 3 prompt trim) | NOT IMPL → COMPLETE | PR #413. Closes Peter's #407 / #412 env-tunable scene chunk sizing. |
| REQ-SAMPLE-25.E (Phase E — `ConsistencyVerifierAgent`, opt-in) | NOT IMPL → COMPLETE | PR #411. |
| REQ-SAMPLE-25.SCENE-CACHE (cross-project per-scene DirectorAgent cache) | NOT IMPL → COMPLETE | PR #405 — pre-existed the 2026-06-14 doc but is the dependency the sampling phases ride on; capturing here for completeness. |

### Section 5 — Listening Experience (SSE everywhere closes silent-drop class)

| Req ID | Status change | Notes |
|--------|---------------|-------|
| REQ-LISTEN-5.SSE (long routes converted to SSE so the 300s Render proxy timeout no longer kills 10+ page generations) | PARTIAL → COMPLETE | PRs #402 (/generate-scenes), #403 (/analyze, /preview, /stitch-segments), #404 (page-aware progress estimate so the bar stops parking at 95 %), #406 + #414 (undici headersTimeout bump + bypass on both packages). |
| REQ-LISTEN-5.PARTIAL (partial-completion threshold + UI retry tracking) | NOT IMPL → COMPLETE | PR #415. Closes Peter's two 2026-06-24 findings. |
| REQ-LISTEN-5.y (#207 listen UI sync drift) | NOT IMPL → PARTIAL | The class of bug is now structurally addressed by REQ-RT-29.* (LISTEN/NOTIFY). Pending #423 merge + flag-on dev observation window. |

### Section 12 — Infrastructure & Security

| Req ID | Status change | Notes |
|--------|---------------|-------|
| REQ-INFRA-12.26 (Queue worker split into own Render service) | NOT IMPL → COMPLETE | Worker is now standalone in render.yaml (`WORKER_MODE=standalone`, dedicated `story-magic-worker` service). Closes the connection-pool starvation pattern (STORY-MAGIC-1G). |
| REQ-INFRA-12.27 (NEW — DB pool ceiling per service) | — → COMPLETE | `DATABASE_CONNECTION_LIMIT=6` per service, 3 services = 18 of Render's 22 cap, leaves 4 for migrations + health checks. Bump when DB upgrades to basic-1gb. |
| REQ-INFRA-12.28 (NEW — perf: per-scene PCM intermediates + skip verification + multi-thread ffmpeg + skip ducking on short scenes) | — → COMPLETE | PRs #396 (OOM/timeout/FFmpeg memory bloat), #397 (PCM no-double-encode), #398 (skip ducking <30 s), #399 (`-threads 0` everywhere). The post-TTS perf plan A+C+D+E. |
| REQ-INFRA-12.29 (NEW — sub-account deletion revokes Clerk sessions + suspends Profile) | — → COMPLETE | PR #346 (#388). Closes the "deactivated sub-account still has a live session" gap. |
| REQ-INFRA-12.30 (NEW — ScreenplayPlayer project-level reactions at top, scene-level feature-flagged off) | — → COMPLETE | PR #348 (#389). |
| REQ-INFRA-12.31 (NEW — ElevenLabs observability + tuning) | — → COMPLETE | PR #379. |

### Section 8 — Enterprise / Team Sharing

| Req ID | Status change | Notes |
|--------|---------------|-------|
| REQ-ENT-8.6 (UX — dashboard members preview must show the true count, with a "+N more" affordance when the preview list is capped) | PARTIAL → PARTIAL | PR #424's MAX-H-SCALE fix introduced a silent truncation regression (`team.members.length` after `take: 50` displays "50" for tiers with hundreds of members — worse than the scroller it replaced). Fix in PR #425 (separate `teamMember.count()` for the stat + "Showing N of M" link). Delta-review finding C-1. |
| REQ-ENT-8.7 (Notification feed) | PARTIAL → PARTIAL | Still awaiting Peter review on the three-PR stack (#199/#200/#201). Carryover. |

### Sprint A backlog (data-tier code-review carryovers)

| Req ID | Status change | Notes |
|--------|---------------|-------|
| REQ-INFRA-12.23 (DT-31-H-1 — pipeline FK migration: `tts_stems`, `timelines`, `alignments`, `scene_renders`) | NOT IMPL → carry | Still Sprint A. |
| REQ-INFRA-12.24 (LOG-RETN — content_access_log 7-year retention cron) | NOT IMPL → carry | Still Sprint A. Needs Ryan/Chris policy alignment. |
| REQ-INFRA-12.25 (PLAY-TOCTOU — atomic playable-version guard) | NOT IMPL → carry | Still Sprint A. Security work, daylight only. |
| REQ-DATA-DT-33-L-2 (Doc: `prisma db push` vs migrations) | NOT IMPL → COMPLETE | PR #424. `packages/shared/prisma/MIGRATIONS.md` covers the rule + the partial-index gotcha (`jobs_first_audio_url_not_null`) by name. |
| REQ-DATA-DT-35-H-1 (CreditTransaction.jobId FK + onDelete) | NOT IMPL → COMPLETE | Migration 0045. Half-bidirectional relation also caught in PR #417. |
| REQ-DATA-DT-36-M-1 (ContentAccessLog onDelete:SetNull) | NOT IMPL → COMPLETE | Migration 0045. |
| REQ-TEST-ENV (lib/env-validation.ts contract tests) | NOT IMPL → COMPLETE | PR #424. 17 tests pin REQUIRED list, OPTIONAL warnings, and the at-least-one-LLM-provider gate. |
| REQ-TEST-ADVISER (adviser/service.ts integration tests) | NOT IMPL → carry | Still Sprint A — needs careful LLM mocking, not midnight work. |

---

## Gap Analysis (delta from 2026-06-14)

| Feature | Status | Gap | Impact | Resolution Plan | Target |
|---------|--------|-----|--------|-----------------|--------|
| Real-time job-status sync (#423) | PARTIAL | BLOCKER + HIGH fixed in `fd91ba3`; still wants Peter review before merging to main + dev-env soak with flag on | UI/worker drift class of bug returns the moment we ship something stale | Hold from main until Peter approves; flag-on dev observation window | Day 2–3 of next sprint |
| Build pipeline cleanup (#425) | PARTIAL | render.yaml `plan: pro` vs live `standard`; duplicate `productionBrowserSourceMaps`; dashboard memberCount silent truncation | Same silent-drift pattern as 2026-06-13 (render.yaml); enterprise tiers see "50" when they have 200 members | Admin-mergeable per `feedback_admin_merge_discipline`; ~5 lines | This session / next day |
| Sentry source-map symbolication | UNVERIFIED | Source maps disabled in #419 to save build memory; Sentry plugin runs independently but unverified end-to-end | Stack traces in prod errors could be obfuscated | Spot-check a recent prod error in Sentry | Pre-launch verification |
| Sampling Phase C hybrid mode (Ryan validation) | BLOCKED | Awaits two Ryan-supplied test scripts to baseline Jaccard distribution against `legacy` | Can't promote `DIRECTOR_CHARACTER_EXTRACTION_MODE=hybrid` to default without it | Ryan to deliver scripts (RYAN-TASK-2); then run `dev-shadow-telemetry-summary.ts` | Sprint A |
| TEST-ADVISER coverage | NOT IMPL | adviser/service.ts has zero integration tests | Class of LLM-bypass bug like #178 / #195 could land here unseen | Write the suite during daylight, not midnight | Sprint A |
| R-3 `_resetListenerCountForTesting` ungated | NOT IMPL | Pool counter mutator importable from anywhere; no NODE_ENV guard | Prod-mutability backdoor (low exploit probability, high blast radius) | 1-line guard | Sprint A |
| R-4 SSE feature-flag bypass | NOT IMPL | Flag check lives only at React call-site | Defeats the kill-switch story for #423 | Add server-side flag check at top of `/api/jobs/[id]/stream/route.ts` | Sprint A |
| Sprint A carryovers from 2026-06-14 | NOT IMPL | DT-31-H-1, LOG-RETN, PLAY-TOCTOU still on the books | Data integrity (orphans), retention compliance, security | Post-launch Sprint A | Week of 2026-06-29 |

---

## Test Inventory

| Package | Tests passing | Δ from 2026-06-14 |
|---------|---------------|-------------------|
| Orchestrator | 881 | 0 (no orchestrator tests added; orchestrator changes since 2026-06-14 reused existing suites) |
| Web | ~1,360 + 277 from #423 (when merged) | +17 env-validation (#424), +260 realtime (#423: 157 pool + 103 NOTIFY) |
| **Total (current on main)** | **~2,241** | **+17 vs 2026-06-14** |
| **Total (dev with #423)** | **~2,501** | **+277 vs 2026-06-14** |

All passing. TypeScript: 0 errors both packages (typecheck clean as of EOD 2026-06-25).

---

## Summary of changes from v3.6.0 → v3.7.0

- **2 new sections** (29: real-time sync, 30: build pipeline hygiene) — 12 new requirements
- **Section 25 (cost-opt / sampling)** — 6 status flips to COMPLETE (Phases A–E + scene cache)
- **Section 5 (listening)** — 3 status flips (SSE everywhere, partial-completion, drift)
- **Section 12 (infra)** — 1 flip + 4 new rows (worker split, DB pool, perf wave, sub-account Clerk, ScreenplayPlayer, ElevenLabs observability)
- **Section 8 (enterprise)** — 1 PARTIAL row added (#424 regression; #425 fix in flight)
- **Sprint A backlog** — 4 status flips (DT-33-L-2, DT-35, DT-36, TEST-ENV); 3 carryovers explicit
- **Gap Analysis** — refreshed; 8 active gaps

*Incremental update to REQUIREMENTS-2026-06-14.md. v3.7.0 represents the sampling-architecture-complete + real-time-job-sync-in-review state of dev branch as of EOD 2026-06-25.*
