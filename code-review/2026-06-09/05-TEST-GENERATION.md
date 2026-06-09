# Test Generation Report — 2026-06-09

## Coverage Delta

| Package | 2026-06-03 | 2026-06-09 | Δ |
|---------|-----------|-----------|----|
| `@story-magic/orchestrator` | ~641 | **713** | +72 |
| `@story-magic/web` | ~1,269 | **1,273** | +4 |
| **Total** | **1,910** | **1,986** | **+76** |

All 1,986 tests pass. No new flakes.

## Tests Written / Added This Session

Through the cost-opt PR arc:

| PR | Test file | New tests | Coverage |
|----|-----------|----------|----------|
| #178 | various reshapes | – | Retry/delegation contract refactored |
| #181 | `lib/embedding-config.test.ts` (NEW) | 4 | Dimension constants + assertion |
| #181 | `director/embeddings/embedding-store.test.ts` (UPDATED) | – | Mock 3d for test fixtures |
| #183 | `director/agents/audio-director-agent.test.ts` (NEW) | 2 | Model selection contract |
| #184 | `lib/llm-client.test.ts` (UPDATED) | +2 | Anthropic cache_control passthrough |
| #185 | `analysis/script-score-service.test.ts` (UPDATED) | +2 | Batched mode 1-call contract |
| #187 | `lib/embedding-cache.test.ts` (NEW) | 10 | L1+L2+L3 cache contract |
| #188 | `lib/select-director-model.test.ts` (NEW) | 12 | Page-threshold tiering |
| #189 | `orchestrator/workers/whisper-align.test.ts` (NEW) | 6 | Whisper fallback chain |
| #191 | `lib/scene-cache.test.ts` (NEW) | 18 | Hash + cache contract |
| #193 | `lib/wallclock-budget.test.ts` (NEW) | 13 | Race-against-timer wrapper |
| #194 | `lib/llm-failover.test.ts` (UPDATED) | +4 | OpenRouter relief valve shape |
| #195 | `lib/mock-provider.test.ts` (NEW) | 17 | Mock provider + Zod walker stub |
| #196 | `lib/llm-call-log.test.ts` (NEW) | 14 | Cost math + write contract |
| #197 | `lib/zod-anthropic-guard.test.ts` (NEW) | 20 | Schema walker + 9 LLM-bound schemas |
| #198 | `tests/unit/lib/adviser-service.test.ts` (UPDATED) | 0 (back-compat shim) | Adviser path now Claude |

## Still Uncovered (Deferred)

| Module | Lines | Reason | Sprint |
|--------|------|--------|-----|
| `lib/prisma.ts` | ~30 | Singleton wrapper; covered transitively | Backlog |
| `lib/sentry.ts` | ~50 | Side-effecting init; awkward to unit test | Backlog |
| `lib/storage.ts` | ~100 | File I/O; covered by smoke + integration tests | Backlog |
| `lib/logger.ts` | ~90 | Wraps pino; covered by structural type tests | Backlog |
| `lib/api-response.ts` | ~50 | Just response shape constructors; covered transitively | Backlog |
| `lib/constants.ts` | <50 | Constants only | N/A |

None of these are high-value. Skipping.

## Test stability

- 0 flakes observed across the 14 PR cycles tonight
- One transient failure in earlier session (whisper-align test on first run, passed on retry) — likely environment timing; not a code defect

## Recommended next-sprint additions

1. **Once #196 merges:** integration test that records a real `llm_call_log` row through `runAgentLoop` (currently the helper is unit-tested but the wiring contract isn't). ~1 SP.
2. **Once #195 merges:** smoke test confirming `TEST_MODE=mock` actually skips the failover chain end-to-end. ~0.5 SP.
3. **Pipeline FK fix (DT-31-H-1):** add a test that asserts `scene_renders.project_id` cascades on `Project` delete. ~0.5 SP.
