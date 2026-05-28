# Test Generation Report — 2026-05-27

## Coverage Delta
| Before | After | New |
|--------|-------|-----|
| 1,658 (541 orch + 1,117 web) | 1,664 | +6 |

## Tests written this session
| File | Tests | Covers | Status |
|------|-------|--------|--------|
| `packages/web/tests/unit/lib/ensure-profile.test.ts` | 6 | upsert where/create/update branches, sparse-Clerk no-op (no clobber), email→fullName fallback, null Clerk user | ✅ pass |

## Still uncovered (deferred)
| ID | Module | Why it matters | SP |
|----|--------|----------------|----|
| TEST-02 | `orchestrator/src/lib/llm-client.ts` — `buildFailoverChain`, `isFailoverableError`, OpenRouter tier, `generateStructuredOutput` failover | Critical prod infra (billing/rate-limit recovery). Existing `llm-client.test.ts` covers `runAgentLoop` happy/tool/error paths but **not the failover chain**. Functions are not exported. | 2 |

**TEST-02 approach:** export `buildFailoverChain` + `isFailoverableError` (pure
functions, trivial to test): assert chain order for anthropic (→openrouter→openai
when `OPENROUTER_API_KEY` set; →openai when not), empty for non-failover
providers, and `isFailoverableError` true for 402/429/529 + billing strings,
false for 400/401. Then one integration-style test that a 402 on the primary
advances to the next chain entry.
