# Technical Debt — 2026-04-25

## Summary

| Priority | Count | SP |
|----------|-------|----|
| CRITICAL | 0 | 0 |
| HIGH | 0 | 0 |
| MEDIUM | 3 | 11 |
| LOW | 3 | 4.5 |
| Ryan actions | 4 | — |

**Total actionable dev debt: 15.5 SP across 6 items.**
All CRITICAL and HIGH items from this session have been resolved.

---

## MEDIUM Priority

### TD-044: Voice-assignments, workflow-mode, audio-overrides untested (3 SP)

| Priority | SP | Type | Files |
|----------|-----|------|-------|
| MEDIUM | 3 | Tests | `voice-assignments/route.ts`, `workflow-mode/route.ts`, `audio-overrides/route.ts` |

**Task:** Write unit tests for the 3 project sub-routes added without tests. Pattern is
the same as other project routes: mock `withProjectAuth`, test auth failure, test DB call.

**Acceptance Criteria:**
- [ ] `voice-assignments.test.ts` — GET returns assignments, PUT saves, 401 on unauth
- [ ] `workflow-mode.test.ts` — PATCH updates mode, validates enum
- [ ] `audio-overrides.test.ts` — PUT saves overrides, validates schema

### TD-045: `comparable/index.ts` + `adviser/index.ts` untested (5 SP)

| Priority | SP | Type | Files |
|----------|-----|------|-------|
| MEDIUM | 5 | Tests | `lib/comparable/index.ts`, `lib/adviser/index.ts` |

**Task:** Add unit tests mocking the OpenAI embedding/chat calls. Test the service
logic (score calculation, recommendation output shape) in isolation.

**Acceptance Criteria:**
- [ ] `comparable.test.ts` — mock embedding API, test score + ranking
- [ ] `adviser.test.ts` — mock LLM, test advice output Zod validation

### TD-046: `teams/[teamId]/members` route untested (2 SP + 1 TS fix DONE)

| Priority | SP | Type | Files |
|----------|-----|------|-------|
| MEDIUM | 2 | Tests | `teams/[teamId]/members/route.ts` |

**Task:** Write tests for invite, list, remove member flows. The TypeScript error
(`role: z.string()` → `z.enum(...)`) was fixed this session.

**Acceptance Criteria:**
- [ ] `teams-members.test.ts` — GET lists members (owner auth), POST invites, DELETE removes
- [ ] Tests for TeamServiceError propagation (NOT_FOUND, FORBIDDEN)

---

## LOW Priority

### TD-047: Referral codes should be rotatable without deploy (0.5 SP)

| Priority | SP | Type | Files |
|----------|-----|------|-------|
| LOW | 0.5 | Config | `app/api/referral/upgrade/route.ts:10` |

**Task:** Document that `REFERRAL_CODES` env var overrides built-in codes. Add a note
in `.env.local.example` showing the JSON format. No code change needed.

### TD-048: `director-validator.ts` uses local default voice IDs (1 SP)

| Priority | SP | Type | Files |
|----------|-----|------|-------|
| LOW | 1 | Consistency | `director-validator.ts:16-18` |

**Task:** The validator hardcodes `DEFAULT_NARRATOR_VOICE`, `DEFAULT_MALE_VOICE`,
`DEFAULT_FEMALE_VOICE` locally instead of importing from `schemas/voice-map.ts` where
they now respect env var overrides. These should be imported from the schema.

**Acceptance Criteria:**
- [ ] Replace 3 hardcoded strings with imports from `../../schemas/voice-map.js`

### TD-049: `generateSimpleText` in llm-client.ts unused (0.5 SP)

| Priority | SP | Type | Files |
|----------|-----|------|-------|
| LOW | 0.5 | Dead code | `lib/llm-client.ts:276` |

**Task:** `generateSimpleText` is exported but not called anywhere in the pipeline.
Either add a use case or remove it.

---

## Ryan Action Items (Blocking Launch)

| Item | Owner | Status |
|------|-------|--------|
| Add `ANTHROPIC_API_KEY` + `GOOGLE_GENERATIVE_AI_API_KEY` to Render web service | Ryan | Pending |
| Rotate Clerk keys from `pk_test_*` → `pk_live_*` | Ryan | Pending |
| DNS: `app.storymagicapp.net` → `story-magic-web.onrender.com` | Ryan / GoDaddy | Pending |
| Confirm Stripe webhook event list includes `checkout.session.completed` | Ryan | Pending |
