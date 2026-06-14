# Story Magic — Product Requirements (incremental update 2026-06-14)

**Date:** 2026-06-14
**Author:** Chris Therriault
**Status:** Incremental update on top of `docs/REQUIREMENTS-2026-06-09.md` (v3.5.0)
**Target version:** v3.6.0 (friendly-cohort launch candidate)

This file lists **only** the requirements that changed status or were added since 2026-06-09. For the cost-opt arc baseline see REQUIREMENTS-2026-06-09.md; for the full 24-section product baseline see REQUIREMENTS-2026-06-03.md.

> Legend: P0 = Must have | P1 = High value | P2 = Nice to have
> Status: COMPLETE | PARTIAL | NOT IMPL | DEFERRED | BLOCKED

---

## NEW SECTION 26 — Production Hardening & Operational Resilience

The overnight hardening sprint (2026-06-13) added 8 cross-cutting operational requirements (H1–H8). Memorialized here as durable contracts.

| Req ID | Requirement | Priority | Planned Implementation | Status | Notes |
|--------|-------------|----------|------------------------|--------|-------|
| REQ-OPS-26.1 | Every HTTP handler emits a Sentry breadcrumb on entry/exit; >5s warn, >15s error captured automatically | P1 | `middleware/handler-timing.ts` | COMPLETE | PR #250 (H1) |
| REQ-OPS-26.2 | Boot-time seeders run inside a registered framework with per-seeder timeout; failure logged, not fatal unless P0 | P1 | `lib/boot-seeds.ts` (`registerSeeder` + `runBootSeeds`) | COMPLETE | PR #257 (H2) |
| REQ-OPS-26.3 | Env vars defined in render.yaml must come from Doppler `sync: true` or carry the `# h3-env-source-of-truth-allowed` bypass marker | P0 | `scripts/lint-render-env.js` CI check | COMPLETE | PR #256 (H3) |
| REQ-OPS-26.4 | Prisma writes that race with cascade deletes use `safeUpdate`/`safeCreate` to swallow P2025 and emit a structured warn | P1 | `lib/prisma-safe.ts` | COMPLETE | PR #253 (H4) |
| REQ-OPS-26.5 | A `dep-audit` CI step flags packages installed but never imported; baseline maintained at `docs/DEPS-AUDIT-BASELINE.md` | P2 | `scripts/audit-stale-deps.js` | COMPLETE | PR #255 (H5) — `hpp` removed |
| REQ-OPS-26.6 | The screenplay parser CI runs against a deterministic fixture corpus (Fountain, FDX, plain text) committed in repo | P1 | `tests/fixtures/screenplays/` + harness | COMPLETE | PR #258 (H6) |
| REQ-OPS-26.7 | SIGTERM triggers graceful shutdown: stop accepting new requests, 503+Retry-After on in-flight after 20s, exit code reflects clean vs dirty | P1 | `lib/shutdown.ts` | COMPLETE | PR #259 (H7) |
| REQ-OPS-26.8 | Production manifest endpoint reports build SHA, deploy time, env-var hash; drift flag when commit ≠ HEAD | P2 | `/api/admin/manifest` + `/internal/manifest` | COMPLETE | PR #254 (H8) |
| REQ-OPS-26.9 | Service worker `CACHE_NAME` auto-bumps on every deploy via build-time SHA injection; source file holds `__BUILD_VERSION__` placeholder | P0 | `scripts/inject-sw-version.mjs` + sw.js | COMPLETE | PR #285. Closes class of stale-SW bugs (CF 524 in regular browser, works in incognito). |
| REQ-OPS-26.10 | Render `buildFilter.ignoredPaths` skips deploys for docs-only commits | P2 | `render.yaml` | COMPLETE | PR #266 |

---

## NEW SECTION 27 — Voice Catalog Lifecycle

The voice catalog discrepancy (Ryan reported 76 expected, app showed 29) was traced to a wrong-account API key. New durable requirements ensure this class of bug cannot recur silently.

| Req ID | Requirement | Priority | Planned Implementation | Status | Notes |
|--------|-------------|----------|------------------------|--------|-------|
| REQ-VOICE-27.1 | On every orchestrator boot, the voice catalog JSON is symmetrically diffed against `voices` DB rows; new rows inserted, removed rows soft-deactivated | P0 | `lib/voice-catalog-sync.ts` + `registerSeeder('voice-catalog', …)` | COMPLETE | PR #281 |
| REQ-VOICE-27.2 | `ELEVENLABS_API_KEY` (Doppler prd) MUST point to the grant-tier account (`tier=grant_tier_2_2025_07_23`, 660 voice slots). Rotate via Doppler; native sync propagates to Render. | P0 | Doppler `story-magic`/`prd` | COMPLETE | Verified 2026-06-13 via `/v1/user` |
| REQ-VOICE-27.3 | `voice_id` MUST be unique in the source catalog JSON; a unit test enforces this invariant | P0 | `tests/voice-catalog-integrity.test.ts` | COMPLETE | Dup-id test no longer marked `.fails` after #283 |
| REQ-VOICE-27.4 | Every voice row has a non-empty `gender` value — inferred from label text when ElevenLabs API omits it | P1 | `lib/voice-gender-infer.ts` | COMPLETE | PR #284 |
| REQ-VOICE-27.5 | Final canonical count: 137 active voices on the grant account, 0 inactive carryover | P1 | DB row-count check in `/health.voiceCatalog` | COMPLETE | Verified 2026-06-13 |

---

## NEW SECTION 28 — Alignment Pipeline Resilience

| Req ID | Requirement | Priority | Planned Implementation | Status | Notes |
|--------|-------------|----------|------------------------|--------|-------|
| REQ-ALIGN-28.1 | whisper.cpp builds statically-linked in the production Render image; binary copies to `bin/whisper` and `--help` smoke-tests successfully | P0 | `install-whisper.sh` w/ `-DBUILD_SHARED_LIBS=OFF` | COMPLETE | PR #270 |
| REQ-ALIGN-28.2 | The 142 MB `ggml-base.en.bin` model is mirrored to R2; build script falls back from Hugging Face to R2 on 4xx/5xx | P1 | R2 bucket + script env vars | COMPLETE | PR #278 |
| REQ-ALIGN-28.3 | Model is written to `PROJECT_ROOT/.whisper-models/` (ephemeral; persistent disk isn't writable at build stage) | P1 | `install-whisper.sh` path resolution | COMPLETE | PR #280 |
| REQ-ALIGN-28.4 | `/health.alignment.primary` reports `"whisper-local"` in production; `binaryRunnable: true` | P1 | `/health` endpoint | COMPLETE | Verified 2026-06-13 |
| REQ-ALIGN-28.5 | curl progress bars suppressed; failures emit structured JSON log (`http_code`, `url`, `time`, `size`) | P2 | `install-whisper.sh` error capture | COMPLETE | PR #279 |

---

## Updated Sections (delta from 2026-06-09)

### Section 8 — Enterprise / Team Sharing
| Req ID | Status change | Notes |
|--------|---------------|-------|
| REQ-ENT-8.4 | PARTIAL → COMPLETE | Sub-account isolation merged in PR #177 |
| REQ-ENT-8.5 | PARTIAL → COMPLETE | Stripe self-serve enterprise checkout merged in PR #171 |
| REQ-ENT-8.7 | NOT IMPL → PARTIAL | Notification feed: PRs #199 (backend), #200 (producers), #201 (frontend) opened — scope locked. Awaiting Peter review. |

### Section 12 — Infrastructure & Security
| Req ID | Status change | Notes |
|--------|---------------|-------|
| REQ-INFRA-12.20 | (Sentry runtime) | TimeAgo hydration crash (1F) RESOLVED via SSR-safe component (PR #272 + #274 same-class sweep) |
| REQ-INFRA-12.21 | (Sentry runtime) | `/api/jobs/[id]` 5-min hangs (1G) MITIGATED via defensive 5s timeout (PR #273); architectural fix is PR #282 |
| REQ-INFRA-12.22 | (Sentry runtime) | ElevenLabs INVALID_KEY false positives (1D) RESOLVED via narrowed match (PR #269) |
| REQ-INFRA-12.23 (DT-31-H-1) | NOT IMPL — still Sprint A | Pipeline FK migration |
| REQ-INFRA-12.24 (LOG-RETN) | NOT IMPL — still Sprint A | content_access_log retention |
| REQ-INFRA-12.25 (PLAY-TOCTOU) | NOT IMPL — still Sprint A | Atomic playable-version guard |
| REQ-INFRA-12.26 (NEW) | NOT IMPL | Queue worker split into its own Render service — PR #282 open, Saturday execution |

### Section 25 — Cost Optimization (from 2026-06-09 update)
| Req ID | Status change | Notes |
|--------|---------------|-------|
| REQ-COST-25.2 | PARTIAL → COMPLETE | PR #194 merged |
| REQ-COST-25.9 | PARTIAL → COMPLETE | PR #193 merged |
| REQ-COST-25.10 | PARTIAL → COMPLETE | PR #196 merged |
| REQ-COST-25.11 | PARTIAL → COMPLETE | PR #195 merged |
| REQ-COST-25.12 | PARTIAL → COMPLETE | PR #197 merged |
| REQ-COST-25.13 | PARTIAL → COMPLETE | PR #198 merged |

### Section 5 — Listening Experience
| Req ID | Status change | Notes |
|--------|---------------|-------|
| REQ-LISTEN-5.x | (#206) PARTIAL → COMPLETE | Listen flow no longer dead-ends team members on /reader/dashboard; back-link goes to project page; ConfirmDialog rolled out (PR #271 + #275 e2e) |
| REQ-LISTEN-5.y | (#207) NOT IMPL | Listen UI sync drift — verification pending in GTM window; may auto-resolve after whisper-local |
| REQ-LISTEN-5.z | (#208) NOT IMPL | Recently Played % wrong — cosmetic, backlog |

---

## Gap Analysis (delta from 2026-06-09)

| Feature | Status | Gap | Impact | Resolution Plan | Target |
|---------|--------|-----|--------|-----------------|--------|
| Stripe live-mode verification | NOT IMPL | Test cards run only against test mode | Cannot accept real payments confidently | `STRIPE-LIVE-WALKTHROUGH-2026-06-13.md` runbook | Day 1 of GTM |
| Queue worker split (PR #282) | PARTIAL | Worker embedded in web; consumes web's DB connections | Background jobs can starve API requests under load | Saturday-morning runbook execution | Day 1 of GTM |
| Notification feed (#174) | PARTIAL | 3 PRs open, awaiting Peter review | Enterprise customers can't see async events in-app | Standard review cycle | Post-launch Sprint B |
| Enterprise signup CSRF (#219) | NOT IMPL | Unclear whether friendly cohort includes enterprise self-serve | Blocked enterprise self-signup | Conditional — fix only if cohort needs it | Pre-launch / deferred |
| Sprint A items (DT-31-H-1 et al.) | NOT IMPL | Carried since 2026-06-09 code review | Data integrity (orphan rows), UX (confirm dialogs), retention | Post-launch sprint | Week of 2026-06-15 |

---

## Test Inventory

| Package | Tests passing | Δ from 2026-06-09 |
|---------|---------------|-------------------|
| Orchestrator | 881 | +168 |
| Web | 1,343 | +70 |
| **Total** | **2,224** | **+238** |

All passing. 0 TypeScript errors both packages.

---

*Incremental update to REQUIREMENTS-2026-06-09.md. Full v3.6.0 baseline will be issued after the friendly-cohort cutover.*
