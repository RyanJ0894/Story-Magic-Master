# Sprint Plan — 2026-06-16

Unified plan merging Code Review V3 + UX/Info-Design + Data-Tier findings.

## Sprint Now (PR #295, #300, #302, #307 — already in flight)

These are sitting in Peter's review queue. No new work to allocate; this is the unblocking gate.

| PR | SP est. | Risk |
|----|---------|------|
| #295 CSP form-action | 1 | Security header — additive |
| #300 character→Narrator reassign | 3 | Heuristic correctness |
| #302 invite regressions | 3 | Auth flow |
| #307 partial-audio + Sentry | 2 | New control flow on processor |

**Total Sprint Now: 9 SP, all awaiting review.**

## Sprint A (12.5 SP — start after Sprint Now clears)

| ID | SP | Title | Owner |
|----|----|-------|-------|
| UX-I-01 | 1.5 | Audio-tuning beforeunload warning + explicit Unlock dialog | Frontend (Claude Code) |
| DT-30-M-1 | 3 | subscriptions upsert in tier provisioning routes | Backend (Claude Code) |
| PLAY-TOCTOU | 2 | playback authz race fix | Backend (Claude Code + Peter review) |
| CONTENT-LOG-RETENTION | 1 | extend retention cron to content_access_log | Backend (Claude Code) |
| VERIFY-DT-32-H-1 | 1 | audit remaining entry points for sub-account isolation | Backend (Claude Code) |
| T-01 | 1 | replace voice-ID placeholder once Ryan picks one | Claude Code (after Ryan input) |
| T-03 | 1 | `resolveModel(): LanguageModelV1` typing | Claude Code |
| TEST-A-01 | 1 | direct test for `computeSceneRenderHash` includes tuning | Claude Code |
| TEST-A-02 | 1 | audio-tuning lock/unlock + cache invalidation integration test | Claude Code |

Batching strategy:
- **PR A1**: UX-I-01 + T-03 + audio-tuning tests (TEST-A-01, TEST-A-02) — all touch audio-tuning surface; 4.5 SP
- **PR A2**: DT-30-M-1 + CONTENT-LOG-RETENTION + VERIFY-DT-32-H-1 — auth/data-tier hardening pass; 5 SP
- **PR A3**: PLAY-TOCTOU + T-01 — security + content; 3 SP

## Sprint B (7 SP — post-launch acceptable)

| ID | SP | Title |
|----|----|-------|
| T-02 | 2 | `DirectorJson` interface for Prisma JSON column |
| T-04 | 1 | `Ratelimit | InMemoryLimiter` union |
| T-05 | 2 | Page-props typing for projects/[id] components |
| UX-I-02 | 0.5 | Slider thumb `aria-label` forward |
| UX-I-03 | 0.5 | Reset-to-defaults preserves Lock-eligibility |
| UX-I-04 | 0.5 | `<audio><source key={url} />` for stable reload |
| UX-I-05 | 0.5 | Install-prompt dismiss TTL (30 days) + instrumentation |

## Launch gate

After Sprint Now clears (PRs #295/#300/#302/#307 merged):
- ✅ All of Ryan's 2026-06-15 batch closed
- ⏳ Stripe live walkthrough (Chris, 1h)
- ⏳ UAT click-through (~2h)
- ⏳ Optional: PR A1 polish on audio-tuning before featuring in GTM

Sprint A items are launch-adjacent quality of life, not blockers.
Sprint B items are post-launch.
