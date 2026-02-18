# 04 - Testing Review

**Project:** Story Magic SaaS Monorepo
**Date:** 2026-02-18
**Reviewer:** Chris Therriault / Claude Code
**Scope:** packages/web (385 tests) + packages/orchestrator (364 tests) = 749 total

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [API Route Coverage Analysis](#api-route-coverage-analysis)
3. [Component Test Coverage Analysis](#component-test-coverage-analysis)
4. [Test Quality Assessment](#test-quality-assessment)
5. [Mock Quality Assessment](#mock-quality-assessment)
6. [E2E Coverage Assessment](#e2e-coverage-assessment)
7. [Orchestrator Test Assessment](#orchestrator-test-assessment)
8. [Findings Summary](#findings-summary)

---

## Executive Summary

The test suite is **solid for a pre-launch MVP** with 749 passing tests across both packages. API route coverage stands at **~31% of routes tested directly** (18 of 58 routes), though a routes-coverage meta-test covers several additional routes. Component coverage is at **~8% of custom components** (5 of ~60). Orchestrator tests are thorough, with strong pipeline integration and mixer tests. The primary gaps are in admin routes, project sub-routes, and E2E flows.

**Overall Test Health: B-** -- Good foundation, but significant gaps in API route and component coverage that should be closed before production launch.

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total tests | 749 | 800+ | Near target |
| API routes tested | 18/58 (31%) | 80%+ | Below target |
| Components tested | 5/60 (8%) | 40%+ | Far below target |
| E2E specs | 6 files | 10+ | Below target |
| Orchestrator coverage | 19 test files | Good | Meets target |

---

## API Route Coverage Analysis

### All 58 API Routes

Below is the complete inventory of API route files cross-referenced with existing tests.

#### TESTED Routes (18 routes with dedicated tests)

| # | Route | Test File | HTTP Methods |
|---|-------|-----------|--------------|
| 1 | `/api/alerts` | `routes-coverage.test.ts` | GET, PATCH |
| 2 | `/api/generate` | `generate-route.test.ts` | POST |
| 3 | `/api/health` | `routes-coverage.test.ts` | GET |
| 4 | `/api/jobs/[id]` | `routes-coverage.test.ts` | GET |
| 5 | `/api/projects` | `projects-route.test.ts` | GET, POST |
| 6 | `/api/projects/[id]` | `projects-route.test.ts` | GET, PATCH, DELETE |
| 7 | `/api/projects/[id]/regenerate-scene` | `regenerate-scene.test.ts` | POST |
| 8 | `/api/reader/library` | `reader-library.test.ts` | GET |
| 9 | `/api/reader/library/[entryId]` | `reader-library.test.ts` | GET, PATCH, DELETE |
| 10 | `/api/reader/library/[entryId]/favorite` | `reader-library.test.ts` | POST |
| 11 | `/api/reader/library/[entryId]/position` | `reader-library.test.ts` | POST |
| 12 | `/api/shares` | `shares.test.ts` | GET, POST |
| 13 | `/api/stripe/checkout` | `stripe-checkout.test.ts` | POST |
| 14 | `/api/stripe/portal` | `routes-coverage.test.ts` + `stripe-checkout.test.ts` | POST |
| 15 | `/api/stripe/webhook` | `stripe-webhook.test.ts` | POST |
| 16 | `/api/teams` | `routes-coverage.test.ts` | GET, POST |

#### UNTESTED Routes (40 routes -- NO dedicated tests)

| # | Route | HTTP Methods | Risk Level | Finding |
|---|-------|--------------|------------|---------|
| 1 | `/api/admin/audit-logs` | GET | HIGH | TST-001 |
| 2 | `/api/admin/corpus/populate` | POST | HIGH | TST-001 |
| 3 | `/api/admin/settings` | GET/PATCH | HIGH | TST-001 |
| 4 | `/api/admin/stats` | GET | HIGH | TST-001 |
| 5 | `/api/admin/subscriptions` | GET | HIGH | TST-001 |
| 6 | `/api/admin/subscriptions/[subscriptionId]` | PATCH/DELETE | HIGH | TST-001 |
| 7 | `/api/admin/users` | GET | HIGH | TST-001 |
| 8 | `/api/admin/users/[userId]` | PATCH/DELETE | HIGH | TST-001 |
| 9 | `/api/audio-preview/[...path]` | GET | MEDIUM | TST-002 |
| 10 | `/api/auth/signout` | POST | LOW | TST-003 |
| 11 | `/api/docs` | GET | LOW | TST-004 |
| 12 | `/api/generate-demo-script` | POST | MEDIUM | TST-005 |
| 13 | `/api/invite/[token]` | GET/POST | MEDIUM | TST-006 |
| 14 | `/api/jobs/[id]/cancel` | POST | MEDIUM | TST-007 |
| 15 | `/api/jobs/[id]/position` | GET | LOW | TST-008 |
| 16 | `/api/preview` | POST | MEDIUM | TST-009 |
| 17 | `/api/projects/[id]/audio-overrides` | GET/POST | MEDIUM | TST-010 |
| 18 | `/api/projects/[id]/comparables` | GET/POST | MEDIUM | TST-011 |
| 19 | `/api/projects/[id]/delete` | POST | MEDIUM | TST-012 |
| 20 | `/api/projects/[id]/export` | GET | MEDIUM | TST-013 |
| 21 | `/api/projects/[id]/feedback` | GET/POST | MEDIUM | TST-014 |
| 22 | `/api/projects/[id]/revisions` | GET/POST | MEDIUM | TST-015 |
| 23 | `/api/projects/[id]/revisions/compare` | GET | LOW | TST-015 |
| 24 | `/api/projects/[id]/score` | GET/POST | MEDIUM | TST-016 |
| 25 | `/api/projects/[id]/suggestions` | GET/POST | MEDIUM | TST-017 |
| 26 | `/api/projects/[id]/suggestions/[suggestionId]` | PATCH/DELETE | MEDIUM | TST-017 |
| 27 | `/api/projects/[id]/suggestions/[suggestionId]/rewrite` | POST | MEDIUM | TST-017 |
| 28 | `/api/projects/[id]/voice-assignments` | GET/POST | MEDIUM | TST-018 |
| 29 | `/api/projects/[id]/workflow-mode` | PATCH | LOW | TST-019 |
| 30 | `/api/queue/status` | GET | MEDIUM | TST-020 |
| 31 | `/api/reader/upload/create-payment` | POST | HIGH | TST-021 |
| 32 | `/api/reader/upload/process` | POST | HIGH | TST-021 |
| 33 | `/api/revisions/[id]` | GET/DELETE | MEDIUM | TST-015 |
| 34 | `/api/revisions/[id]/compare/[toId]` | GET | LOW | TST-015 |
| 35 | `/api/shares/[shareId]` | PATCH/DELETE | MEDIUM | TST-022 |
| 36 | `/api/shares/access/[code]` | GET/POST | MEDIUM | TST-023 |
| 37 | `/api/suggestions/[id]` | PATCH/DELETE | MEDIUM | TST-017 |
| 38 | `/api/suggestions/[id]/rewrite` | POST | MEDIUM | TST-017 |
| 39 | `/api/teams/[teamId]/members` | GET/POST/DELETE | MEDIUM | TST-024 |
| 40 | `/api/teams/share` | POST | MEDIUM | TST-025 |
| 41 | `/api/voices` | GET | LOW | TST-026 |
| 42 | `/api/webhooks/clerk` | POST | HIGH | TST-027 |

---

### Findings: API Route Coverage

#### TST-001 | HIGH | 8 SP | All 8 admin routes completely untested
- **Files:** `packages/web/app/api/admin/audit-logs/route.ts`, `packages/web/app/api/admin/corpus/populate/route.ts`, `packages/web/app/api/admin/settings/route.ts`, `packages/web/app/api/admin/stats/route.ts`, `packages/web/app/api/admin/subscriptions/route.ts`, `packages/web/app/api/admin/subscriptions/[subscriptionId]/route.ts`, `packages/web/app/api/admin/users/route.ts`, `packages/web/app/api/admin/users/[userId]/route.ts`
- **Risk:** Admin routes handle subscription management, user suspension, audit log access, and system settings. No tests verify authorization (admin-only checks), input validation, or error handling. An authorization bypass in admin routes could expose all user data.
- **Recommendation:** Create `packages/web/tests/unit/api/admin-routes.test.ts` covering: (1) 401 for unauthenticated users, (2) 403 for non-admin users, (3) successful operations for admin users, (4) input validation on PATCH/DELETE operations.

#### TST-002 | MEDIUM | 2 SP | Audio preview route untested -- path traversal risk
- **File:** `packages/web/app/api/audio-preview/[...path]/route.ts`
- **Risk:** Catch-all path routes serving files are a classic path traversal vector. No test verifies that `../../etc/passwd` or similar paths are rejected.
- **Recommendation:** Create test covering: (1) valid audio path returns 200, (2) path traversal attempts return 403/400, (3) non-existent files return 404, (4) auth required.

#### TST-005 | MEDIUM | 1 SP | Generate demo script route untested
- **File:** `packages/web/app/api/generate-demo-script/route.ts`
- **Risk:** Likely uses LLM calls. Without tests, no validation that prompt injection defenses or rate limiting apply.
- **Recommendation:** Add basic tests for auth, rate limiting, and response format.

#### TST-021 | HIGH | 3 SP | Reader upload payment/process routes untested
- **Files:** `packages/web/app/api/reader/upload/create-payment/route.ts`, `packages/web/app/api/reader/upload/process/route.ts`
- **Risk:** These routes handle real Stripe payment creation and file upload processing. A bug here could cause payment discrepancies or unauthorized file access.
- **Recommendation:** Create `packages/web/tests/unit/api/reader-upload.test.ts` covering payment intent creation, auth checks, file type validation, and error paths.

#### TST-027 | HIGH | 3 SP | Clerk webhook route untested
- **File:** `packages/web/app/api/webhooks/clerk/route.ts`
- **Risk:** Clerk webhooks handle user creation/deletion/update events. If this route fails silently, user profiles will go out of sync with Clerk. No test verifies signature verification or event handling.
- **Recommendation:** Create `packages/web/tests/unit/api/clerk-webhook.test.ts` mirroring the pattern in `stripe-webhook.test.ts`: (1) signature validation, (2) user.created event, (3) user.updated event, (4) user.deleted event, (5) unknown event graceful handling.

#### TST-022 | MEDIUM | 2 SP | Share management (PATCH/DELETE) untested
- **File:** `packages/web/app/api/shares/[shareId]/route.ts`
- **Risk:** Tests exist for creating and listing shares but not for modifying or revoking them. Share revocation is a security-critical operation for content protection.
- **Recommendation:** Add tests for PATCH (update expiry, access level) and DELETE (revoke share) with auth and ownership checks.

#### TST-023 | MEDIUM | 2 SP | Share access (public endpoint) untested
- **File:** `packages/web/app/api/shares/access/[code]/route.ts`
- **Risk:** This is a publicly accessible endpoint that validates share codes and optionally passwords. Without tests, there is no verification that expired shares, deactivated shares, or incorrect passwords are properly rejected.
- **Recommendation:** Test: (1) valid code returns project info, (2) expired share returns 403, (3) deactivated share returns 404, (4) password-protected share requires correct password.

---

## Component Test Coverage Analysis

### All Custom Components (excluding ui/ primitives)

| # | Component | Has Test? | Finding |
|---|-----------|-----------|---------|
| 1 | `alerts/AlertsDropdown.tsx` | No | TST-028 |
| 2 | `auth/sign-out-button.tsx` | No | TST-028 |
| 3 | `comparable/ComparableCard.tsx` | No | TST-028 |
| 4 | `comparable/ComparableSection.tsx` | No | TST-028 |
| 5 | `dashboard/reader-dashboard-client.tsx` | No | TST-029 |
| 6 | `dashboard/reader-script-card.tsx` | No | TST-029 |
| 7 | `dashboard/share-modal.tsx` | No | TST-029 |
| 8 | `dashboard/subscription-card.tsx` | No | TST-029 |
| 9 | `dashboard/writer-dashboard-client.tsx` | No | TST-029 |
| 10 | `dashboard/writer-script-card.tsx` | **Yes** | -- |
| 11 | `docs/swagger-ui.tsx` | No | -- (low priority) |
| 12 | `feedback/FeedbackModal.tsx` | No | TST-030 |
| 13 | `player/protected-player.tsx` | No | TST-031 |
| 14 | `player/ScriptSyncPlayer.tsx` | No | TST-031 |
| 15 | `reader/ScriptReadStatus.tsx` | No | TST-032 |
| 16 | `reader/upload-client.tsx` | No | TST-032 |
| 17 | `revisions/DiffView.tsx` | No | TST-033 |
| 18 | `revisions/RevisionSection.tsx` | No | TST-033 |
| 19 | `revisions/RevisionTimeline.tsx` | No | TST-033 |
| 20 | `revisions/ScoreTrajectoryChart.tsx` | No | TST-033 |
| 21 | `script-editor/ScriptEditor.tsx` | No | TST-034 |
| 22 | `script-editor/ScriptEditorSection.tsx` | No | TST-034 |
| 23 | `story-adviser/RewriteModal.tsx` | No | TST-035 |
| 24 | `story-adviser/ScriptAnnotator.tsx` | No | TST-035 |
| 25 | `story-adviser/StoryAdviser.tsx` | No | TST-035 |
| 26 | `story-adviser/StoryAdviserSection.tsx` | No | TST-035 |
| 27 | `story-adviser/SuggestionCard.tsx` | No | TST-035 |
| 28 | `story-adviser/SuggestionPanel.tsx` | No | TST-035 |
| 29 | `storyscore/ExportButton.tsx` | No | TST-036 |
| 30 | `storyscore/StoryScore.tsx` | No | TST-036 |
| 31 | `storyscore/StoryScoreSection.tsx` | No | TST-036 |
| 32 | `theme-provider.tsx` | No | -- (low priority) |
| 33 | `theme-toggle.tsx` | **Yes** | -- |
| 34 | `wizard/ScriptImprovementWizard.tsx` | No | TST-037 |
| 35 | `wizard/Wizard.tsx` | No | TST-037 |

### Project Page Components (app/projects/[id]/)

| # | Component | Has Test? | Finding |
|---|-----------|-----------|---------|
| 1 | `audio-chooser.tsx` | No | TST-038 |
| 2 | `audio-player.tsx` | **Yes** | -- |
| 3 | `delete-button.tsx` | No | TST-038 |
| 4 | `generate-button.tsx` | No | TST-038 |
| 5 | `improvement-wizard-button.tsx` | No | TST-038 |
| 6 | `preview-button.tsx` | No | TST-038 |
| 7 | `project-workflow.tsx` | No | TST-039 |
| 8 | `run-comparison.tsx` | No | TST-039 |
| 9 | `run-history.tsx` | No | TST-039 |
| 10 | `run-selector.tsx` | No | TST-039 |
| 11 | `storygraph.tsx` | No | TST-039 |
| 12 | `voice-chooser.tsx` | No | TST-040 |
| 13 | `workflow-mode-selector.tsx` | No | TST-040 |

**Tested component tests:** `audio-player.test.tsx`, `login-form.test.tsx`, `mobile-nav.test.tsx`, `theme-toggle.test.tsx`, `writer-script-card.test.tsx` (5 files)

### Findings: Component Coverage

#### TST-028 | MEDIUM | 3 SP | No tests for alerts and auth components
- **Files:** `packages/web/components/alerts/AlertsDropdown.tsx`, `packages/web/components/auth/sign-out-button.tsx`
- **Risk:** AlertsDropdown has real-time data fetching and state management. Sign-out button triggers a critical auth flow.
- **Recommendation:** Add component tests for AlertsDropdown (renders alerts, marks as read, handles empty state) and sign-out-button (calls Clerk signOut, shows loading state).

#### TST-029 | MEDIUM | 5 SP | Dashboard components untested (5 components)
- **Files:** `packages/web/components/dashboard/reader-dashboard-client.tsx`, `reader-script-card.tsx`, `share-modal.tsx`, `subscription-card.tsx`, `writer-dashboard-client.tsx`
- **Risk:** These are the primary user-facing surfaces. The writer-script-card has tests, but the dashboard clients that orchestrate them do not. The share-modal handles share link generation -- a core feature.
- **Recommendation:** Prioritize `share-modal.tsx` (handles copying links, password toggle) and `subscription-card.tsx` (shows plan limits, upgrade CTA).

#### TST-031 | MEDIUM | 3 SP | Audio player components untested
- **Files:** `packages/web/components/player/protected-player.tsx`, `packages/web/components/player/ScriptSyncPlayer.tsx`
- **Risk:** The protected-player likely enforces DRM/access restrictions. ScriptSyncPlayer synchronizes audio playback with script text -- the core product differentiator.
- **Recommendation:** Test protected-player access control logic (blocks unauthorized playback). Test ScriptSyncPlayer text highlighting sync.

#### TST-034 | MEDIUM | 3 SP | Script editor components untested
- **Files:** `packages/web/components/script-editor/ScriptEditor.tsx`, `ScriptEditorSection.tsx`
- **Risk:** The script editor handles text input for the entire screenplay. No tests verify content preservation, auto-save, or input sanitization.
- **Recommendation:** Add tests for rendering with content, onChange callbacks, and large content handling.

#### TST-035 | MEDIUM | 5 SP | Story Adviser feature entirely untested (6 components)
- **Files:** `packages/web/components/story-adviser/RewriteModal.tsx`, `ScriptAnnotator.tsx`, `StoryAdviser.tsx`, `StoryAdviserSection.tsx`, `SuggestionCard.tsx`, `SuggestionPanel.tsx`
- **Risk:** This is a major feature with complex LLM-driven UI. Zero component tests despite having 3 related API routes also untested.
- **Recommendation:** Start with SuggestionCard and SuggestionPanel (render suggestions, accept/reject actions), then StoryAdviser (fetches and displays suggestions list).

#### TST-038 | MEDIUM | 3 SP | Project page action buttons untested
- **Files:** `packages/web/app/projects/[id]/delete-button.tsx`, `generate-button.tsx`, `preview-button.tsx`, `improvement-wizard-button.tsx`, `audio-chooser.tsx`
- **Risk:** These buttons trigger destructive (delete) and expensive (generate) operations. No tests verify confirmation dialogs, loading states, or error handling.
- **Recommendation:** Prioritize delete-button (must show confirmation dialog) and generate-button (must show loading state, handle quota errors).

---

## Test Quality Assessment

### Files Reviewed

| Test File | Tests | Quality | Notes |
|-----------|-------|---------|-------|
| `routes-coverage.test.ts` | 25 | **A** | Comprehensive: auth, validation, happy path, edge cases |
| `stripe-webhook.test.ts` | 11 | **A-** | Good event coverage, tests signature verification |
| `shares.test.ts` | 11 | **A** | Excellent: UUID validation, password hashing, ownership checks |
| `generate-route.test.ts` | 8 | **A** | Tests CSRF, prompt injection sanitization, page limits |
| `projects-route.test.ts` | 11 | **B+** | Covers CRUD well, but missing concurrent update tests |
| `reader-library.test.ts` | 10 | **B+** | Good coverage, but missing auth on PATCH/DELETE/favorite/position |
| `stripe-checkout.test.ts` | 11 | **A** | Tests all tier/interval combinations, error paths |
| `regenerate-scene.test.ts` | 8 | **A-** | Good scene-index validation, queue integration |

### Findings: Test Quality

#### TST-041 | MEDIUM | 2 SP | Shallow assertion in health check test
- **File:** `/packages/web/tests/unit/api/routes-coverage.test.ts`, line 655-658
- **Code:**
  ```typescript
  expect(data.status).toBeDefined();
  expect(data.timestamp).toBeDefined();
  expect(data.version).toBeDefined();
  ```
- **Issue:** Using `toBeDefined()` only verifies the property exists, not that it has a meaningful value. `data.status` could be `""` or `null` and still pass.
- **Recommendation:** Replace with value assertions: `expect(data.status).toBe('healthy')`, `expect(typeof data.version).toBe('string')`, `expect(data.timestamp).toMatch(/^\d{4}-/)`.

#### TST-042 | MEDIUM | 2 SP | Reader library PATCH/DELETE/favorite/position tests missing auth checks
- **File:** `/packages/web/tests/unit/api/reader-library.test.ts`
- **Issue:** The PATCH, DELETE, favorite, and position describe blocks do not include "returns 401 when not authenticated" tests. Only the GET /api/reader/library and GET /api/reader/library/[entryId] have explicit auth checks. The remaining 4 endpoints assume auth works but never verify it.
- **Recommendation:** Add `it('returns 401 when not authenticated', ...)` to each describe block for PATCH, DELETE, favorite, and position routes.

#### TST-043 | LOW | 1 SP | Stripe webhook error handling test may be misleading
- **File:** `/packages/web/tests/unit/api/stripe-webhook.test.ts`, lines 319-332
- **Code:**
  ```typescript
  it('should return 500 on unexpected errors', async () => {
    mockConstructWebhookEvent.mockImplementation(() => {
      throw new TypeError('Unexpected error');
    });
    // ...
    expect(response.status).toBe(400); // Comment says 500, assertion says 400
  });
  ```
- **Issue:** The test description says "should return 500 on unexpected errors" but the assertion checks for status 400. Either the test description is wrong (it is testing signature errors which return 400) or the assertion is wrong (it should be checking for 500).
- **Recommendation:** Fix the test description to "should return 400 when constructWebhookEvent throws" OR add a separate test that mocks an error after event construction to verify the 500 path.

#### TST-044 | LOW | 1 SP | No concurrent access/race condition tests for projects
- **File:** `/packages/web/tests/unit/api/projects-route.test.ts`
- **Issue:** Project PATCH/DELETE tests verify single-request flows but do not test what happens when two users try to update the same project simultaneously, or when a project is deleted while a job is running.
- **Recommendation:** Add a test that verifies Prisma's findFirst + update pattern handles the case where the project is deleted between the two calls (Prisma update should throw, route should return 404/500).

---

## Mock Quality Assessment

### Setup File: `packages/web/tests/setup.ts`

**Overall Grade: B+**

#### Strengths
1. **Clerk mocks are realistic.** Both server-side `auth()` and client-side `useUser()`/`useAuth()` hooks are mocked with correct return shapes including `userId`, `isSignedIn`, `isLoaded`.
2. **Prisma mock covers 10 models** (project, profile, job, alert, team, teamMember, usage, storyScore, audioOutput, plus `$queryRaw`).
3. **MSW server** is properly initialized with `onUnhandledRequest: 'error'` (strict mode), ensuring no unhandled requests slip through.
4. **Environment variables** are stubbed with `vi.stubEnv()` -- avoids polluting `process.env`.

#### TST-045 | MEDIUM | 2 SP | Prisma mock missing 13 of 23 models
- **File:** `/packages/web/tests/setup.ts`, lines 51-93
- **Issue:** The global Prisma mock only covers 10 models: `project`, `profile`, `job`, `alert`, `team`, `teamMember`, `usage`, `storyScore`, `audioOutput`, and `$queryRaw`. Missing models: `Subscription`, `ScriptShare`, `ReaderLibrary`, `Purchase`, `ContentAccessLog`, `TeamShare`, `AlertPreference`, `Revision`, `AudioOutput` (partially there), `ScriptCorpus`, `AuditLog`, `AdminSetting`, `Taxonomy`. Individual test files re-mock `@/lib/db` anyway, but any test relying on the global setup that touches a missing model will get `TypeError: Cannot read properties of undefined`.
- **Recommendation:** Either (a) add the missing models to the global mock, or (b) document that all API route tests must provide their own Prisma mock (the current pattern). Option (b) is the current de facto standard and is acceptable, but should be made explicit.

### Setup File: `packages/web/tests/setup-unit.ts`

**Overall Grade: B**

#### TST-046 | LOW | 1 SP | setup-unit.ts disables rate limiting globally
- **File:** `/packages/web/tests/setup-unit.ts`, line 9
- **Code:** `vi.stubEnv('RATE_LIMIT_DISABLED', 'true');`
- **Issue:** Rate limiting is disabled across all unit tests. This means no test verifies that rate limiting works correctly on routes. The dedicated `rate-limit.test.ts` presumably tests the rate limit library itself, but no integration test verifies it is correctly wired into routes.
- **Recommendation:** Add one test per critical route category (auth, generate, checkout) that runs WITH rate limiting enabled and verifies 429 after threshold.

### MSW Handlers: `packages/web/tests/mocks/handlers.ts`

**Overall Grade: B+**

#### TST-047 | LOW | 1 SP | MSW handlers always return success -- no error path mocking
- **File:** `/packages/web/tests/mocks/handlers.ts`
- **Issue:** All 15 MSW handlers return 200/success responses. There are no handlers that simulate server errors, validation errors, or network failures. Component tests using these handlers will only exercise happy paths.
- **Recommendation:** Add error variant handlers (e.g., `createMockErrorHandlers()`) that return 400/500 for use in component tests that need to verify error state rendering.

---

## E2E Coverage Assessment

### E2E Test Files Found

| File | Coverage |
|------|----------|
| `e2e/auth.setup.ts` | Auth state persistence for authenticated tests |
| `e2e/auth.spec.ts` | Login form, signup form, validation (5 tests) |
| `e2e/dashboard.spec.ts` | Unauthenticated redirect (1 test) |
| `e2e/dashboard.authenticated.spec.ts` | Authenticated dashboard flows |
| `e2e/project.spec.ts` | Unauthenticated project access |
| `e2e/project.authenticated.spec.ts` | Authenticated project flows |
| `e2e/fixtures/test-script.ts` | Test data for E2E scripts |

### Findings: E2E Coverage

#### TST-048 | HIGH | 5 SP | No E2E test for the generate-to-playback flow
- **Missing File:** `packages/web/e2e/generate-flow.spec.ts`
- **Issue:** The primary user journey -- uploading a script, generating audio, and playing it back -- has no end-to-end coverage. This is the core product flow and the most likely to break during refactors.
- **Recommendation:** Create a smoke E2E test that: (1) logs in, (2) navigates to a project, (3) clicks generate, (4) waits for job completion (mock orchestrator response), (5) verifies audio player appears.

#### TST-049 | MEDIUM | 3 SP | No E2E test for Stripe checkout flow
- **Missing File:** `packages/web/e2e/billing.spec.ts`
- **Issue:** No E2E test verifies the pricing page -> checkout -> billing portal flow. Stripe integration is tested at the unit level but not at the browser level where redirect handling, webhook callback, and session persistence all interact.
- **Recommendation:** Create E2E test that verifies: (1) pricing page renders plans, (2) clicking subscribe redirects to Stripe (mock), (3) billing portal link works.

#### TST-050 | MEDIUM | 2 SP | No E2E test for share/reader flow
- **Missing File:** `packages/web/e2e/share-flow.spec.ts`
- **Issue:** The writer-shares-script-to-reader flow is a core user journey with no E2E coverage. This flow involves creating a share link, the reader accessing it, and optionally entering a password.
- **Recommendation:** Create E2E test for: (1) writer creates share from project page, (2) share URL is accessible, (3) password-protected share requires password.

---

## Orchestrator Test Assessment

### Test Files Reviewed

| File | Tests | Quality | Coverage |
|------|-------|---------|----------|
| `director/pipeline.test.ts` | 18 | **A** | Full pipeline: happy path, voice overrides, validation, multi-scene |
| `orchestrator/workers/mixer.test.ts` | 28 | **A+** | Exceptional: dialogue chain, ducking, looping, SFX timing, LUFS, error handling |
| `__tests__/integration/pipeline-integration.test.ts` | 15 | **A** | Full Director-to-Orchestrator data flow |

### Additional Orchestrator Test Files (not fully reviewed)

| File | Purpose |
|------|---------|
| `director/embeddings/embedding-store.test.ts` | Voice embedding storage |
| `director/tools/hybrid-voice-search.test.ts` | Voice search matching |
| `director/validation/audio-validator.test.ts` | Audio JSON validation |
| `director/validation/director-validator.test.ts` | Director JSON validation |
| `lib/catalog-loader.test.ts` | Audio catalog loading |
| `lib/ffmpeg-validator.test.ts` | FFmpeg filtergraph validation |
| `lib/idempotency.test.ts` | Job idempotency |
| `lib/retry.test.ts` | Retry logic |
| `orchestrator/pipeline.test.ts` | Orchestrator pipeline |
| `orchestrator/workers/align.test.ts` | Alignment worker |
| `orchestrator/workers/cues.test.ts` | Cue selection |
| `orchestrator/workers/timeline.test.ts` | Timeline building |
| `orchestrator/workers/timeline-validator.test.ts` | Timeline validation |
| `orchestrator/workers/tts.test.ts` | TTS generation |
| `routes/health.test.ts` | Health endpoint |
| `schemas/director-json.test.ts` | Zod schema validation |

### Findings: Orchestrator Tests

#### TST-051 | LOW | 1 SP | Integration test SFX line reference resolution is shallow
- **File:** `/packages/orchestrator/src/__tests__/integration/pipeline-integration.test.ts`, lines 557-569
- **Code:**
  ```typescript
  it('resolves SFX line_id references via alignment in the orchestrator', async () => {
    // ...
    expect(mixCall.inputs).toHaveProperty('dialogue');
  });
  ```
- **Issue:** The test claims to verify SFX line_id reference resolution but only asserts that `dialogue` exists in the mix inputs. It never verifies that the SFX timing was actually resolved from the alignment data.
- **Recommendation:** Assert that `mixCall.inputs.sfx` contains resolved timestamps based on alignment line start times, not just that dialogue is present.

#### TST-052 | LOW | 2 SP | No orchestrator test for FFmpeg failure during loudness normalization
- **File:** `/packages/orchestrator/src/orchestrator/workers/mixer.test.ts`
- **Issue:** The mixer tests cover FFmpeg mix failure and filtergraph validation failure, but do not test what happens when the loudness normalization (two-pass loudnorm) fails independently. If the measurement pass returns unparseable JSON, the mixer behavior is untested.
- **Recommendation:** Add a test where the loudnorm measurement pass returns invalid/empty JSON and verify graceful error handling.

#### TST-053 | LOW | 1 SP | No orchestrator test for TTS API rate limit/failure
- **Missing coverage in:** `/packages/orchestrator/src/orchestrator/workers/tts.test.ts`
- **Issue:** TTS is the most expensive external API call. No test verifies behavior when ElevenLabs returns 429 (rate limited) or 503 (service unavailable). The retry library has its own tests, but the TTS worker's integration with retry is unverified.
- **Recommendation:** Add tests for: (1) TTS 429 triggers retry, (2) TTS 503 triggers retry, (3) permanent failure after max retries propagates error correctly.

---

## Findings Summary

### HIGH Severity

| ID | SP | Description | File |
|----|----|-------------|------|
| TST-001 | 8 | All 8 admin routes completely untested -- no auth/authz verification | `packages/web/app/api/admin/*/route.ts` |
| TST-021 | 3 | Reader upload payment/process routes untested -- handles real Stripe payments | `packages/web/app/api/reader/upload/*/route.ts` |
| TST-027 | 3 | Clerk webhook route untested -- user sync depends on it | `packages/web/app/api/webhooks/clerk/route.ts` |
| TST-048 | 5 | No E2E test for generate-to-playback flow -- the core product journey | Missing `e2e/generate-flow.spec.ts` |

### MEDIUM Severity

| ID | SP | Description | File |
|----|----|-------------|------|
| TST-002 | 2 | Audio preview catch-all route untested -- path traversal risk | `packages/web/app/api/audio-preview/[...path]/route.ts` |
| TST-005 | 1 | Generate demo script route untested | `packages/web/app/api/generate-demo-script/route.ts` |
| TST-006 | 1 | Invite token route untested | `packages/web/app/api/invite/[token]/route.ts` |
| TST-007 | 1 | Job cancel route untested | `packages/web/app/api/jobs/[id]/cancel/route.ts` |
| TST-010 | 1 | Audio overrides route untested | `packages/web/app/api/projects/[id]/audio-overrides/route.ts` |
| TST-011 | 1 | Comparables route untested | `packages/web/app/api/projects/[id]/comparables/route.ts` |
| TST-013 | 1 | Export route untested | `packages/web/app/api/projects/[id]/export/route.ts` |
| TST-014 | 1 | Feedback route untested | `packages/web/app/api/projects/[id]/feedback/route.ts` |
| TST-015 | 3 | Revisions routes untested (4 related routes) | `packages/web/app/api/projects/[id]/revisions/route.ts` |
| TST-016 | 1 | Score route untested | `packages/web/app/api/projects/[id]/score/route.ts` |
| TST-017 | 3 | Suggestions routes untested (5 related routes) | `packages/web/app/api/projects/[id]/suggestions/*/route.ts` |
| TST-018 | 1 | Voice assignments route untested | `packages/web/app/api/projects/[id]/voice-assignments/route.ts` |
| TST-020 | 1 | Queue status route untested | `packages/web/app/api/queue/status/route.ts` |
| TST-022 | 2 | Share PATCH/DELETE untested -- revocation is security-critical | `packages/web/app/api/shares/[shareId]/route.ts` |
| TST-023 | 2 | Share access (public endpoint) untested | `packages/web/app/api/shares/access/[code]/route.ts` |
| TST-024 | 2 | Team members route untested | `packages/web/app/api/teams/[teamId]/members/route.ts` |
| TST-025 | 1 | Team share route untested | `packages/web/app/api/teams/share/route.ts` |
| TST-028 | 3 | Alerts and auth components untested | `packages/web/components/alerts/`, `components/auth/` |
| TST-029 | 5 | Dashboard components untested (5 of 6) | `packages/web/components/dashboard/` |
| TST-031 | 3 | Protected player and ScriptSyncPlayer untested | `packages/web/components/player/` |
| TST-034 | 3 | Script editor components untested | `packages/web/components/script-editor/` |
| TST-035 | 5 | Story Adviser feature entirely untested (6 components) | `packages/web/components/story-adviser/` |
| TST-038 | 3 | Project page action buttons untested | `packages/web/app/projects/[id]/delete-button.tsx` et al. |
| TST-041 | 2 | Shallow toBeDefined assertions in health check test | `tests/unit/api/routes-coverage.test.ts:655` |
| TST-042 | 2 | Missing auth checks on 4 reader library sub-endpoints | `tests/unit/api/reader-library.test.ts` |
| TST-045 | 2 | Prisma mock missing 13 of 23 models in global setup | `tests/setup.ts:51` |
| TST-049 | 3 | No E2E test for Stripe checkout flow | Missing `e2e/billing.spec.ts` |
| TST-050 | 2 | No E2E test for share/reader flow | Missing `e2e/share-flow.spec.ts` |

### LOW Severity

| ID | SP | Description | File |
|----|----|-------------|------|
| TST-003 | 1 | Auth signout route untested | `packages/web/app/api/auth/signout/route.ts` |
| TST-004 | 1 | Docs route untested | `packages/web/app/api/docs/route.ts` |
| TST-008 | 1 | Job position route untested | `packages/web/app/api/jobs/[id]/position/route.ts` |
| TST-009 | 1 | Preview route untested | `packages/web/app/api/preview/route.ts` |
| TST-012 | 1 | Project delete route untested (separate from [id] DELETE) | `packages/web/app/api/projects/[id]/delete/route.ts` |
| TST-019 | 1 | Workflow mode route untested | `packages/web/app/api/projects/[id]/workflow-mode/route.ts` |
| TST-026 | 1 | Voices route untested | `packages/web/app/api/voices/route.ts` |
| TST-030 | 2 | FeedbackModal component untested | `packages/web/components/feedback/FeedbackModal.tsx` |
| TST-032 | 2 | Reader components untested | `packages/web/components/reader/` |
| TST-033 | 3 | Revisions components untested (4 components) | `packages/web/components/revisions/` |
| TST-036 | 2 | StoryScore components untested | `packages/web/components/storyscore/` |
| TST-037 | 2 | Wizard components untested | `packages/web/components/wizard/` |
| TST-039 | 3 | Project workflow/history components untested | `packages/web/app/projects/[id]/project-workflow.tsx` et al. |
| TST-040 | 2 | Voice/workflow choosers untested | `packages/web/app/projects/[id]/voice-chooser.tsx` |
| TST-043 | 1 | Misleading test description in webhook error test | `tests/unit/api/stripe-webhook.test.ts:319` |
| TST-044 | 1 | No concurrent access tests for projects | `tests/unit/api/projects-route.test.ts` |
| TST-046 | 1 | Rate limiting disabled globally in unit tests | `tests/setup-unit.ts:9` |
| TST-047 | 1 | MSW handlers only return success responses | `tests/mocks/handlers.ts` |
| TST-051 | 1 | Integration test SFX assertion is shallow | `orchestrator/src/__tests__/integration/pipeline-integration.test.ts:557` |
| TST-052 | 2 | No test for loudness normalization parse failure | `orchestrator/src/orchestrator/workers/mixer.test.ts` |
| TST-053 | 1 | No TTS rate limit/failure test | `orchestrator/src/orchestrator/workers/tts.test.ts` |

### Total Story Points by Severity

| Severity | Count | Story Points |
|----------|-------|-------------|
| HIGH | 4 | 19 SP |
| MEDIUM | 28 | 57 SP |
| LOW | 21 | 30 SP |
| **Total** | **53** | **106 SP** |

### Recommended Priority Order for Pre-Launch

1. **TST-001** (8 SP) -- Admin routes: authorization bypass risk
2. **TST-027** (3 SP) -- Clerk webhook: user sync critical path
3. **TST-021** (3 SP) -- Reader upload payments: revenue path
4. **TST-002** (2 SP) -- Audio preview path traversal: security
5. **TST-048** (5 SP) -- Core E2E flow: catch integration regressions
6. **TST-022** (2 SP) -- Share revocation: content protection
7. **TST-023** (2 SP) -- Public share access: content protection
8. **TST-042** (2 SP) -- Reader library auth gaps: quick fix

These 8 items total **27 SP** and address the most critical security and revenue risks.
