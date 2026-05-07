# Test Generation Report — 2026-05-06

## Coverage Delta
| Package | Before | After | New Tests |
|---------|--------|-------|-----------|
| web | 846 / 50 suites | 862 / 51 suites | +16 tests / +1 suite |
| orchestrator | 508 / 31 suites | 508 / 31 suites | — |
| **Total** | **1,354** | **1,370** | **+16** |

## Tests Written

### `tests/unit/api/stripe-webhook.test.ts` — +5 tests
| Test | Coverage |
|------|---------|
| should upsert a Purchase for advanced_analysis | Happy path — webhook creates purchase |
| should be idempotent — upsert not create on retry | Stripe retry safety |
| should fall back to findFirst+create when payment_intent absent | Null payment_intent path |
| should skip create when purchase already exists (null payment_intent) | Null path dedup |
| should skip processing when userId/projectId missing | Metadata validation |

### `tests/unit/api/advanced-analysis-route.test.ts` — +11 tests (new file)
| Test | Coverage |
|------|---------|
| GET: returns purchased:false when no purchase | Not-yet-purchased state |
| GET: returns purchased:true when completed | Already-purchased state |
| GET: returns 401 when not authenticated | Auth guard |
| GET: returns 404 when project not owned | Ownership guard |
| POST: returns checkout URL | Happy path — creates Stripe session |
| POST: returns alreadyOwned when already purchased | Idempotency on route |
| POST: creates session with correct metadata | Security — metadata binding |
| POST: prefills customer_email when profile has email | Email prefill |
| POST: omits customer_email when profile has no email | Null email path |
| POST: returns 401 when not authenticated | Auth guard |
| POST: returns 404 when project not owned | Ownership guard |

## Deferred (Not Written)
| Module | Reason |
|--------|--------|
| `AdvancedAnalysisUpgrade.tsx` | Client component — needs Playwright / component test setup |
| `AdvancedAnalysisSuccessBanner.tsx` | Client component — needs happy-dom + router mock |
