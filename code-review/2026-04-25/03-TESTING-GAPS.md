# Testing Gaps — 2026-04-25

## Current State

| Package | Suites | Tests | vs Prior |
|---------|--------|-------|----------|
| `@story-magic/web` | 44 | 733 | → (unchanged) |
| `@story-magic/orchestrator` | 28 | 471 | ↑ +13 tests |
| **Total** | **72** | **1,204** | ↑ +13 |

The orchestrator gained 13 tests this session (monitoring: 10, llm-client: 2,
director-validator: 2 empty-catalog-warning). No web tests changed — web was already
at a good baseline from session `41a5777`.

---

## Coverage Map

### Orchestrator (28 suites / 471 tests)

| Module | Tests | Quality |
|--------|-------|---------|
| director/agents/director-agent | ✅ 15 | Good — all 3 passes mocked |
| director/agents/voice-assignment-agent | ✅ 6 | Good — createVoiceTools factory mock |
| director/agents/character-extraction-agent | ✅ 6 | Good — chunked + single path |
| director/agents/scene-construction-agent | ✅ 6 | Good |
| director/pipeline | ✅ | Good |
| director/validation/director-validator | ✅ 16 | Good — includes new empty-catalog warn |
| director/validation/audio-validator | ✅ 11 | Good — includes O(N²) Map path |
| director/tools/hybrid-voice-search | ✅ | Good |
| director/utils/script-chunker | ✅ 15 | Good |
| lib/llm-client | ✅ 9 | Good — includes maxOutputTokens tests |
| lib/monitoring | ✅ 10 | **New this session** |
| lib/idempotency | ✅ (ttskey alias test removed) | Good |
| lib/retry | ✅ | Good |
| lib/audio-quality | ✅ 27 | Good |
| lib/catalog-loader | ✅ | Good |
| lib/ffmpeg-validator | ✅ 26 | Good |
| orchestrator/workers/{tts,align,mixer,cues,timeline} | ✅ | Good |
| analysis/script-score-service | ✅ 12 | Good |
| routes/health | ✅ | Good |
| schemas/director-json | ✅ 28 | Good |
| integration/pipeline | ✅ | Smoke test |

**Orchestrator coverage: ~92%** — excellent for a production service.

### Web (44 suites / 733 tests)

#### Well-covered areas ✅
- All billing/Stripe routes (checkout, webhook, portal, donate)
- All project routes (CRUD, score, suggestions, revisions, regenerate-scene)
- Exchange marketplace (all 3 routes)
- Writer Hub (writers, projects-exchange)
- Reader library and upload
- Shares and listen endpoints
- Impact StoryBuilder API (impact-stories test)
- Upgrade + referral-upgrade (added this session `41a5777`)
- Dashboard tier logic (added this session)

#### Gaps — Medium Priority

### TST-001: Voice assignments, workflow-mode, audio-overrides routes (3 SP)
These 3 project sub-routes were added but have no tests.

| Route | File |
|-------|------|
| `GET/PUT /api/projects/[id]/voice-assignments` | `voice-assignments/route.ts` |
| `PATCH /api/projects/[id]/workflow-mode` | `workflow-mode/route.ts` |
| `PUT /api/projects/[id]/audio-overrides` | `audio-overrides/route.ts` |

**Effort:** 3 SP (straightforward auth + DB mock pattern)

### TST-002: `comparable/index.ts` service (3 SP)
Vector similarity comparables service. No tests. Calls OpenAI embeddings.
**File:** `packages/web/lib/comparable/index.ts`
**Effort:** 3 SP (mock OpenAI call + test score calculation)

### TST-003: `adviser/index.ts` service (3 SP)
Story Adviser LLM service — generates structural feedback. No tests.
**File:** `packages/web/lib/adviser/index.ts`
**Effort:** 3 SP (mock LLM response + validate output shape)

### TST-004: `teams/members` route (2 SP)
New this session. Invite/list/remove team members. No tests yet.
**File:** `packages/web/app/api/teams/[teamId]/members/route.ts`
**Effort:** 2 SP

#### Gaps — Low Priority

### TST-005: Alert preferences routes (1 SP)
`GET/PATCH /api/alerts/preferences` — simple preference storage, low risk.

### TST-006: Voice assignments route E2E (2 SP)
End-to-end test verifying voice assignment from the UI through to orchestrator
`/orchestrate` call with `voice_overrides`. Currently no test covers this full path.

---

## Test Quality Notes

- All orchestrator tests use proper Vitest v4 patterns (no arrow function constructor mocks)
- Web tests use `vi.mock()` + dynamic import pattern consistently
- No test hits a real database (all use Prisma mock) — acceptable for unit tests
- Integration test at `__tests__/integration/pipeline-integration.test.ts` provides smoke coverage for the full director pipeline
