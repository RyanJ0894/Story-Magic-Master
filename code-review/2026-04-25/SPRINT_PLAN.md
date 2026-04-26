# Sprint Plan — Story Magic
**Date:** 2026-04-25
**Based on:** code-review/2026-04-25/ + docs/ROADMAP-2026-04-02.md
**Total remaining:** ~15.5 SP across 2 sprints + Ryan actions

---

## Product Completion Status

| Area | Status | Notes |
|------|--------|-------|
| Core features | 93% complete | 4 PARTIAL (tests only, code works) |
| Test coverage | 72 suites / 1,204 tests | 3 low-risk modules untested |
| Security | ✅ 0 open issues | All CRITICAL/HIGH resolved this session |
| Tech debt | 15.5 SP | 0 CRITICAL, 0 HIGH, 3 MEDIUM, 3 LOW |

---

## Sprint 1: Test Coverage Completion (~10 SP, ~1 week)

**Goal:** Every production-traffic route and service has at least smoke-level unit tests.

**Definition of Done:**
- [ ] `voice-assignments`, `workflow-mode`, `audio-overrides` tests written (TD-044)
- [ ] `comparable/index.ts` tests written (TD-045 partial)
- [ ] `adviser/index.ts` tests written (TD-045 partial)
- [ ] `teams/members` route tests written (TD-046)
- [ ] Total tests ≥ 1,220
- [ ] TypeScript: 0 errors

**Items:**

| ID | Title | SP | Files |
|----|-------|----|-------|
| TD-044 | voice-assignments, workflow-mode, audio-overrides tests | 3 | `voice-assignments/route.ts`, `workflow-mode/route.ts`, `audio-overrides/route.ts` |
| TD-045 | comparable + adviser service tests | 5 | `lib/comparable/index.ts`, `lib/adviser/index.ts` |
| TD-046 | teams/members route tests | 2 | `teams/[teamId]/members/route.ts` |

**Total: 10 SP**

**Sprint notes:** All three items follow established mock patterns. Teams/members is straightforward
(`withAuth` mock + `TeamServiceError` propagation). Comparable/adviser require mocking the
OpenAI/embedding APIs but the pattern is established in `script-score-service.test.ts`.

---

## Sprint 2: Low-Priority Cleanup (~5 SP, deferred)

**Goal:** Remove dead code, unify default voice constants, document referral code config.

**Definition of Done:**
- [ ] TD-047 documented in `.env.local.example`
- [ ] TD-048 `director-validator.ts` imports defaults from schema
- [ ] TD-049 `generateSimpleText` removed or given a use case
- [ ] No regressions (tests still green)

**Items:**

| ID | Title | SP | Files |
|----|-------|----|-------|
| TD-047 | Document `REFERRAL_CODES` env var override | 0.5 | `.env.local.example` |
| TD-048 | `director-validator.ts` — import defaults from schema | 1 | `director-validator.ts:16-18` |
| TD-049 | Remove or use `generateSimpleText` | 0.5 | `lib/llm-client.ts:276` |

**Total: ~2 SP** (estimate low — these are micro-tasks)

---

## Ryan Actions (Blocking Production Launch)

These are not dev tasks but block the real launch:

| Priority | Action | Notes |
|----------|--------|-------|
| CRITICAL | Add `ANTHROPIC_API_KEY` + `GOOGLE_GENERATIVE_AI_API_KEY` to Render | StoryScore and corpus scoring disabled without these |
| CRITICAL | Rotate Clerk keys to production (`pk_live_*`) | Test keys still in Render; real users can't auth |
| HIGH | DNS: `app.storymagicapp.net` → `story-magic-web.onrender.com` | Custom domain not active |
| MEDIUM | Confirm Stripe webhook `checkout.session.completed` is in event list | Billing won't activate without this |

---

## Backlog (No Sprint)

| ID | Title | SP | Why Deferred |
|----|-------|----|-------------|
| — | Admin CRUD tests (11 routes) | 8 | Low risk, low traffic, admin-only |
| — | Story Adviser full multi-step UI | 5 | Backend complete; frontend nice-to-have |
| — | Voice marketplace placeholder | 1 | Marketing only, no logic |
| — | R2 storage integration tests | 5 | Requires R2 credentials in CI |
| — | Long-form script support (>120 pages) | 8 | Architectural; post-launch |
| — | SOC 2 / multi-tenancy hardening | 13 | Enterprise phase |

---

## Completion Forecast

| Sprint | SP | Tests After | State |
|--------|-----|-------------|-------|
| Sprint 1 | 10 | ~1,220 | All production routes tested |
| Sprint 2 | 2 | ~1,220 | Tech debt cleared |
| Ryan actions | — | — | Launch-ready |

---

## Key Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Ryan Clerk key rotation not done before real users | Users can't authenticate | Chris to remind; blocked on Ryan |
| Comparable/adviser mock complexity underestimated | Sprint 1 bleeds | Can stub with simpler mocks; accept partial coverage |
| Orchestrator on Render Starter tier ($7/mo) | Memory limits for 120-page scripts | Monitor; upgrade to Standard if needed |

---

*Generated: 2026-04-25. Successor to: [SPRINT_PLAN 2026-04-19](../2026-04-19/SPRINT_PLAN.md)*
