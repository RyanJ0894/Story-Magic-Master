# Test Generation Report — 2026-06-25

## Coverage delta

| Package | 06-22 | 06-25 | Δ |
|---------|-------|-------|---|
| orchestrator | ~1026 | **1121** | +95 |
| web | 1578 | **1589** | +11 |
| **total** | ~2604 | **2710** | **+106** |

## New tests this cycle (from PRs since 06-22)

| Source PR | File | Tests | What |
|-----------|------|-------|------|
| #408 | `sampling/sampling.test.ts` | 19 | CharacterIndex + IntroStitcher + cache-hash byte identity |
| #409 | `voice-assignment-agent.test.ts` | +5 | sample-driven assignment path |
| #411 | `manifest-converter.test.ts` | 10 | regex→manifest converter + Jaccard compare |
| #411 | `consistency-verifier-agent.test.ts` | 8 | verifier batch + verdict shape |
| #412 | `env.test.ts` | +12 | positive-int validation contract |
| #413 | `adaptive-chunk-sizer.test.ts` | 11 | density bucket → chunk size mapping |
| #413 | `cue-tagger.test.ts` | 9 | offset-anchored tag insertion, byte-identity |
| #415 | `job-status.test.ts` | 9 | `isRetryImminent` / `isTerminalFailure` |
| #415 | `processor-chunking.test.ts` | +2 | majority-fail → throw + `PARTIAL_FAIL_RATIO` override |
| #404 | `progress-estimate.test.ts` | 4 | per-page estimate calibration |

## Wrote / didn't write this session

This review didn't write new tests — the 3 fixes (`UX-D-01`, `DT-35-H-1`, `DT-36-M-1`) are:
- One-line locale change (UX-D-01) — visually verified in the rendered component; no testable contract surface
- Two schema-level FK changes — verified through `prisma generate` + full test sweep (2710/2710 green)

## Modules without colocated test files (informational)

Most are configs / type-only / SDK init wrappers — not worth tests. Real candidates remaining:

| Module | Lines | Reason kept off list | Sprint |
|--------|-------|----------------------|--------|
| `packages/web/lib/utils.ts` | 6 | only exports `cn()` (shadcn helper) — already tested upstream | never |
| `packages/web/lib/env-validation.ts` | 85 | schema-validation contract; would benefit from pinning. Optional. | backlog |
| `packages/web/lib/comments/notify.ts` | n/a | logic worth pinning; defer | next cycle |
| `packages/web/lib/adviser/service.ts` | n/a | integration-heavy; needs LLM mocks | next cycle |

## Still uncovered

Per the skill rules: zero modules in the `WRITE NOW` (SP ≤ 2 + critical path) bucket. The above three could fall into `WRITE SPRINT 1` if we want to harden the pre-flight + adviser paths before broader launch.
