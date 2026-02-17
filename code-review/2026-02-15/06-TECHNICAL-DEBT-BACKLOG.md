# Technical Debt Backlog — Story Magic

Date: 2026-02-15 | Branch: feat/clerk-prisma-migration | Commit: f273990

---

## Sprint 1: Staging Blockers (13 SP)

### TD-001: Remove access token from job metadata

| Field | Value |
|-------|-------|
| Priority | CRITICAL |
| Story Points | 3 |
| Type | Security |
| Source | SEC-001, ARCH-006 |
| Files | `packages/web/app/api/generate/route.ts`, `packages/web/lib/queue/worker.ts` |

**Description:** Remove `accessToken` from `job.result.metadata`. Have the queue worker obtain its own service-level token or use a server-to-server auth pattern for orchestrator calls.

**Acceptance Criteria:**
- [ ] `accessToken` no longer written to `jobs.result` JSONB
- [ ] Queue worker authenticates to orchestrator without user session tokens
- [ ] Existing jobs with tokens are cleaned up via migration or on-read

---

### TD-002: Remove hardcoded Sentry DSN from source

| Field | Value |
|-------|-------|
| Priority | CRITICAL |
| Story Points | 1 |
| Type | Security / Infra |
| Source | INFRA-001 |
| Files | `packages/web/sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `packages/orchestrator/src/lib/sentry.ts` |

**Description:** Remove hardcoded Sentry DSN fallback strings. Use env-only configuration.

**Acceptance Criteria:**
- [ ] No Sentry DSN strings in source code
- [ ] Sentry initializes only when `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` env var is set
- [ ] Sentry disabled gracefully in local dev without env var

---

### TD-003: Add database connection pooling

| Field | Value |
|-------|-------|
| Priority | CRITICAL |
| Story Points | 3 |
| Type | Infrastructure |
| Source | INFRA-002 |
| Files | `packages/web/prisma/schema.prisma`, `packages/web/lib/db.ts` |

**Description:** Configure Prisma connection pooling. Render basic-256mb PostgreSQL supports ~20 connections. Two services (web + orchestrator) sharing it without pooling will exhaust connections under load.

**Acceptance Criteria:**
- [ ] `schema.prisma` datasource has `connection_limit` set (e.g., 8 per service)
- [ ] PrismaClient configured with connection pool settings
- [ ] Load test confirms no connection exhaustion at 10 concurrent users

---

### TD-004: Fix staging build command

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 1 |
| Type | Infrastructure |
| Source | INFRA-003 |
| Files | `render-staging.yaml` |

**Description:** Staging blueprint missing `prisma generate` and `prisma migrate deploy` in build command.

**Acceptance Criteria:**
- [ ] `render-staging.yaml` build command matches production `render.yaml`
- [ ] Staging deploy succeeds with Prisma migrations applied

---

### TD-005: Add auth to audio preview proxy

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 2 |
| Type | Security |
| Source | SEC-002 |
| Files | `packages/web/app/api/audio-preview/[...path]/route.ts` |

**Description:** Audio preview proxy has zero authentication — any request can fetch audio files from the orchestrator.

**Acceptance Criteria:**
- [ ] Route requires Clerk authentication via `auth()` or `withAuth`
- [ ] Unauthenticated requests return 401
- [ ] Verify project ownership before proxying audio

---

### TD-006: Fix client fetches to non-existent routes

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 2 |
| Type | Feature Completeness |
| Source | FC-012 |
| Files | Multiple client components |

**Description:** Two client-side `fetch()` calls target API routes that don't exist, producing silent 404s.

**Acceptance Criteria:**
- [ ] All client-side fetch URLs resolve to existing API routes
- [ ] No 404 errors in browser console on normal user flows

---

## Sprint 2: Pre-Production (30 SP)

### TD-007: Migrate routes to withAuth middleware

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 8 |
| Type | Architecture / Security |
| Source | ARCH-008, CQ-005, SEC-009, SEC-010 |
| Files | ~40 route files in `packages/web/app/api/` |

**Description:** Only 9 of 58 API routes use `withAuth`/`withProjectAuth`. The other ~40 inline auth manually and most skip rate limiting entirely. Migrate all routes to use the middleware.

**Acceptance Criteria:**
- [ ] All authenticated routes use `withAuth` or `withProjectAuth`
- [ ] All routes have rate limiting (at least 'normal' tier)
- [ ] Existing manual auth/CSRF code removed from migrated routes

---

### TD-008: Remove unsafe-eval from CSP

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 5 |
| Type | Security |
| Source | SEC-005, INFRA-013 |
| Files | `packages/web/middleware.ts` |

**Description:** CSP `script-src` includes `unsafe-eval`. Identify what requires it (likely Stripe.js or dev tools), add nonce-based CSP or specific source allowlist.

**Acceptance Criteria:**
- [ ] `unsafe-eval` removed from CSP
- [ ] All third-party scripts still functional (Stripe, Clerk)
- [ ] No CSP violations in production console

---

### TD-009: Complete or gate admin features

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 5 |
| Type | Feature Completeness |
| Source | FC-007, FC-008, FC-009 |
| Files | `packages/web/app/admin/settings/page.tsx`, `app/admin/users/page.tsx`, `app/admin/page.tsx` |

**Description:** Admin settings page is non-functional, user action buttons are inert stubs, dashboard shows hardcoded growth percentages. Either complete or add "Coming Soon" labels.

**Acceptance Criteria:**
- [ ] Admin settings either functional or clearly labeled as upcoming
- [ ] Admin user actions either work or show disabled state with tooltip
- [ ] Admin dashboard metrics either real or labeled as sample data

---

### TD-010: Gate Render deploys on CI

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 3 |
| Type | Infrastructure |
| Source | INFRA-005 |
| Files | `.github/workflows/`, `render.yaml` |

**Description:** Render auto-deploys from `main` independently of GitHub Actions CI results. A broken build can reach production.

**Acceptance Criteria:**
- [ ] Render auto-deploy disabled
- [ ] CI triggers deploy only after tests pass
- [ ] Or: Render deploy hook called from CI success step

---

### TD-011: Fix CSRF bypass via missing headers

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 3 |
| Type | Security |
| Source | SEC-003 |
| Files | `packages/web/lib/csrf.ts` |

**Description:** When both `Origin` and `Referer` headers are missing, CSRF validation returns null (passes). Attackers can strip these headers.

**Acceptance Criteria:**
- [ ] Decide policy: block or allow requests with no origin (non-browser/API clients)
- [ ] If allowing: document the risk; if blocking: return 403 for missing origin
- [ ] Add test case for missing-header scenario

---

### TD-012: Queue status admin-only

| Field | Value |
|-------|-------|
| Priority | MEDIUM |
| Story Points | 1 |
| Type | Security |
| Source | SEC-004 |
| Files | `packages/web/app/api/queue/status/route.ts` |

**Description:** Queue status endpoint exposes platform-wide job metrics to any authenticated user.

**Acceptance Criteria:**
- [ ] Add admin role check or remove from public API
- [ ] Non-admin users get 403

---

### TD-013: Increase persistent disk and plan audio cleanup

| Field | Value |
|-------|-------|
| Priority | MEDIUM |
| Story Points | 3 |
| Type | Infrastructure |
| Source | INFRA-004, ARCH-009 |
| Files | `render.yaml` |

**Description:** 1GB persistent disk fills after ~5-8 large projects. No cleanup job exists.

**Acceptance Criteria:**
- [ ] Disk increased to 5GB or add R2/S3 offload
- [ ] Cleanup job removes audio older than 30 days
- [ ] Disk usage metric exposed in health endpoint

---

## Sprint 3+: Post-Launch Quality (35+ SP)

### TD-014: Write middleware tests

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 5 |
| Type | Testing |
| Source | TST-013 |
| Files | `packages/web/lib/api/middleware.ts` |

**Description:** `withAuth` and `withProjectAuth` are the security boundary for all routes but have zero test coverage.

**Acceptance Criteria:**
- [ ] Tests for: unauthenticated returns 401, CSRF rejection, rate limiting, project ownership check
- [ ] Tests for `parseBody` Zod validation
- [ ] Edge cases: missing headers, invalid project ID

---

### TD-015: Write Stripe flow tests

| Field | Value |
|-------|-------|
| Priority | HIGH |
| Story Points | 5 |
| Type | Testing |
| Source | TST-014 |
| Files | Stripe checkout/portal/webhook routes |

**Description:** No tests for Stripe checkout creation, portal session, or webhook processing.

**Acceptance Criteria:**
- [ ] Unit tests for checkout session creation with mocked Stripe
- [ ] Webhook signature verification test
- [ ] Subscription lifecycle test (create → upgrade → cancel)

---

### TD-016: Add tests for top 10 untested API routes

| Field | Value |
|-------|-------|
| Priority | MEDIUM |
| Story Points | 8 |
| Type | Testing |
| Source | TST-003 |
| Files | 52 untested API routes |

**Description:** Priority routes: teams, alerts, admin/users, voice-assignments, regenerate-scene, generate, preview, billing.

**Acceptance Criteria:**
- [ ] At least 10 new route test files
- [ ] Each covers: auth required, validation, happy path, error path

---

### TD-017: Migrate component props to camelCase

| Field | Value |
|-------|-------|
| Priority | MEDIUM |
| Story Points | 5 |
| Type | Code Quality |
| Source | CQ-007 |
| Files | `project-workflow.tsx`, `run-history.tsx`, and ~10 components |

**Description:** Component interfaces use snake_case (`page_count`, `script_text`) requiring manual mapping from Prisma camelCase. This caused 3 recent bugs.

**Acceptance Criteria:**
- [ ] All component props use camelCase matching Prisma
- [ ] Mapping layer in `app/projects/[id]/page.tsx` removed
- [ ] No snake_case in client-side TypeScript interfaces

---

### TD-018: Fix accessibility issues

| Field | Value |
|-------|-------|
| Priority | MEDIUM |
| Story Points | 4 |
| Type | UI/UX |
| Source | UX-001, UX-002, UX-003, UX-011 |
| Files | `AlertsDropdown.tsx`, `dashboard/page.tsx`, `admin/layout.tsx` |

**Description:** AlertsDropdown missing ARIA label, decorative icons missing aria-hidden, project cards lack focus-visible, admin sidebar not responsive.

**Acceptance Criteria:**
- [ ] AlertsDropdown has aria-label and live region for count
- [ ] All decorative icons have `aria-hidden="true"`
- [ ] Project cards have focus-visible ring
- [ ] Admin sidebar has responsive hamburger menu

---

### TD-019: Replace console.error with structured logger

| Field | Value |
|-------|-------|
| Priority | LOW |
| Story Points | 3 |
| Type | Code Quality |
| Source | CQ-012 |
| Files | 20+ route files |

**Description:** Most routes use `console.error` instead of the structured `log` utility.

**Acceptance Criteria:**
- [ ] All `console.error` in API routes replaced with `log.error`
- [ ] All `console.warn` replaced with `log.warn`

---

### TD-020: Apply pnpm.overrides for vulnerabilities

| Field | Value |
|-------|-------|
| Priority | LOW |
| Story Points | 1 |
| Type | Security |
| Source | SEC-013, AUDIT-03, AUDIT-05, AUDIT-08 |
| Files | `package.json` (root) |

**Description:** Apply `pnpm.overrides` for safe patch-level dependency fixes: axios >=1.13.5, lodash >=4.17.23, qs >=6.14.2.

**Acceptance Criteria:**
- [ ] `pnpm.overrides` added to root package.json
- [ ] `pnpm audit` shows reduced vulnerability count
- [ ] Build and tests still pass

---

## Backlog (Future Sprints)

| ID | SP | Title | Source |
|----|-----|-------|--------|
| TD-021 | 5 | Subscription state deduplication (Profile vs Subscription) | ARCH-005 |
| TD-022 | 5 | Queue worker concurrency increase | ARCH-007 |
| TD-023 | 3 | JSON column validation (Zod schemas for progress/result) | ARCH-004 |
| TD-024 | 2 | Lazy OpenAI client init in scoring service | ARCH-001 |
| TD-025 | 1 | Fix DELETE verb for project deletion | ARCH-002 |
| TD-026 | 2 | Sanitize user prompts in demo script generation | SEC-006 |
| TD-027 | 1 | Rate limit invite token endpoint | SEC-007 |
| TD-028 | 2 | Reduce health endpoint information exposure | SEC-008 |
| TD-029 | 2 | Update smoke test for Clerk auth | INFRA-011 |
| TD-030 | 1 | Update Docker Compose for Clerk env vars | INFRA-017 |
| TD-031 | 3 | Complete reader payment flow | FC-010 |
| TD-032 | 8 | Plan Next.js 15 upgrade | AUDIT-02 |
| TD-033 | 3 | Extract brand gradient to design token | UX-013 |
| TD-034 | 2 | MSW mock factories migration to camelCase | TST-020 |
| TD-035 | 1 | Remove unused AlertPreference model | FC-015 |
