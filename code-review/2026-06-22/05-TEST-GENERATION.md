# Test Generation Report — 2026-06-22

## Coverage Delta

| Package | Before (2026-06-16) | After (2026-06-22) | Δ |
|---|---|---|---|
| `@story-magic/orchestrator` | ~881 | **990** | +109 |
| `@story-magic/web` (unit) | ~1,343 | **1,553** | +210 |
| Skipped (inoculation gate) | 12 | **0** | -12 (all activated) |
| **Total active** | ~2,224 | **2,543** | **+319** |

## Notable additions (50 commits)

| Test file | Purpose | Cases |
|---|---|---|
| `tests/unit/lib/classify-failure.test.ts` | Pin the 4-branch failure classifier (upstream-tts / preflight-voice / empty-audio-urls / director-invalid / generic) | 16 |
| `tests/unit/regressions/ryan-bug-list.test.ts` | Source-grep inoculation suite — one describe per PR fix | 14 (all active) |
| `tests/component/project-reaction-bar.test.tsx` | Project-level Like/Pass/Undecided toolbar | 13 |
| `tests/unit/lib/notifications-producers.test.ts` | 6 new cases for resolveMastersForActor + project_created + script_uploaded | 35 (was 29) |
| `tests/unit/lib/orchestrator-readiness.test.ts` | Pin 90s default + warming-up message | 2 |
| `tests/unit/lib/generation-chunk-scenes.test.ts` | Rewritten for FIRST_CHUNK_SCENES=2 + SCENES_PER_CHUNK=7 | 12 |
| `tests/unit/api/comments-api.test.ts` | New case for sceneIndex=null project-level reaction upsert | 13 (was 12) |
| `src/director/validation/director-validator-a005-edges.test.ts` | 40 cases for the 30 stage-direction edge categories | 40 |
| `src/director/validation/director-validator-a005.test.ts` | 2 new cases for narrator voice_key preservation + casing | 20 (was 18) |

## Pass/Fail

All 2,543 active tests pass. 0 skipped after un-skipping the inoculation suite.

```
@story-magic/orchestrator:  990/990 ✓
@story-magic/web (unit):   1,553/1,553 ✓
@story-magic/web (comp):     290/290 ✓
```

## Still Uncovered (Acceptable Gaps)

| Module | Reason |
|---|---|
| `lib/api/openapi.ts` (829 LOC) | OpenAPI schema generator — type-only output, no logic to test |
| `lib/adviser/types.ts`, `lib/scoring/types.ts`, `lib/revisions/types.ts` | Type-only files |
| `lib/adviser/prompts.ts`, `lib/scoring/prompts.ts` | LLM prompt strings — covered by integration in adviser-service.test.ts |
| `lib/email/resend.ts` (435 LOC) | External-service wrapper — covered by `comments-notify.test.ts` indirectly |
| `lib/queue/worker.ts` (464 LOC) | Test harness mocked separately; covered via processor.ts integration tests |

## What changed in test discipline this weekend

1. **Inoculation pattern formalized.** `ryan-bug-list.test.ts` source-greps each PR's fix. Every PR landed this weekend has a corresponding active describe block.
2. **Synthetic reproducer file** at `Samples/A005-Reproducer-2026-06-21.fountain` — readable Fountain screenplay packed with 9 LLM mis-attribution categories. Doubles as documentation.
3. **All test files green at all times** during the integration. Zero merge-conflicts resulted in skipped or disabled tests.
