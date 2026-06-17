# Test Generation Report — 2026-06-16

## Coverage Delta

| Period | Test files | New tests added in window |
|--------|------------|----------------------------|
| 2026-06-14 baseline | ~161 files | — |
| 2026-06-16 | 169 files (60 orch + 109 web) | 8 new test files, ~80+ new cases |

## New tests added since 2026-06-14

| File | Tests | Reason |
|------|-------|--------|
| `packages/orchestrator/src/orchestrator/workers/timeline-b003b.test.ts` | 6 | Pins B-003b gain-offset arithmetic — back-compat (no offsets), per-event-type isolation, all-three-together, undefined-as-zero |
| `packages/web/tests/unit/api/audio-tuning-preview.test.ts` | 7 | 401 unauth, 400 NO_SOURCE_PROJECT, 400 NO_SCENES, zod reject out-of-range, happy path, 502 orch non-OK, 503 SERVICE_SECRET_KEY missing |
| `packages/web/tests/unit/lib/audio-tuning.test.ts` | ~12 | Service layer: getAudioTuning, lock/unlock, default merge semantics |
| `packages/web/tests/unit/lib/format.test.ts` | ~6 | fmtInt() helper (Sprint A "data polish") |
| `packages/web/tests/unit/lib/listen-alignment-mapper.test.ts` | ~14 | PR #207 fix — real whisper alignment instead of char estimate |
| `packages/web/tests/unit/lib/playback-progress.test.ts` | ~10 | PR #296 — clamp to 0-100% |
| `packages/web/tests/unit/lib/projects-service-list.test.ts` | ~12 | PR #289 — sub-account project isolation |
| `packages/web/tests/unit/lib/tier-provision.test.ts` | ~15 | PR #289 — atomic tier provisioning |

**Net new tests: ~82 cases across 8 files.**

## Coverage gaps not yet filled

These follow from the in-review PRs that haven't merged yet — once they land, the next review should confirm tests went in with them.

| PR | Test file expected at merge |
|----|------------------------------|
| #295 (CSP form-action) | E2E or middleware test verifying Clerk + Stripe origins are accepted on the form-action directive |
| #300 (autoReassignStageDirectionsToNarrator) | Unit test in `packages/orchestrator/src/director/validation/` with the 18 cases the PR description claims |
| #302 (invite regressions) | Reactivation path test in `teams.ts::addMember`; no-auto-accept page test |
| #307 (partial-audio + Sentry) | Processor test asserting `captureMessage` fires with `kind: 'pipeline.partial_audio'` when any segment fails |

Each PR reviewer should confirm the tests are in the same PR (not deferred).

## Critical paths still untested by unit tests

These are integration concerns by nature — covered by `./scripts/smoke-test.sh` and Playwright E2E, not unit tests. Carryover from prior reviews:

- **End-to-end orchestration with real ElevenLabs response** — only smoke-tested.
- **Stripe webhook idempotency under retries** — covered by integration test against Stripe CLI fixtures; manually verified.
- **Scene cache invalidation on `audio_tuning` lock** — covered by `timeline-b003b.test.ts` for the gain-offset path; the `computeSceneRenderHash` change should grow a focused test (small SP, deferred to Sprint A).

## Sprint A test work (recommended)

| ID | SP | Title |
|----|----|-------|
| TEST-A-01 | 1 | Add direct test for `computeSceneRenderHash` proving tuning is part of the input fingerprint (regression guard against silent cache poisoning) |
| TEST-A-02 | 1 | Audio-tuning lock/unlock round-trip integration test (DB + service + cache invalidation in one path) |

Total: 2 SP.
