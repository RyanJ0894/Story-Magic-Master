# Technical Debt Backlog -- Story Magic

**Date:** 2026-02-18
**Author:** Chris Therriault (chris@servicevision.net)
**Source:** Code review findings from 01-SECURITY through 09-FEATURE-COMPLETENESS
**Total Tickets:** 45
**Total Story Points:** ~262 SP

---

## Summary

All findings from the 2026-02-18 code review have been consolidated into 45 actionable tickets, grouped by sprint priority. Related findings are merged into unified tickets to reduce overhead (e.g., all untested route findings become area-grouped test tickets rather than 40+ individual ones).

### Sprint Plan

| Sprint | Focus | Tickets | Story Points |
|--------|-------|---------|--------------|
| Sprint 1 | Critical + Security | 8 | 20 SP |
| Sprint 2 | Code Quality + Type Safety | 8 | 28 SP |
| Sprint 3 | Infrastructure + Missing Routes | 9 | 21 SP |
| Sprint 4 | Test Coverage | 8 | 64 SP |
| Sprint 5 | UI/UX + Feature Completeness | 7 | 26 SP |
| Backlog | Low priority | 5 | ~59 SP |
| **Total** | | **45** | **~218 SP** (excl. backlog estimates) |

### Priority Distribution

| Priority | Count | SP |
|----------|-------|----|
| CRITICAL | 2 | 6 |
| HIGH | 18 | 82 |
| MEDIUM | 20 | 116 |
| LOW | 5 | ~59 |

---

## Sprint 1: Critical + Security

*Goal: Eliminate deployment blockers and close all HIGH-severity security gaps.*

---

### TD-001: Eliminate `as unknown as Row` casts in service layer

| Field | Value |
|-------|-------|
| Priority | CRITICAL |
| Story Points | 5 |
| Type | Quality |
| Source | CQ-001 |
| Files | `packages/web/lib/adviser/service.ts:163`, `packages/web/lib/scoring/service.ts`, `packages/web/lib/revisions/service.ts`, `packages/web/lib/queue/worker.ts` |

**Description:** 16 `as unknown as Row` double-casts bypass all Prisma type safety in the adviser, scoring, revisions, and queue services. Define proper Prisma return types using `Prisma.XxxGetPayload<{}>` generics or typed `select`/`include` objects so the row-to-domain converters receive correctly typed inputs.

**Acceptance Criteria:**
- [ ] All 16 `as unknown as` casts removed from service files
- [ ] Each Prisma query uses a typed `select` or `include` matching the converter's expected shape
- [ ] `pnpm tsc --noEmit` passes with zero errors
- [ ] Existing tests continue to pass

---

### TD-002: Gate deploy job on E2E test results

| Field | Value |
|-------|-------|
| Priority | CRITICAL |
| Story Points | 1 |
| Type | Infra |
| Source | INFRA-001 |
| Files | `.github/workflows/ci.yml:147` |

**Description:** The deploy job in CI does not depend on E2E test completion. A broken E2E suite will not block deployment to staging or production.

**Acceptance Criteria:**
- [ ] Deploy job `needs:` array includes the E2E test job
- [ ] A failing E2E test prevents the deploy step from executing
- [ ] Verified with a test PR that intentionally breaks an E2E test

---

### TD-003: Harden health check endpoint

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 1 |
| Type | Security |
| Source | SEC-001 |
| Files | `packages/web/app/api/health/route.ts:822` |

**Description:** The unauthenticated health check performs live calls to ElevenLabs, OpenAI, and the orchestrator, returning their status, latency, and whether API keys are configured. This enables reconnaissance. Return only an aggregate healthy/unhealthy status for anonymous callers and move detailed checks behind `withAuth` with a `?details=true` query parameter.

**Acceptance Criteria:**
- [ ] Unauthenticated GET returns only `{ status: "healthy" | "unhealthy" }`
- [ ] Authenticated GET with `?details=true` returns full service breakdown
- [ ] Render health check path still works (uses unauthenticated response)

---

### TD-004: Add input validation to unvalidated mutation routes

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 5 |
| Type | Security |
| Source | SEC-005, SEC-006, SEC-007, SEC-008 |
| Files | `packages/web/app/api/projects/[id]/workflow-mode/route.ts:6`, `packages/web/app/api/reader/library/*/route.ts`, `packages/web/app/api/stripe/checkout/route.ts:8`, `packages/web/app/api/alerts/route.ts:122` |

**Description:** Six mutation routes accept `request.json()` without Zod validation: workflow-mode POST (also missing try/catch), 4 reader library routes, Stripe checkout, and alerts PATCH. Add Zod schemas and use the existing `parseBody` helper for all. The workflow-mode route also needs a try/catch wrapper.

**Acceptance Criteria:**
- [ ] Zod schema defined for each route's request body
- [ ] All 6 routes use `parseBody` or equivalent validated parsing
- [ ] workflow-mode POST wrapped in try/catch with proper error response
- [ ] Invalid payloads return 400 with descriptive error messages
- [ ] Unit tests cover validation rejection for each route

---

### TD-005: Fix orchestrator download IDOR vulnerability

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 3 |
| Type | Security |
| Source | SEC-010 |
| Files | `packages/orchestrator/src/index.ts:97` |

**Description:** The orchestrator's download endpoint serves files by path without verifying that the requesting user owns the associated project. Any authenticated user can download another user's generated audio by guessing or enumerating file paths.

**Acceptance Criteria:**
- [ ] Download endpoint verifies project ownership via the authenticated user's ID
- [ ] Requests for other users' files return 403 or 404
- [ ] Integration test confirms cross-user access is denied

---

### TD-006: Standardize error response format

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 5 |
| Type | Security / Quality |
| Source | ARCH-004, ARCH-005 |
| Files | Multiple routes across `packages/web/app/api/` |

**Description:** API routes use 4+ different error response shapes (`{ error }`, `{ message }`, `{ error: { code, message } }`, raw strings). Some leak internal error details (stack traces, Prisma error codes) in production. Create a single `apiError()` helper that produces a consistent envelope and strips internals in production.

**Acceptance Criteria:**
- [ ] `apiError(status, code, message, details?)` helper created in `packages/web/lib/api/`
- [ ] All routes use the helper (or it is integrated into `withAuth`/`withProjectAuth`)
- [ ] Production responses never include stack traces or internal error messages
- [ ] At least 3 representative routes updated and tested

---

### TD-007: Add rate limiting to public and sensitive endpoints

| Field | Value |
|-------|-------|
| Priority | MEDIUM |
| Story Points | 3 |
| Type | Security |
| Source | SEC-003, SEC-016, SEC-017 |
| Files | `packages/web/app/api/shares/access/[code]/route.ts:134`, multiple payment/admin routes |

**Description:** The public share access GET endpoint has no rate limiting, allowing brute-force enumeration of share codes. Additionally, sensitive routes (payment mutations, admin operations) use the default rate limit tier instead of a stricter one.

**Acceptance Criteria:**
- [ ] Share access GET has rate limiting (e.g., 30 req/min per IP)
- [ ] Payment and admin mutation routes use a stricter rate limit tier
- [ ] Rate limit responses return proper 429 with Retry-After header

---

### TD-008: Remaining MEDIUM security hardening

| Field | Value |
|-------|-------|
| Priority | MEDIUM |
| Story Points | 6 |
| Type | Security |
| Source | SEC-002, SEC-014, SEC-019 |
| Files | `packages/web/app/api/docs/route.ts:3`, `packages/web/app/api/shares/access/[code]/route.ts:271`, `packages/web/app/api/reader/upload/process/route.ts:31` |

**Description:** Three remaining MEDIUM security items: (1) OpenAPI spec endpoint exposes full API surface without auth -- gate behind auth or strip admin endpoints; (2) Share password POST is missing CSRF validation; (3) Upload filename is not sanitized before disk write, risking path traversal.

**Acceptance Criteria:**
- [ ] OpenAPI spec either requires auth or excludes admin/internal endpoints
- [ ] Share password POST validates CSRF token
- [ ] Upload filenames are sanitized (strip path separators, limit length, allowlist extensions)
- [ ] Unit tests cover each fix

---

## Sprint 2: Code Quality + Type Safety

*Goal: Eliminate unsafe type casts, consolidate duplicate patterns, and establish consistent code conventions.*

---

### TD-009: Consolidate catch-block error handling patterns

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 5 |
| Type | Quality |
| Source | CQ-008 |
| Files | 112+ catch blocks across `packages/web/app/api/` |

**Description:** Five different catch-block patterns exist across 112+ catch blocks: bare `catch (e)` with `console.error`, `catch (error: unknown)` with type narrowing, `catch (error)` returning inconsistent shapes, silent catches, and re-thrown errors. Standardize on a single pattern using a shared `handleRouteError(error, context)` utility that logs via the structured logger and returns the standard error envelope from TD-006.

**Acceptance Criteria:**
- [ ] `handleRouteError` utility created and documented
- [ ] All 112+ catch blocks migrated to use the utility
- [ ] No `console.error` in catch blocks (use structured logger)
- [ ] Error context (route name, method) included in all log entries

---

### TD-010: Migrate routes to parseBody helper

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 5 |
| Type | Quality |
| Source | CQ-012 |
| Files | 30+ routes across `packages/web/app/api/` |

**Description:** Over 30 API routes manually call `await request.json()` and handle parse errors individually instead of using the existing `parseBody` helper. This creates inconsistent error handling for malformed JSON and duplicates validation boilerplate.

**Acceptance Criteria:**
- [ ] All routes using `request.json()` migrated to `parseBody` with Zod schemas
- [ ] `parseBody` returns typed result or throws a standardized 400 error
- [ ] No direct `request.json()` calls remain in route handlers

---

### TD-011: Fix Stripe webhook and AI SDK type casts

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 4 |
| Type | Quality |
| Source | CQ-002, CQ-004 |
| Files | `packages/web/app/api/stripe/webhook/route.ts:99`, `packages/orchestrator/src/lib/llm-client.ts:76` |

**Description:** Two distinct unsafe cast patterns: (1) Stripe webhook handler casts subscription/invoice events to anonymous types because the Stripe SDK types lack certain fields -- use `Stripe.Subscription` and `Stripe.Invoice` with proper field access; (2) LLM client casts providers to `LanguageModelV1` -- create a typed factory that returns the correct provider type.

**Acceptance Criteria:**
- [ ] Stripe webhook uses proper SDK types without `as` casts
- [ ] LLM client factory returns typed providers without `as unknown` casts
- [ ] TypeScript compiles without errors

---

### TD-012: Fix orchestrator `as any` casts

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 2 |
| Type | Quality |
| Source | CQ-003 |
| Files | `packages/orchestrator/src/lib/logger.ts:48`, `packages/orchestrator/src/orchestrator/workers/whisper-align.ts` |

**Description:** The orchestrator logger uses `as any` for winston transport configuration and the whisper-align worker uses `: any` for process output. Type these properly using winston's transport types and Node.js `ChildProcess` types.

**Acceptance Criteria:**
- [ ] Logger uses `winston.transports.Console` and `winston.transports.File` types
- [ ] Whisper-align uses `ChildProcess` stdout/stderr types
- [ ] No `as any` or `: any` remain in orchestrator source

---

### TD-013: Consolidate OpenAI client and LLM call patterns

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 5 |
| Type | Quality |
| Source | CQ-010, CQ-011 |
| Files | `packages/web/lib/adviser/service.ts:32`, `packages/web/lib/scoring/service.ts:57`, `packages/web/lib/embeddings/` |

**Description:** Three independent OpenAI client initializations exist (adviser, scoring, embeddings) and three service functions duplicate the LLM call + JSON.parse + Zod validate pattern. Create a single `getOpenAIClient()` singleton and a `callLLMWithSchema<T>(prompt, schema): Promise<T>` utility.

**Acceptance Criteria:**
- [ ] Single OpenAI client factory in `packages/web/lib/ai/client.ts`
- [ ] `callLLMWithSchema` utility handles call, parse, and validate
- [ ] All 3 service files use the shared utilities
- [ ] Existing tests pass without modification

---

### TD-014: Replace console.* calls with structured logger

| Field | Value |
|-------|-------|
| Priority | MEDIUM |
| Story Points | 3 |
| Type | Quality |
| Source | CQ-009 |
| Files | Multiple files across `packages/web/` |

**Description:** 70 `console.*` calls exist in production code alongside a structured logger. Replace all with the structured logger to ensure consistent log format, levels, and metadata for production observability.

**Acceptance Criteria:**
- [ ] All `console.log`, `console.error`, `console.warn` replaced with logger calls
- [ ] `eslint` rule added to prevent future `console.*` usage (with exception for dev scripts)
- [ ] Zero `console.*` calls in `packages/web/lib/` and `packages/web/app/api/`

---

### TD-015: Remaining MEDIUM code quality items

| Field | Value |
|-------|-------|
| Priority | MEDIUM |
| Story Points | 7 |
| Type | Quality |
| Source | CQ-005, CQ-006, CQ-007, CQ-013, CQ-014, CQ-015, CQ-017 |
| Files | `packages/web/app/projects/[id]/project-workflow.tsx:101`, `packages/orchestrator/src/director/tools/hybrid-voice-search.ts:270`, `packages/web/lib/api/middleware.ts:162`, `packages/web/lib/email/resend.ts:47`, `packages/web/lib/db.ts:3`, `packages/web/lib/types/marketplace.ts:21`, `packages/web/app/api/projects/[id]/feedback/route.ts:86` |

**Description:** Grouped MEDIUM code quality items: (1) Type untyped `any` props in workflow components; (2) Add runtime validation for ElevenLabs voice API response; (3) Fix Prisma project cast in middleware; (4) Consolidate 3 duplicate email send functions; (5) Deduplicate Prisma singleton boilerplate; (6) Standardize snake_case vs camelCase in marketplace types; (7) Fix feedback route silent data drop when table missing.

**Acceptance Criteria:**
- [ ] Each item addressed per its individual finding
- [ ] No new `any` types introduced
- [ ] TypeScript compiles cleanly

---

### TD-016: Extract business logic from route handlers to service layer

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 8 |
| Type | Architecture |
| Source | ARCH-001 |
| Files | `packages/web/app/api/generate/route.ts:55` |

**Description:** The generate route handler contains ~200 lines of business logic (project validation, credit checks, job creation, orchestrator dispatch) directly in the route file. Extract to a `GenerationService` with testable methods. This pattern also appears in several other routes.

**Acceptance Criteria:**
- [ ] `GenerationService` created in `packages/web/lib/generation/service.ts`
- [ ] Route handler reduced to auth + parse + delegate + respond
- [ ] Service is independently unit testable with mocked dependencies
- [ ] Existing integration tests updated to match

---

## Sprint 3: Infrastructure + Missing Routes/Pages

*Goal: Fix deployment configuration issues and implement missing routes that cause 404s in production.*

---

### TD-017: Fix CI pipeline issues

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 2 |
| Type | Infra |
| Source | INFRA-002, INFRA-007 |
| Files | `.github/workflows/ci.yml:5` |

**Description:** Two CI issues: (1) CI triggers are hardcoded to a feature branch name instead of using wildcard patterns; (2) No build cache in CI, causing slow builds. Fix branch triggers and add pnpm store caching.

**Acceptance Criteria:**
- [ ] CI triggers use `main`, `staging`, and `feature/**` patterns
- [ ] pnpm store cached between runs
- [ ] CI run time reduced measurably

---

### TD-018: Fix Render deployment configuration

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 4 |
| Type | Infra |
| Source | INFRA-003, INFRA-005, INFRA-008 |
| Files | `render.yaml:42`, `render.yaml:145` |

**Description:** Three Render config issues: (1) `DIRECT_DATABASE_URL` missing from render.yaml -- Prisma migrations will fail in production; (2) Web health check path set to `/` instead of `/api/health` -- Render may restart the service incorrectly; (3) Orchestrator build depends on web's Prisma schema but does not install web dependencies.

**Acceptance Criteria:**
- [ ] `DIRECT_DATABASE_URL` added to render.yaml web service env
- [ ] Health check path updated to `/api/health`
- [ ] Orchestrator build step correctly resolves Prisma dependency
- [ ] Staging deploy succeeds with these changes

---

### TD-019: Add global error boundary

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 2 |
| Type | Infra |
| Source | INFRA-004 |
| Files | `packages/web/app/` |

**Description:** No `global-error.tsx` exists. Unhandled errors in the root layout crash the entire application with a white screen instead of showing a user-friendly error page.

**Acceptance Criteria:**
- [ ] `packages/web/app/global-error.tsx` created with Sentry reporting
- [ ] Error page includes "Try again" button and support contact
- [ ] Tested by temporarily throwing in root layout

---

### TD-020: Implement missing /api/jobs/[id]/status route

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 2 |
| Type | Feature |
| Source | FC-014 |
| Files | `packages/web/components/reader/upload-client.tsx:190` |

**Description:** The reader upload client polls `/api/jobs/[id]/status` for processing progress, but this route does not exist. The upload flow shows a perpetual loading state after file submission.

**Acceptance Criteria:**
- [ ] `/api/jobs/[id]/status` route created with auth and ownership checks
- [ ] Returns job status, progress percentage, and error message if failed
- [ ] Reader upload polling works end-to-end
- [ ] Unit test covers happy path and error states

---

### TD-021: Implement missing /api/shares/access/[code]/play route

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 2 |
| Type | Feature |
| Source | FC-015 |
| Files | `packages/web/app/s/[code]/page.tsx:169` |

**Description:** The share page calls `/api/shares/access/[code]/play` to increment play counts, but the route does not exist. Play tracking is non-functional.

**Acceptance Criteria:**
- [ ] `/api/shares/access/[code]/play` POST route created
- [ ] Increments play count on the `ScriptShare` record
- [ ] Rate limited to prevent artificial inflation
- [ ] Unit test covers the route

---

### TD-022: Fix broken internal navigation links

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 3 |
| Type | Feature |
| Source | FC-025, FC-026 |
| Files | `packages/web/components/alerts/AlertsDropdown.tsx:258`, `packages/web/components/dashboard/writer-dashboard-client.tsx:210` |

**Description:** Two navigation links point to pages that do not exist: (1) AlertsDropdown links to `/alerts` (404); (2) Writer dashboard "Upload" button links to `/upload` (404). Either create the pages or redirect to the correct existing pages.

**Acceptance Criteria:**
- [ ] `/alerts` page created or link redirected to alerts panel
- [ ] `/upload` page created or link redirected to `/projects/new`
- [ ] No 404s reachable from standard UI navigation

---

### TD-023: Implement queue worker processors for scoring and suggestions

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 6 |
| Type | Feature |
| Source | FC-002, FC-003 |
| Files | `packages/web/lib/queue/worker.ts:381`, `packages/web/lib/queue/worker.ts:386` |

**Description:** The `score_generation` and `suggestion_generation` queue processors both throw "Not implemented". Any project that triggers async scoring or suggestion generation will fail silently. Implement the processors using the existing scoring and adviser service functions.

**Acceptance Criteria:**
- [ ] `score_generation` processor calls `ScoringService.generateScore()`
- [ ] `suggestion_generation` processor calls `AdviserService.generateSuggestions()`
- [ ] Both update job status on completion/failure
- [ ] Unit tests cover success and error paths

---

### TD-024: MEDIUM infrastructure items

| Field | Value |
|-------|-------|
| Priority | MEDIUM |
| Story Points | 10 |
| Type | Infra |
| Source | INFRA-006, INFRA-009, INFRA-010, INFRA-011 |
| Files | `packages/web/instrumentation.ts:7`, `docker-compose.yml:48`, `packages/web/sentry.client.config.ts:21`, `render-staging.yaml` |

**Description:** Grouped MEDIUM infra items: (1) Queue worker runs inside the Next.js process -- should be a separate worker (5 SP); (2) Docker Compose and Render use different ports causing dev/prod parity issues (1 SP); (3) Sentry Replay captures screenplay text in session replays -- add text masking (2 SP); (4) No staging database defined in IaC blueprint (2 SP).

**Acceptance Criteria:**
- [ ] Queue worker extracted or documented as acceptable for MVP scale
- [ ] Port configuration consistent between Docker Compose and Render
- [ ] Sentry Replay configured with `maskAllText: true` for screenplay content
- [ ] Staging database added to render-staging.yaml

---

### TD-025: Architecture cleanup -- deduplication and performance

| Field | Value |
|-------|-------|
| Priority | MEDIUM |
| Story Points | 18 |
| Type | Architecture |
| Source | ARCH-002, ARCH-003, ARCH-005, ARCH-007, ARCH-008, ARCH-010, ARCH-013 |
| Files | `packages/web/app/api/admin/*/route.ts`, `packages/web/app/api/suggestions/[id]/route.ts:49`, `packages/web/app/api/reader/library/route.ts:62`, `packages/web/app/api/admin/stats/route.ts:16`, `packages/web/app/api/preview/route.ts:130` |

**Description:** Grouped MEDIUM architecture items: (1) Admin authorization check duplicated 8+ times -- extract to `withAdminAuth` middleware (3 SP); (2) Ownership verification duplicated in suggestion/revision routes -- extract to shared utility (2 SP); (3) Error details leak internals in production (2 SP); (4) Reader library queries run sequentially instead of `Promise.all` (3 SP); (5) Admin stats runs 9 separate COUNT queries -- consolidate (2 SP); (6) Duplicate route patterns for suggestions and revisions (3 SP); (7) Orchestrator fetch calls have no timeout or retry logic (3 SP).

**Acceptance Criteria:**
- [ ] Each item addressed per its individual finding
- [ ] No duplicate authorization logic
- [ ] Sequential queries parallelized where safe
- [ ] Fetch calls have timeout and retry with exponential backoff

---

## Sprint 4: Test Coverage

*Goal: Close the most impactful test gaps, prioritized by risk.*

---

### TD-026: Test all admin routes

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 8 |
| Type | Testing |
| Source | TST-001 |
| Files | `packages/web/app/api/admin/*/route.ts` |

**Description:** All 8 admin routes (users, subscriptions, settings, analytics, stats, audit-log, feature-flags, overview) have zero test coverage. These routes handle user management, subscription mutations, and system configuration. Test auth enforcement, admin-only access, and core CRUD operations.

**Acceptance Criteria:**
- [ ] Each admin route has at least 3 tests: unauthenticated (401), non-admin (403), happy path
- [ ] Mutation routes tested for input validation
- [ ] Test file: `packages/web/tests/unit/api/admin-routes.test.ts`

---

### TD-027: Test payment-critical routes

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 6 |
| Type | Testing |
| Source | TST-021, TST-027 |
| Files | `packages/web/app/api/reader/upload/*/route.ts`, `packages/web/app/api/webhooks/clerk/route.ts` |

**Description:** Reader upload payment/process routes handle real Stripe payments and the Clerk webhook route handles user sync. Both are untested and high-risk.

**Acceptance Criteria:**
- [ ] Reader upload route tests: auth, payment verification, file processing
- [ ] Clerk webhook tests: signature verification, user create/update/delete events
- [ ] Mock Stripe and Clerk SDKs appropriately

---

### TD-028: E2E test for generate-to-playback flow

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 5 |
| Type | Testing |
| Source | TST-048 |
| Files | `packages/web/e2e/` (missing `generate-flow.spec.ts`) |

**Description:** No E2E test exists for the core user journey: upload script, generate audio, play back result. This is the primary value proposition of the product and must be verified end-to-end.

**Acceptance Criteria:**
- [ ] Playwright test covers: login, create project, paste script, generate, wait for completion, play audio
- [ ] Test uses mocked orchestrator to avoid real API costs
- [ ] Runs in CI as part of the E2E suite

---

### TD-029: Test sharing and collaboration routes

| Field | Value |
|-------|-------|
| Priority | MEDIUM |
| Story Points | 6 |
| Type | Testing |
| Source | TST-022, TST-023, TST-024, TST-025 |
| Files | `packages/web/app/api/shares/*/route.ts`, `packages/web/app/api/teams/*/route.ts` |

**Description:** Share PATCH/DELETE (revocation is security-critical), share access (public endpoint), team members, and team share routes are all untested.

**Acceptance Criteria:**
- [ ] Share revocation tested (PATCH/DELETE)
- [ ] Public share access tested with valid/invalid/expired codes
- [ ] Team member management tested
- [ ] Team share tested

---

### TD-030: Test project sub-resource routes

| Field | Value |
|-------|-------|
| Priority | MEDIUM |
| Story Points | 12 |
| Type | Testing |
| Source | TST-010, TST-011, TST-013, TST-014, TST-015, TST-016, TST-017, TST-018 |
| Files | `packages/web/app/api/projects/[id]/*/route.ts` |

**Description:** Eight project sub-resource route groups are untested: audio-overrides, comparables, export, feedback, revisions (4 routes), score, suggestions (5 routes), and voice-assignments. Group into a single test file per resource.

**Acceptance Criteria:**
- [ ] Each route group has auth, ownership, and happy-path tests
- [ ] Revisions and suggestions routes tested for all CRUD operations
- [ ] Export route tested for file generation

---

### TD-031: Test remaining API routes

| Field | Value |
|-------|-------|
| Priority | MEDIUM |
| Story Points | 7 |
| Type | Testing |
| Source | TST-002, TST-005, TST-006, TST-007, TST-020 |
| Files | `packages/web/app/api/audio-preview/[...path]/route.ts`, `packages/web/app/api/generate-demo-script/route.ts`, `packages/web/app/api/invite/[token]/route.ts`, `packages/web/app/api/jobs/[id]/cancel/route.ts`, `packages/web/app/api/queue/status/route.ts` |

**Description:** Five remaining untested API routes. Audio-preview catch-all is particularly important due to path traversal risk. Invite token route handles authentication-adjacent functionality.

**Acceptance Criteria:**
- [ ] Audio-preview tested for path traversal attempts (../../../etc/passwd)
- [ ] Each route has auth and happy-path tests
- [ ] Job cancel tested for ownership verification

---

### TD-032: Test critical UI components

| Field | Value |
|-------|-------|
| Priority | MEDIUM |
| Story Points | 16 |
| Type | Testing |
| Source | TST-028, TST-029, TST-031, TST-034, TST-035, TST-038 |
| Files | `packages/web/components/alerts/AlertsDropdown.tsx`, `packages/web/components/dashboard/*.tsx`, `packages/web/components/player/*.tsx`, `packages/web/components/script-editor/*.tsx`, `packages/web/components/story-adviser/*.tsx`, `packages/web/app/projects/[id]/delete-button.tsx` |

**Description:** Critical UI components with zero test coverage: alerts/auth components, 5 of 6 dashboard components, protected player, script editor, Story Adviser (6 components), and project action buttons. Prioritize components that handle user data or financial actions.

**Acceptance Criteria:**
- [ ] Dashboard components render correctly with mock data
- [ ] Protected player handles auth states
- [ ] Story Adviser renders suggestions and handles user interactions
- [ ] Delete button shows confirmation dialog

---

### TD-033: Improve test infrastructure

| Field | Value |
|-------|-------|
| Priority | MEDIUM |
| Story Points | 4 |
| Type | Testing |
| Source | TST-041, TST-042, TST-045 |
| Files | `packages/web/tests/unit/api/routes-coverage.test.ts:655`, `packages/web/tests/unit/api/reader-library.test.ts`, `packages/web/tests/setup.ts:51` |

**Description:** Three test infrastructure issues: (1) Health check test uses shallow `toBeDefined` assertions instead of checking actual values; (2) Reader library tests skip auth verification on 4 sub-endpoints; (3) Prisma mock setup is missing 13 of 23 models, causing runtime failures when new tests are added.

**Acceptance Criteria:**
- [ ] Health check assertions verify actual response shape and values
- [ ] Reader library tests include auth rejection tests for all endpoints
- [ ] All 23 Prisma models included in mock setup

---

## Sprint 5: UI/UX + Feature Completeness

*Goal: Polish user experience and activate completed-but-disabled features.*

---

### TD-034: Add loading and error boundaries for key routes

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 4 |
| Type | UX |
| Source | UX-001, UX-004, UX-005, UX-002, UX-003 |
| Files | `packages/web/app/billing/`, `packages/web/app/reader/dashboard/`, `packages/web/app/writer/dashboard/`, `packages/web/app/projects/new/` |

**Description:** Key routes with async data fetching lack `loading.tsx` and `error.tsx` boundaries: billing (raw SQL), reader dashboard, writer dashboard (multiple Prisma queries), and projects/new. Users see white screens during loading and generic errors on failure.

**Acceptance Criteria:**
- [ ] `loading.tsx` with skeleton UI for billing, reader/writer dashboards
- [ ] `error.tsx` with retry button and user-friendly message for billing, reader/writer dashboards
- [ ] Loading state for projects/new during auth resolution

---

### TD-035: Fix accessibility issues across admin and public pages

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 4 |
| Type | UX |
| Source | UX-009, UX-010, UX-011, UX-012, UX-013 |
| Files | `packages/web/app/admin/settings/page.tsx:56`, `packages/web/app/admin/audit-log/page.tsx:142`, `packages/web/app/admin/users/page.tsx:139`, `packages/web/app/pricing/page.tsx:73`, `packages/web/components/reader/upload-client.tsx:288` |

**Description:** Multiple accessibility violations: 9 Switch components without labels, audit-log filter without label, admin selects without labels, pricing toggle missing ARIA role/checked, reader upload drop zone missing ARIA role/label.

**Acceptance Criteria:**
- [ ] All Switch components have `id` and associated `<label htmlFor>`
- [ ] All form inputs have accessible labels (visible or `aria-label`)
- [ ] Pricing toggle uses `role="radiogroup"` with `aria-checked`
- [ ] Upload drop zone has `role="button"` and descriptive `aria-label`
- [ ] axe-core audit passes for affected pages

---

### TD-036: Make admin layout responsive

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 3 |
| Type | UX |
| Source | UX-015, UX-016 |
| Files | `packages/web/app/admin/layout.tsx:50`, `packages/web/app/admin/users/page.tsx:168` |

**Description:** Admin sidebar is fixed `w-64` with no responsive breakpoints -- completely unusable on mobile/tablet. Admin tables with 6-7 columns overflow without horizontal scroll wrappers.

**Acceptance Criteria:**
- [ ] Admin sidebar collapses to hamburger menu on mobile/tablet
- [ ] Admin tables wrapped in horizontal scroll container
- [ ] Tested at 375px, 768px, and 1024px breakpoints

---

### TD-037: Silent error feedback and form validation UX

| Field | Value |
|-------|-------|
| Priority | MEDIUM |
| Story Points | 3 |
| Type | UX |
| Source | UX-006, UX-007, UX-017, UX-019, UX-020 |
| Files | `packages/web/components/feedback/FeedbackModal.tsx:145`, `packages/web/components/dashboard/share-modal.tsx:87`, `packages/web/app/projects/new/page.tsx:209`, `packages/web/app/pricing/page.tsx:222`, `packages/web/components/revisions/ScoreTrajectoryChart.tsx:166` |

**Description:** Grouped UX items: (1) FeedbackModal catch block only logs to console -- show toast; (2) ShareModal share creation failure silent; (3) Project creation accepts single-character scripts; (4) Pricing skeleton uses hardcoded colors without dark mode variant; (5) Hardcoded hex colors in charts break dark mode.

**Acceptance Criteria:**
- [ ] Error toasts shown for FeedbackModal and ShareModal failures
- [ ] Minimum script length validation (e.g., 50 characters)
- [ ] All skeleton/chart colors use Tailwind theme tokens with dark: variants

---

### TD-038: Wire up feature flags for completed features

| Field | Value |
|-------|-------|
| Priority | MEDIUM |
| Story Points | 3 |
| Type | Feature |
| Source | FC-019, FC-020, FC-021, FC-022 |
| Files | `packages/web/lib/features/flags.tsx:39-68` |

**Description:** Four features are code-complete but disabled by default flags: StoryScore, Story-Adviser, Revision Tracking, and Script Editor. Create a feature flag management workflow to enable them progressively and verify each works end-to-end when enabled.

**Acceptance Criteria:**
- [ ] Each feature tested with flag enabled in staging
- [ ] Documented rollout plan for each feature
- [ ] Admin settings page can toggle flags (see TD-039)

---

### TD-039: Complete admin settings functionality

| Field | Value |
|-------|-------|
| Priority | MEDIUM |
| Story Points | 5 |
| Type | Feature |
| Source | FC-005, FC-004, FC-010, FC-017 |
| Files | `packages/web/app/admin/settings/page.tsx:58`, `packages/web/app/api/admin/subscriptions/[subscriptionId]/route.ts:158`, `packages/web/app/api/admin/` |

**Description:** Grouped admin feature gaps: (1) Admin settings page is a non-functional UI shell with all Save buttons disabled (5 SP); (2) Stripe subscription sync is a stub (included); (3) 7 admin API routes are orphaned -- admin pages use server-side Prisma directly (cleanup); (4) AlertPreference model has zero references.

**Acceptance Criteria:**
- [ ] Admin settings Save buttons functional -- persist to PlatformSetting model
- [ ] Stripe subscription sync calls actual Stripe API
- [ ] Decision documented: either use admin API routes or remove them
- [ ] AlertPreference model either wired to UI or removed from schema

---

### TD-040: E2E tests for billing and sharing flows

| Field | Value |
|-------|-------|
| Priority | MEDIUM |
| Story Points | 5 |
| Type | Testing |
| Source | TST-049, TST-050 |
| Files | `packages/web/e2e/` |

**Description:** No E2E tests exist for the Stripe checkout flow or the share/reader flow. Both are revenue-critical paths.

**Acceptance Criteria:**
- [ ] Playwright test for Stripe checkout: select plan, enter test card, verify subscription
- [ ] Playwright test for share flow: create share link, open as anonymous user, verify playback
- [ ] Both tests use mocked payment provider in CI

---

## Backlog (LOW Priority)

*Items to address as capacity allows. Grouped into large work packages.*

---

### TD-041: LOW security and architecture items

| Field | Value |
|-------|-------|
| Priority | LOW |
| Story Points | 12 |
| Type | Security / Architecture |
| Source | SEC-004, SEC-011, ARCH-006, ARCH-009, ARCH-011, ARCH-012 |
| Files | Multiple |

**Description:** Grouped LOW security/architecture items: (1) Invite GET leaks PII without rate limit; (2) Queue status leaks cross-tenant data; (3) Inconsistent 403 vs 404 for authorization failures; (4) `withProjectAuth` fetches all columns; (5) Response envelope format varies; (6) Web package has no env validation at startup.

**Acceptance Criteria:**
- [ ] Each item addressed per individual finding
- [ ] No PII leakage in unauthenticated endpoints

---

### TD-042: LOW test coverage items

| Field | Value |
|-------|-------|
| Priority | LOW |
| Story Points | 25 |
| Type | Testing |
| Source | TST-003, TST-004, TST-008, TST-009, TST-012, TST-019, TST-026, TST-030, TST-032, TST-033, TST-036, TST-037, TST-039, TST-040, TST-043, TST-044, TST-046, TST-047, TST-051, TST-052, TST-053 |
| Files | Multiple |

**Description:** 21 LOW-priority test gaps covering: auth signout, docs, job position, preview, project delete, workflow mode, voices, FeedbackModal, reader components, revisions components (4), StoryScore, wizard, project workflow/history, voice/workflow choosers, misleading test description, concurrent access tests, rate limit testing in unit tests, MSW error handlers, SFX assertion depth, loudness parse failure, TTS rate limit test.

**Acceptance Criteria:**
- [ ] Each route/component has at least one happy-path test
- [ ] Prioritize routes with security implications

---

### TD-043: LOW UX items

| Field | Value |
|-------|-------|
| Priority | LOW |
| Story Points | 5 |
| Type | UX |
| Source | UX-008, UX-014, UX-018, UX-021, UX-022 |
| Files | `packages/web/app/admin/analytics/page.tsx:249`, `packages/web/components/reader/upload-client.tsx:365`, `packages/web/components/dashboard/share-modal.tsx:225`, `packages/web/components/docs/swagger-ui.tsx:37`, `packages/web/app/projects/[id]/generate-button.tsx:335` |

**Description:** Minor UX polish: empty state for analytics chart, upload clear button aria-label, share modal confusing disabled state, Swagger UI hardcoded colors, GenerateButton dev log panel should be gated behind dev flag.

**Acceptance Criteria:**
- [ ] Each item addressed per individual finding

---

### TD-044: LOW feature completeness items

| Field | Value |
|-------|-------|
| Priority | LOW |
| Story Points | 12 |
| Type | Feature |
| Source | FC-006, FC-007, FC-008, FC-009, FC-013, FC-018, FC-023, FC-024, FC-027, FC-028, FC-029, FC-030 |
| Files | Multiple |

**Description:** Grouped LOW feature items: Teams missing PATCH/DELETE, audio outputs have no CRUD API, subscriptions have no cancel endpoint (relies on Stripe portal), alerts have no DELETE, unused auth signout route, ContentAccessLog lightly used, comparable scripts needs corpus, export reports needs testing, /settings route protected but no page, /terms and /privacy not linked, /docs not linked, three dashboard variant routing confusion.

**Acceptance Criteria:**
- [ ] Each item triaged: implement, defer, or document as intentional
- [ ] Broken navigation links fixed or removed

---

### TD-045: LOW code quality and infra items

| Field | Value |
|-------|-------|
| Priority | LOW |
| Story Points | 5 |
| Type | Quality / Infra |
| Source | CQ-016, CQ-018, INFRA-012, INFRA-013, INFRA-014 |
| Files | Multiple |

**Description:** Minor quality and infra items: inconsistent error variable naming (error vs err), 6 eslint-disable comments masking type issues, no orchestrator build verification in CI, deploy hooks have no verification step, audio storage disk size concerns.

**Acceptance Criteria:**
- [ ] eslint-disable comments resolved or justified with inline comments
- [ ] Orchestrator build added to CI verification
- [ ] Disk size requirements documented

---

## Cross-Reference Index

Quick lookup from original finding ID to consolidated TD ticket:

| Finding | TD Ticket | Sprint |
|---------|-----------|--------|
| CQ-001 | TD-001 | 1 |
| INFRA-001 | TD-002 | 1 |
| SEC-001 | TD-003 | 1 |
| SEC-005, SEC-006, SEC-007, SEC-008 | TD-004 | 1 |
| SEC-010 | TD-005 | 1 |
| ARCH-004, ARCH-005 | TD-006 | 1 |
| SEC-003, SEC-016, SEC-017 | TD-007 | 1 |
| SEC-002, SEC-014, SEC-019 | TD-008 | 1 |
| CQ-008 | TD-009 | 2 |
| CQ-012 | TD-010 | 2 |
| CQ-002, CQ-004 | TD-011 | 2 |
| CQ-003 | TD-012 | 2 |
| CQ-010, CQ-011 | TD-013 | 2 |
| CQ-009 | TD-014 | 2 |
| CQ-005, CQ-006, CQ-007, CQ-013, CQ-014, CQ-015, CQ-017 | TD-015 | 2 |
| ARCH-001 | TD-016 | 2 |
| INFRA-002, INFRA-007 | TD-017 | 3 |
| INFRA-003, INFRA-005, INFRA-008 | TD-018 | 3 |
| INFRA-004 | TD-019 | 3 |
| FC-014 | TD-020 | 3 |
| FC-015 | TD-021 | 3 |
| FC-025, FC-026 | TD-022 | 3 |
| FC-002, FC-003 | TD-023 | 3 |
| INFRA-006, INFRA-009, INFRA-010, INFRA-011 | TD-024 | 3 |
| ARCH-002, ARCH-003, ARCH-005, ARCH-007, ARCH-008, ARCH-010, ARCH-013 | TD-025 | 3 |
| TST-001 | TD-026 | 4 |
| TST-021, TST-027 | TD-027 | 4 |
| TST-048 | TD-028 | 4 |
| TST-022, TST-023, TST-024, TST-025 | TD-029 | 4 |
| TST-010, TST-011, TST-013, TST-014, TST-015, TST-016, TST-017, TST-018 | TD-030 | 4 |
| TST-002, TST-005, TST-006, TST-007, TST-020 | TD-031 | 4 |
| TST-028, TST-029, TST-031, TST-034, TST-035, TST-038 | TD-032 | 4 |
| TST-041, TST-042, TST-045 | TD-033 | 4 |
| UX-001, UX-002, UX-003, UX-004, UX-005 | TD-034 | 5 |
| UX-009, UX-010, UX-011, UX-012, UX-013 | TD-035 | 5 |
| UX-015, UX-016 | TD-036 | 5 |
| UX-006, UX-007, UX-017, UX-019, UX-020 | TD-037 | 5 |
| FC-019, FC-020, FC-021, FC-022 | TD-038 | 5 |
| FC-004, FC-005, FC-010, FC-017 | TD-039 | 5 |
| TST-049, TST-050 | TD-040 | 5 |
| SEC-004, SEC-011, ARCH-006, ARCH-009, ARCH-011, ARCH-012 | TD-041 | Backlog |
| TST-003, TST-004, TST-008, TST-009, TST-012, TST-019, TST-026, TST-030, TST-032, TST-033, TST-036, TST-037, TST-039, TST-040, TST-043, TST-044, TST-046, TST-047, TST-051, TST-052, TST-053 | TD-042 | Backlog |
| UX-008, UX-014, UX-018, UX-021, UX-022 | TD-043 | Backlog |
| FC-006, FC-007, FC-008, FC-009, FC-013, FC-018, FC-023, FC-024, FC-027, FC-028, FC-029, FC-030 | TD-044 | Backlog |
| CQ-016, CQ-018, INFRA-012, INFRA-013, INFRA-014 | TD-045 | Backlog |
