# Testing Review -- Story Magic

**Date:** 2026-02-15
**Branch:** `feat/clerk-prisma-migration`
**Reviewer:** Chris Therriault (chris@servicevision.net)
**Scope:** Test infrastructure, coverage, and quality across both packages

---

## Executive Summary

Story Magic reports 642 tests (364 orchestrator + 278 web). The web package has a well-organized three-tier test strategy (unit, component, E2E) with recently rewritten setup files for the Clerk+Prisma migration. The orchestrator has 19 test files covering the critical audio pipeline. The main gaps are: (a) only 6 of 58 API routes have dedicated test files, (b) only 5 of 60 components have test files, (c) zero page-level tests, and (d) MSW mock handlers are stale (still use snake_case from the Supabase era).

**Overall Grade: B-**

---

## 1. Test Distribution

### TST-001 -- Web package: 25 test files across 3 tiers

| Tier | Count | Files |
|------|-------|-------|
| Unit/lib | 14 | `tests/unit/lib/` -- voice-scoring, feedback, scoring, audio-scoring, queue, dto, rate-limit, revisions, suggestions, csrf, request-limits, comparable, password, logger |
| Unit/api | 6 | `tests/unit/api/` -- regenerate-scene, stripe-webhook, projects-route, reader-library, generate-route, shares |
| Component | 5 | `tests/component/` -- theme-toggle, mobile-nav, login-form, writer-script-card, audio-player |
| E2E | 5 | `e2e/` -- auth, project.authenticated, dashboard.authenticated, dashboard, project |
| Setup/Mock | 5 | setup.ts, setup-unit.ts, setup-component.tsx, mocks/handlers.ts, mocks/server.ts |

### TST-002 -- Orchestrator package: 19 test files

| Area | Count | Files |
|------|-------|-------|
| Director pipeline | 1 | `src/director/pipeline.test.ts` |
| Director tools | 1 | `src/director/tools/hybrid-voice-search.test.ts` |
| Director validation | 2 | `src/director/validation/audio-validator.test.ts`, `director-validator.test.ts` |
| Director embeddings | 1 | `src/director/embeddings/embedding-store.test.ts` |
| Schemas | 1 | `src/schemas/director-json.test.ts` |
| Lib utilities | 4 | retry, idempotency, catalog-loader, ffmpeg-validator |
| Routes | 1 | `src/routes/health.test.ts` |
| Pipeline | 1 | `src/orchestrator/pipeline.test.ts` |
| Workers | 6 | cues, align, mixer, tts, timeline, timeline-validator |
| Integration | 1 | `src/__tests__/integration/pipeline-integration.test.ts` |

The 364 tests from 19 files means an average of ~19 tests per file, indicating thorough per-module coverage in the orchestrator.

### TST-003 -- Coverage gap: 52 of 58 API routes have no dedicated tests

**Tested API routes (6/58):**
- `/api/projects` (CRUD) -- `tests/unit/api/projects-route.test.ts`
- `/api/generate` -- `tests/unit/api/generate-route.test.ts`
- `/api/projects/[id]/regenerate-scene` -- `tests/unit/api/regenerate-scene.test.ts`
- `/api/stripe/webhook` -- `tests/unit/api/stripe-webhook.test.ts`
- `/api/reader/library/*` -- `tests/unit/api/reader-library.test.ts`
- `/api/shares` -- `tests/unit/api/shares.test.ts`

**Untested API routes (52/58) -- notable gaps:**
- `/api/teams` (GET, POST) -- Team management
- `/api/alerts` (GET, PATCH) -- Notification system
- `/api/stripe/checkout` -- Payment initiation
- `/api/stripe/portal` -- Subscription management
- `/api/admin/*` (6 routes) -- Admin dashboard
- `/api/projects/[id]/score` -- StoryScore generation
- `/api/projects/[id]/suggestions` -- Story-Adviser
- `/api/projects/[id]/voice-assignments` -- Voice casting
- `/api/projects/[id]/audio-overrides` -- Audio customization
- `/api/projects/[id]/workflow-mode` -- Mode selection
- `/api/invite/[token]` -- Team invitations
- `/api/queue/status` -- Queue monitoring
- `/api/jobs/[id]/*` (3 routes) -- Job management
- `/api/voices` -- ElevenLabs voice listing
- `/api/preview` -- Audio preview generation
- `/api/revisions/*` (3 routes) -- Revision management
- `/api/suggestions/[id]/*` (2 routes) -- Suggestion management

**Severity: High** -- Core revenue paths (Stripe checkout, subscription portal) and security-sensitive routes (admin, teams, invites) lack test coverage. The routes using `withAuth`/`withProjectAuth` middleware have some indirect coverage through middleware's own behavior, but edge cases (invalid UUIDs, concurrent requests, rate limit boundaries) are not verified.

### TST-004 -- Coverage gap: 55 of 60 components untested

**Tested components (5/60):**
- `theme-toggle` -- Theme switching
- `mobile-nav` -- Mobile navigation
- `login-form` -- Authentication form
- `writer-script-card` -- Script card display
- `audio-player` -- Audio playback UI

**Untested components (55/60) -- notable gaps:**
- `project-workflow.tsx` -- The main project page orchestrator (400+ lines)
- `voice-chooser.tsx` -- Voice assignment UI
- `audio-chooser.tsx` -- Audio selection UI
- `generate-button.tsx` -- Generation trigger
- `run-selector.tsx`, `run-history.tsx`, `run-comparison.tsx` -- Multi-run management
- `improvement-wizard-button.tsx` -- StoryScore improvement flow
- All `components/ui/` shadcn components (these are third-party, testing is optional)

**Severity: Medium** -- The E2E tests provide some coverage for critical user flows, but component-level edge cases (error states, loading states, empty states) are not verified.

### TST-005 -- Zero page-level tests

None of the 26 page components (`app/**/page.tsx`) have dedicated tests. Key untested pages:
- `app/projects/[id]/page.tsx` -- The main project detail page (server component with Prisma queries)
- `app/dashboard/page.tsx` -- User dashboard
- `app/admin/*` -- Admin pages
- `app/reader/*` -- Reader experience pages
- `app/pricing/page.tsx` -- Pricing display

**Severity: Medium** -- Server component pages contain Prisma queries and auth checks that should be tested. E2E tests cover some page-level behavior but not server-side data fetching edge cases.

---

## 2. Test Setup Quality

### TST-006 -- Three test setup files serve distinct tiers (well-architected)

| File | Purpose | Key Mocks |
|------|---------|-----------|
| `tests/setup.ts` | Integration/API tests | Clerk (server+client), Prisma (10 models), MSW server, environment vars |
| `tests/setup-unit.ts` | Pure unit tests | Environment vars only, rate limit disabled |
| `tests/setup-component.tsx` | React component tests | HTMLAudioElement, matchMedia, next/navigation, next/link, Clerk (client), Prisma (4 models) |

This separation is clean and intentional:
- Unit tests (`setup-unit.ts`) have minimal mocking -- they test pure functions
- Component tests (`setup-component.tsx`) mock the browser environment and React dependencies
- API tests (`setup.ts`) mock the server-side auth and database layer

### TST-007 -- Clerk + Prisma mocks are freshly migrated and accurate

`tests/setup.ts` now mocks:
```typescript
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(() => Promise.resolve({ userId: 'user_test123' })),
  currentUser: vi.fn(() => Promise.resolve({
    id: 'user_test123',
    firstName: 'Test', lastName: 'User',
    emailAddresses: [{ emailAddress: 'test@example.com' }],
  })),
}));
```

The Prisma mock covers all 10 active models: `project`, `profile`, `job`, `alert`, `team`, `teamMember`, `usage`, `storyScore`, `audioOutput`, `$queryRaw`.

**Positive finding.** The migration from Supabase mocks to Clerk+Prisma mocks is complete and well-structured.

### TST-008 -- Component Prisma mock is incomplete (4 of 10 models)

`tests/setup-component.tsx` only mocks 4 Prisma models:
```typescript
export const mockPrisma = {
  project: { ... },
  profile: { ... },
  job: { ... },
  subscription: { ... },  // Note: "subscription" doesn't exist in setup.ts mock
  $queryRaw: vi.fn(),
};
```

Missing: `alert`, `team`, `teamMember`, `usage`, `storyScore`, `audioOutput`. Also includes `subscription` which is not in the full mock -- this may be a stale model name.

**Severity: Low** -- Component tests currently don't hit these models, but will fail silently if they do in the future.

---

## 3. Test Quality

### TST-009 -- API route tests: thorough assertions with good negative cases

`tests/unit/api/projects-route.test.ts` (385 lines, ~15 tests) covers:
- **Auth:** 401 for unauthenticated requests on GET, POST, DELETE
- **Validation:** 400 for missing name, invalid page_count (-5)
- **Authorization:** 404 for accessing another user's project (ownership check)
- **Happy path:** 200 for list, 201 for create, 200 for update, 200 for delete
- **Edge cases:** Empty project list returns `[]`

Each test verifies both status code AND error code:
```typescript
expect(response.status).toBe(401);
expect(data.code).toBe('AUTH_REQUIRED');
```

This is high-quality API testing. The pattern is consistent across all 6 API test files.

### TST-010 -- CSRF tests cover all HTTP methods and attack vectors

`tests/unit/lib/csrf.test.ts` (167 lines) verifies:
- Allows requests without Origin/Referer (server-to-server)
- Allows localhost:22000 and localhost:3000
- **Rejects** arbitrary vercel.app domains
- **Rejects** unknown origins (malicious-site.com)
- Falls back to Referer when Origin is missing
- `withCsrfProtection` passes GET requests without validation
- `withCsrfProtection` blocks POST, PUT, DELETE from invalid origins

This is thorough security testing with real attack patterns.

### TST-011 -- Component tests verify accessibility and user interaction

`tests/component/audio-player.test.tsx` tests:
- Empty state: "No audio available"
- ARIA attributes: `role="slider"`, `aria-valuemin`, `aria-label`
- Interactive elements: play/pause button, volume controls, seek slider
- Multi-track: track list with `role="listbox"` and `role="option"`
- Download button href correctness

Uses `@testing-library/react` with proper queries (`getByRole`, `getByTestId`, `getByLabelText`) rather than implementation-detail selectors. Good adherence to Testing Library best practices.

### TST-012 -- Unit/lib tests validate business logic with edge cases

`tests/unit/lib/scoring.test.ts` verifies:
- 12 scoring dimensions are defined with all required properties
- Dimension weights sum to 100 (mathematical invariant)
- All 6 rating levels have correct threshold values
- Category score calculations
- Row-to-model mapping functions

This pattern of testing invariants and mathematical properties is excellent for preventing regressions.

---

## 4. Missing Test Areas

### TST-013 -- No tests for the `withAuth`/`withProjectAuth` middleware itself

`packages/web/lib/api/middleware.ts` is 209 lines of security-critical code handling:
- CSRF validation (delegated)
- Rate limiting
- Clerk auth
- Project ownership checks
- Request body parsing with Zod

This middleware is tested indirectly (routes that use it get auth behavior), but there are no direct tests for:
- Rate limit trigger behavior
- CSRF bypass option (`{ csrf: false }`)
- `parseBody` Zod validation error formatting
- Project ownership rejection (404 vs 401)

**Severity: High** -- This is the security boundary for all new routes. Direct tests would catch regressions immediately.

### TST-014 -- No tests for Stripe payment flows

Only the webhook handler has tests (`stripe-webhook.test.ts`). Missing:
- `/api/stripe/checkout` -- Payment session creation
- `/api/stripe/portal` -- Customer portal redirect
- Subscription lifecycle: create -> upgrade -> cancel -> reactivate
- Webhook idempotency (duplicate event delivery)

**Severity: High** -- Revenue-critical path. Stripe integration bugs are notoriously hard to debug in production.

### TST-015 -- No tests for team collaboration features

Missing tests for:
- `/api/teams` -- CRUD operations
- `/api/teams/share` -- Project sharing within teams
- `/api/teams/[teamId]/members` -- Member management
- `/api/invite/[token]` -- Invitation acceptance flow
- Authorization: team owner vs member vs non-member access

**Severity: Medium** -- Multi-tenant features need isolation testing to prevent data leakage.

### TST-016 -- No tests for admin routes

6 admin API routes have zero tests:
- `/api/admin/users` -- User management
- `/api/admin/users/[userId]` -- User detail/update
- `/api/admin/subscriptions` -- Subscription listing
- `/api/admin/subscriptions/[subscriptionId]` -- Subscription management
- `/api/admin/settings` -- System settings
- `/api/admin/audit-logs` -- Audit log retrieval
- `/api/admin/corpus/populate` -- Corpus management
- `/api/admin/stats` -- Dashboard statistics

**Severity: Medium** -- Admin routes need at minimum authorization tests (non-admin user should get 403).

---

## 5. E2E Tests

### TST-017 -- E2E suite covers core user journeys with Playwright

5 E2E spec files in `packages/web/e2e/`:

| File | Coverage |
|------|----------|
| `auth.spec.ts` | Login form elements, validation errors, magic link flow, signup form, password validation, page navigation |
| `project.spec.ts` | Unauthenticated project page behavior |
| `project.authenticated.spec.ts` | Create project form, page count calculation, disabled states, create-and-redirect flow |
| `dashboard.spec.ts` | Unauthenticated dashboard behavior |
| `dashboard.authenticated.spec.ts` | Authenticated dashboard behavior |

Supporting files:
- `e2e/auth.setup.ts` -- Authentication setup for authenticated tests
- `e2e/fixtures/test-script.ts` -- Reusable test script content

### TST-018 -- E2E tests verify real user interactions with timeouts

`e2e/project.authenticated.spec.ts` includes a full create-to-redirect flow:
```typescript
test('creates project and redirects to project page', async ({ page }) => {
  await page.getByTestId('create-project-button').click();
  await expect(page.getByText('Creating...')).toBeVisible();
  await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/, { timeout: 15000 });
  await expect(page.getByText('E2E Test Project')).toBeVisible({ timeout: 5000 });
});
```

This verifies loading states, URL routing with UUID pattern, and final content rendering. Good E2E practice.

### TST-019 -- E2E gap: no audio generation or playback tests

The E2E suite tests project creation but not:
- Audio generation trigger and progress display
- Audio playback (play, pause, seek)
- Voice assignment workflow
- StoryScore generation
- Share link creation and access
- Reader experience (library, favorites, position tracking)

**Severity: Medium** -- The audio generation flow is the core product value. E2E coverage should extend to at least verifying the generation button becomes active and the progress display appears.

---

## 6. Mock Infrastructure

### TST-020 -- MSW handlers use stale snake_case format from Supabase era

`packages/web/tests/mocks/handlers.ts` defines factory functions:
```typescript
export const createMockProject = (overrides = {}) => ({
  id: 'project-123',
  user_id: 'user-123',      // Should be userId
  page_count: 90,             // Should be pageCount
  created_at: new Date()      // Should be createdAt
});
```

All 6 factory functions (`createMockUser`, `createMockProfile`, `createMockSubscription`, `createMockProject`, `createMockShare`, `createMockLibraryEntry`) use snake_case keys. These were written for the Supabase response format and have not been updated for Prisma's camelCase.

**Severity: Medium** -- Any test relying on these factories for Prisma response mocking will get incorrect field names. The existing tests work because they use inline mocks or the MSW handlers intercept HTTP responses (which have their own format).

### TST-021 -- MSW handlers cover read operations but few mutations

The MSW handler file (`handlers.ts`, 207 lines) defines:
- Shares: GET, POST, PATCH, DELETE
- Share access: GET
- Reader library: GET (list), GET (single), PATCH, DELETE, POST (favorite), POST (position)
- Upload: POST (create-payment), POST (process)
- Jobs: GET (status)
- Projects: DELETE

Missing from MSW handlers:
- Projects: GET, POST, PATCH (only DELETE)
- Teams: All operations
- Alerts: All operations
- Generate: POST
- Voices: GET
- Admin: All operations

**Severity: Low** -- MSW handlers are primarily used for component tests. The unit API tests use direct mock injection instead of MSW.

---

## Findings Summary

| ID | Severity | Category | Summary |
|----|----------|----------|---------|
| TST-001 | Info | Distribution | Web: 25 test files in 3 tiers |
| TST-002 | Info | Distribution | Orchestrator: 19 test files, ~19 tests/file average |
| TST-003 | **High** | Coverage | 52 of 58 API routes have no dedicated tests |
| TST-004 | Medium | Coverage | 55 of 60 components untested |
| TST-005 | Medium | Coverage | Zero page-level tests for 26 pages |
| TST-006 | Positive | Setup | Three-tier setup architecture is clean |
| TST-007 | Positive | Setup | Clerk+Prisma mocks are freshly migrated |
| TST-008 | Low | Setup | Component Prisma mock is incomplete (4/10 models) |
| TST-009 | Positive | Quality | API tests have thorough assertions + negative cases |
| TST-010 | Positive | Quality | CSRF tests cover real attack vectors |
| TST-011 | Positive | Quality | Component tests use proper Testing Library queries |
| TST-012 | Positive | Quality | Scoring tests verify mathematical invariants |
| TST-013 | **High** | Gaps | No tests for withAuth/withProjectAuth middleware |
| TST-014 | **High** | Gaps | No tests for Stripe checkout/portal flows |
| TST-015 | Medium | Gaps | No tests for team collaboration features |
| TST-016 | Medium | Gaps | No tests for admin routes (authorization) |
| TST-017 | Positive | E2E | 5 spec files cover core auth and project journeys |
| TST-018 | Positive | E2E | E2E tests verify loading states and routing |
| TST-019 | Medium | E2E | No E2E tests for audio generation or playback |
| TST-020 | Medium | Mocks | MSW factories use stale snake_case from Supabase |
| TST-021 | Low | Mocks | MSW handlers cover reads but few mutations |

**High: 3 | Medium: 6 | Low: 2 | Positive: 7 | Info: 2**

---

## Recommended Priority Actions

1. **Write middleware tests for `withAuth`/`withProjectAuth`** (TST-013) -- 2 hours. These are the security gatekeepers. Test: auth failure, CSRF bypass, rate limit triggering, project ownership rejection, `parseBody` error formatting.

2. **Add Stripe checkout and portal tests** (TST-014) -- 3 hours. Test session creation, redirect URLs, error states, and subscription metadata passing. Mock the Stripe SDK.

3. **Add tests for the top 10 untested API routes** (TST-003 partial) -- 4-6 hours. Priority:
   - `/api/teams` + `/api/teams/[teamId]/members` -- Multi-tenancy security
   - `/api/admin/users` + `/api/admin/stats` -- Authorization boundaries
   - `/api/projects/[id]/voice-assignments` -- Core workflow
   - `/api/projects/[id]/score` -- StoryScore generation
   - `/api/alerts` -- Notification system
   - `/api/queue/status` -- Queue monitoring
   - `/api/jobs/[id]/cancel` -- Job cancellation

4. **Update MSW mock factories to camelCase** (TST-020) -- 1 hour. Align with Prisma output format.

5. **Add E2E test for generation flow** (TST-019) -- 2 hours. Verify: enter script, click generate, see progress, see completed audio. Can mock the orchestrator response.

---

## Test Coverage Heatmap

```
                        Unit    Component   E2E     Overall
Auth/Security           +++     ++          +++     GOOD
Projects CRUD           +++     +           ++      GOOD
Audio Generation        ++      -           -       WEAK
Scoring/StoryScore      +++     -           -       PARTIAL
Stripe Payments         +       -           -       WEAK
Teams/Collaboration     -       -           -       NONE
Admin                   -       -           -       NONE
Reader Experience       ++      -           -       PARTIAL
Orchestrator Pipeline   +++     n/a         -       GOOD
Voice Assignment        -       -           -       NONE
Suggestions/Rewrites    ++      -           -       PARTIAL

Legend: +++ Thorough  ++ Adequate  + Minimal  - None
```
