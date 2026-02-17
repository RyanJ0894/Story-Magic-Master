# Architecture Review: Story Magic

**Date:** 2026-02-15
**Branch:** `feat/clerk-prisma-migration`
**Reviewer:** Chris Therriault (chris@servicevision.net)
**Scope:** Module boundaries, API design, database design, queue architecture, error handling, configuration, scalability, auth

---

## Executive Summary

Story Magic is a well-structured TypeScript monorepo with clear separation between a Next.js 14 frontend/API layer and an Express-based orchestrator for audio generation. The recent migration from Supabase to Clerk + Prisma is architecturally sound but has introduced inconsistency in how API routes handle authentication. The DB-polling queue with stored functions is robust for current scale but will become a bottleneck beyond ~50 concurrent users. The Prisma schema is well-designed with appropriate indexing, though several JSON columns lack validation at the database level. Nine findings are documented below, three of which are high severity.

**Overall Rating:** Good -- production-viable for MVP launch with targeted fixes.

---

## Table of Contents

1. [Module Boundaries](#1-module-boundaries)
2. [API Design](#2-api-design)
3. [Database Design](#3-database-design)
4. [Queue Architecture](#4-queue-architecture)
5. [Error Handling Strategy](#5-error-handling-strategy)
6. [Configuration Management](#6-configuration-management)
7. [Scalability](#7-scalability)
8. [Auth Architecture](#8-auth-architecture)
9. [Findings Summary](#9-findings-summary)

---

## 1. Module Boundaries

### Structure

The `packages/web/lib/` directory organizes domain logic into focused modules:

```
lib/
  queue/          -- Job queue service, worker, types
  generation/     -- Audio generation processor
  scoring/        -- StoryScore LLM evaluation
  adviser/        -- Story-Adviser suggestions
  revisions/      -- Revision tracking & diffing
  comparable/     -- Script corpus + pgvector similarity
  api/            -- Middleware, rate-limit, DTOs, mappers, audit
  features/       -- Feature flags
  stripe/         -- Stripe server helpers
  email/          -- Email sending
  export/         -- PDF/report export
  feedback/       -- User feedback
  validation/     -- Shared Zod schemas
```

**Dependency Direction:** Generally correct -- domain services (`scoring/`, `adviser/`, `revisions/`) depend downward on `db.ts` and `lib/api/` utilities, not on each other. The `queue/worker.ts` depends on `generation/processor.ts`, which is appropriate since the worker is the composition root for background jobs.

**Strengths:**
- Each domain module exports via an `index.ts` barrel, keeping imports clean.
- `lib/api/middleware.ts` provides composable `withAuth`/`withProjectAuth` wrappers that centralize cross-cutting concerns.
- Feature flags (`lib/features/flags.ts`) gate intelligence features cleanly with `FeatureGate` React components.

### Finding: ARCH-001

| Attribute | Value |
|-----------|-------|
| **ID** | ARCH-001 |
| **Title** | Scoring service directly instantiates OpenAI client at module scope |
| **Severity** | Medium |
| **Location** | `/packages/web/lib/scoring/service.ts`, lines 25-27 |
| **Risk** | Module import fails hard if `OPENAI_API_KEY` is unset; blocks all routes that transitively import scoring |
| **Effort** | 2 SP |

**Code:**
```typescript
// packages/web/lib/scoring/service.ts:25-27
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
```

**Recommendation:** Lazy-initialize the OpenAI client inside `generateScore()` or use a factory function. This prevents cold-start failures on routes that import the scoring module but do not actually call OpenAI (e.g., `getLatestScore` only reads from Prisma).

---

## 2. API Design

### Route Inventory

58 API route files across 21 top-level path segments. RESTful resource nesting is well done:

```
/api/projects/[id]/score
/api/projects/[id]/suggestions/[suggestionId]/rewrite
/api/projects/[id]/revisions/compare
```

### Consistency Observations

**Response envelope:** Most routes return `{ error, code }` on failure. Some routes omit the `code` field:
- `/api/shares/route.ts` line 58: `{ error: 'Invalid JSON in request body' }` -- no `code`.
- `/api/admin/stats/route.ts` line 14: `{ error: 'Unauthorized' }` -- no `code`.
- `/api/stripe/webhook/route.ts` line 39: `{ error: 'Invalid signature' }` -- no `code`.

**Naming convention mismatch:** The API layer mixes `camelCase` and `snake_case` in request/response bodies:
- `alerts/route.ts` line 76-97: Manually maps Prisma camelCase to snake_case response.
- `projects/route.ts` line 24-25: Accepts both `scriptText` and `script_text` in request bodies.
- `admin/users/route.ts` line 119-123: Schema uses `snake_case` (`user_type`, `full_name`).
- `shares/route.ts` line 69-77: DTO uses `snake_case` (`project_id`, `access_level`).

### Finding: ARCH-002

| Attribute | Value |
|-----------|-------|
| **ID** | ARCH-002 |
| **Title** | DELETE operation uses POST verb on a non-standard path |
| **Severity** | Low |
| **Location** | `/packages/web/app/api/projects/[id]/delete/route.ts`, line 6 |
| **Risk** | Non-RESTful; confusing for API consumers; returns redirect instead of JSON |
| **Effort** | 1 SP |

**Code:**
```typescript
// packages/web/app/api/projects/[id]/delete/route.ts:6
export async function POST(request: Request, { params }: { params: { id: string } }) {
  // ...
  return NextResponse.redirect(new URL('/dashboard', request.url));
}
```

**Recommendation:** Move DELETE logic to the existing `/api/projects/[id]/route.ts` as a `DELETE` handler. Return a JSON response (`{ success: true }`) instead of a redirect. Redirects from API routes are unexpected behavior for client-side fetch calls.

### Finding: ARCH-003

| Attribute | Value |
|-----------|-------|
| **ID** | ARCH-003 |
| **Title** | Inconsistent error response format across API routes |
| **Severity** | Medium |
| **Location** | Multiple routes (see above) |
| **Risk** | Frontend error handling must account for multiple shapes; harder to build a generic error interceptor |
| **Effort** | 3 SP |

**Recommendation:** Standardize all error responses to `{ error: string, code: string, details?: unknown }`. The `withAuth` middleware already enforces this for auth errors. Create a shared `apiError(message, code, status, details?)` helper and use it in all catch blocks. Audit all 58 routes.

---

## 3. Database Design

### Schema Overview

23 models, 694 lines. Well-organized into logical sections: Auth, Projects, Jobs, Audio, Billing, Sharing, Intelligence, Teams, Alerts, Admin.

**Strengths:**
- Appropriate use of `@@index` directives on foreign keys and common query patterns.
- Composite indexes for common access patterns: `[userId, createdAt(sort: Desc)]` on projects, `[projectId, runNumber]` on jobs.
- `@@unique` constraints on business keys: `[userId, period]` on usage, `[projectId, versionNumber]` on revisions.
- Cascade deletes properly configured -- projects cascade to jobs, audio outputs, shares, etc.
- pgvector extension enabled for script corpus similarity search.

**Indexing Assessment:**
- 50+ indexes across 23 models. Coverage is thorough for current query patterns.
- `ScriptShare` has 5 indexes including `shareToken`, `shareCode`, `projectId`, `sharedBy`, `sharedWith`.
- `Suggestion` has 6 indexes including a composite `[projectId, startLine, endLine]` for range queries.

### Finding: ARCH-004

| Attribute | Value |
|-----------|-------|
| **ID** | ARCH-004 |
| **Title** | JSON columns lack database-level validation |
| **Severity** | Medium |
| **Location** | `/packages/web/prisma/schema.prisma`, lines 76-80, 114, 156, 494, 625 |
| **Risk** | Corrupted JSON in `directorJson`, `voiceAssignments`, `audioOverrides`, `progress`, `changesSummary`, `metadata` could break downstream consumers silently |
| **Effort** | 3 SP |

**Affected columns:**
```
Project.directorJson      (line 76)  -- Nullable JSON, no shape validation
Project.voiceAssignments  (line 79)  -- Default '[]', cast to unknown[] in generate route
Project.audioOverrides    (line 80)  -- Default '[]'
Job.progress              (line 114) -- Written by multiple code paths with varying shapes
Job.result                (line 115) -- Stores metadata.scriptText (potentially 500KB)
Revision.changesSummary   (line 494) -- Nullable JSON
Alert.metadata            (line 625) -- Default '{}'
```

**Recommendation:** For the most critical column (`Job.progress`), create a Zod schema and validate before every write. The `Job.result` column storing full script text as JSON metadata (line 182 of `generate/route.ts`) is concerning for large scripts -- consider storing a reference to the project's `scriptText` rather than duplicating 500KB into the jobs table. For lower-priority columns, add `CHECK` constraints via a migration.

### Finding: ARCH-005

| Attribute | Value |
|-----------|-------|
| **ID** | ARCH-005 |
| **Title** | Subscription state duplicated between Profile and Subscription models |
| **Severity** | Medium |
| **Location** | `/packages/web/prisma/schema.prisma`, lines 25-29 (Profile) and 219-242 (Subscription) |
| **Risk** | Profile stores `subscriptionTier`, `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`, `currentPeriodEnd`. Subscription model stores `plan`, `status`, `stripeCustomerId`, `stripeSubscriptionId`, `currentPeriodStart`, `currentPeriodEnd`. Out-of-sync state creates billing bugs. |
| **Effort** | 5 SP |

**Code (Profile model, lines 25-29):**
```prisma
subscriptionTier     String    @default("free") @map("subscription_tier")
stripeCustomerId     String?   @map("stripe_customer_id")
stripeSubscriptionId String?   @map("stripe_subscription_id")
subscriptionStatus   String    @default("inactive") @map("subscription_status")
currentPeriodEnd     DateTime? @map("current_period_end")
```

**Code (Subscription model, lines 219-242):**
```prisma
plan                 String
status               String    @default("active")
stripeCustomerId     String?   @map("stripe_customer_id")
stripeSubscriptionId String?   @unique @map("stripe_subscription_id")
currentPeriodEnd     DateTime? @map("current_period_end")
```

The Stripe webhook (`/api/stripe/webhook/route.ts`) updates Profile directly (lines 54-61, 77-88, 98-104) but never creates/updates Subscription records. The shares route (`/api/shares/route.ts`, line 94-99) checks `prisma.subscription` for active status, while other routes check `profile.subscriptionTier`. This is a source of truth conflict.

**Recommendation:** Choose one: either Profile is the source of truth for subscription state (drop Subscription model) or Subscription is the source of truth (remove subscription fields from Profile and join when needed). Given the webhook already writes to Profile, the simplest fix is to treat Profile as authoritative and use Subscription only for billing history/audit.

---

## 4. Queue Architecture

### Design

The queue is a DB-polling system using PostgreSQL stored functions for atomic operations:

- **Enqueue:** `queue/service.ts:enqueue()` -- Creates a `Job` row with status `queued`.
- **Dequeue:** `queue/service.ts:dequeueNext()` -- Calls `get_next_queued_job()` stored function which uses `SELECT FOR UPDATE SKIP LOCKED` for safe concurrent access.
- **Completion:** `complete_job()`, `fail_job()` stored functions.
- **Lock management:** 5-minute locks with automatic renewal at 2.5-minute intervals. `cleanup_expired_job_locks()` runs every 60 seconds.
- **Retry:** Configurable `maxRetries` (default 3). `fail_job()` stored function re-queues on failure if retry count < max.

**Strengths:**
- `SKIP LOCKED` prevents double-processing without blocking.
- Lock renewal prevents premature release during long audio generation jobs.
- Graceful shutdown (`stopWorker`) releases held locks.
- The `queue_stats` view provides operational visibility.

### Finding: ARCH-006

| Attribute | Value |
|-----------|-------|
| **ID** | ARCH-006 |
| **Title** | Access token stored in Job.result JSON persisted to database |
| **Severity** | High |
| **Location** | `/packages/web/app/api/generate/route.ts`, lines 182-189 |
| **Risk** | Clerk session tokens are stored in the `jobs.result` JSONB column alongside script text. These tokens are short-lived but still represent credentials persisted to disk. The `result` column is readable by admin routes and appears in job log queries. |
| **Effort** | 2 SP |

**Code:**
```typescript
// packages/web/app/api/generate/route.ts:182-189
result: {
  metadata: {
    scriptText: sanitizedScript,
    pageCount: project.pageCount,
    voiceOverrides,
    accessToken,     // <-- Clerk token persisted to database
  },
},
```

**Recommendation:** Remove `accessToken` from the job metadata. The queue worker runs server-side and should use a service-level authentication mechanism (e.g., a shared secret or Clerk backend API key) to call the orchestrator, not a user's session token. If user-context is needed, pass only the `userId` and have the orchestrator verify via Clerk's backend SDK.

### Finding: ARCH-007

| Attribute | Value |
|-----------|-------|
| **ID** | ARCH-007 |
| **Title** | Queue worker is single-threaded with 5-second polling interval |
| **Severity** | High |
| **Location** | `/packages/web/lib/queue/worker.ts`, lines 27-32 |
| **Risk** | `maxConcurrentJobs: 1` means only one audio generation runs at a time. With 5-second polling and typical generation times of 2-5 minutes, throughput is limited to ~12-30 jobs/hour. Queue backlog grows linearly with concurrent users. |
| **Effort** | 5 SP |

**Code:**
```typescript
// packages/web/lib/queue/worker.ts:27-32
const DEFAULT_CONFIG: WorkerConfig = {
  workerId: `worker-${process.pid}-${Date.now()}`,
  pollIntervalMs: 5000,
  lockDurationSeconds: 300,
  maxConcurrentJobs: 1,
  jobTypes: undefined,
};
```

Note also that the worker module uses module-level state (`let isRunning`, `let currentJobId`, etc. at lines 62-71) which means only one worker instance can exist per process.

**Recommendation:** Short-term: Increase `maxConcurrentJobs` to 3-4 (bound by orchestrator memory for FFmpeg). The worker already supports concurrent job tracking via the `SKIP LOCKED` mechanism. Medium-term: Move to a proper job queue (BullMQ with Redis, or Render's background workers) to support horizontal scaling without polling overhead.

---

## 5. Error Handling Strategy

### Patterns Observed

**Three distinct patterns coexist:**

1. **`withAuth`/`withProjectAuth` middleware** (9 routes): Centralized auth, CSRF, rate limiting. Used primarily by intelligence feature routes (`score`, `suggestions`, `comparables`, `revisions`, `export`, `regenerate-scene`).

2. **Manual auth boilerplate** (~40+ routes): Each route independently calls `auth()`, checks `userId`, handles CSRF with `validateCsrf()`. Examples: `projects/route.ts`, `alerts/route.ts`, `teams/route.ts`, `shares/route.ts`, `generate/route.ts`.

3. **Admin-specific auth** (8 routes): Manual `auth()` call plus additional `profile.userType === 'admin'` check. No centralized admin middleware.

**Logging inconsistency:**
- 68 occurrences of `console.error` or `console.log` across 39 API route files.
- The structured logger (`lib/logger.ts`) is imported only in `generate/route.ts` and queue-related files.
- Admin routes use `console.error` directly (e.g., `admin/users/route.ts` line 113).

### Finding: ARCH-008

| Attribute | Value |
|-----------|-------|
| **ID** | ARCH-008 |
| **Title** | Majority of routes bypass `withAuth` middleware, duplicating auth/CSRF/rate-limit boilerplate |
| **Severity** | High |
| **Location** | ~40 route files (see inventory above) |
| **Risk** | Only 9 of 58 routes use `withAuth`/`withProjectAuth`. The remaining 40+ manually implement auth, and most of them skip rate limiting entirely. Routes like `alerts/route.ts`, `teams/route.ts`, `shares/route.ts`, `admin/users/route.ts` have no rate limiting at all. |
| **Effort** | 8 SP |

**Example of route WITHOUT middleware (no rate limiting):**
```typescript
// packages/web/app/api/alerts/route.ts:17-21
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }
  // ... no rate limiting
```

**Example of route WITH middleware (has rate limiting):**
```typescript
// packages/web/app/api/projects/[id]/score/route.ts (uses withProjectAuth)
export const POST = withProjectAuth(async (request, { userId, prisma, project, projectId }) => {
  // auth, CSRF, rate limiting all handled
```

**Recommendation:** Migrate all authenticated routes to use `withAuth` or `withProjectAuth`. Create a `withAdminAuth` wrapper for the 8 admin routes. This eliminates boilerplate and ensures rate limiting, CSRF, and structured error responses are consistently applied. Prioritize routes exposed to unauthenticated users first (shares, invites).

---

## 6. Configuration Management

### Environment Variables

`render.yaml` declares 30+ environment variables across two services. Secrets are correctly marked `sync: false` (set via Render dashboard, never in YAML).

**Feature flags** use `NEXT_PUBLIC_FF_*` environment variables (lines 96-104 of `render.yaml`), which means changing a flag requires a redeploy. The `lib/features/` module reads these at build time.

**Strengths:**
- Clear separation between build-time public vars (`NEXT_PUBLIC_*`) and server-only secrets.
- `PlatformSetting` model (schema line 687-694) exists for runtime configuration, though current usage is unclear.
- `RATE_LIMIT_DISABLED` env var allows disabling rate limiting in development.

**Observations:**
- No `.env.example` file was found in the repository root for developer onboarding.
- The `WEB_URL` env var on the orchestrator is undocumented in terms of required format.
- `TTS_CONCURRENCY` (line 184) controls parallelism but is not read by the queue worker's `maxConcurrentJobs`.

---

## 7. Scalability

### Current Architecture Constraints

| Component | Constraint | Impact |
|-----------|-----------|--------|
| Web service | `numInstances: 1` (Render starter plan, 512MB) | Single instance handles all API routes |
| Orchestrator | `numInstances: 1` (Render standard plan, 2GB) with persistent disk | Cannot horizontally scale due to disk mount |
| Queue worker | Module-level singleton state, `maxConcurrentJobs: 1` | One job at a time, globally |
| Rate limiting | In-memory fallback when Upstash unavailable | Per-instance limits, not global |
| Database | `basic-256mb` plan (256MB RAM, 1GB storage) | Adequate for MVP; will need upgrade at ~1000 users |

### Horizontal Scaling Readiness

The web service CAN scale horizontally (stateless Next.js). However:
- Rate limiting falls back to in-memory when Upstash is unavailable, creating per-instance limits.
- The queue worker is embedded in the web process (imported from `lib/queue/worker.ts`). If multiple web instances run, multiple workers will compete for jobs -- this IS safe due to `SKIP LOCKED`, but wastes polling resources.

The orchestrator CANNOT scale horizontally due to persistent disk mount at `/var/data/audio`. Audio files are written to local disk and served from there. Migration to object storage (R2 or S3) is required before scaling.

### Finding: ARCH-009

| Attribute | Value |
|-----------|-------|
| **ID** | ARCH-009 |
| **Title** | Orchestrator persistent disk blocks horizontal scaling |
| **Severity** | Medium |
| **Location** | `/render.yaml`, lines 134-137 |
| **Risk** | Render persistent disks are single-instance only. The orchestrator cannot run >1 instance, creating a throughput ceiling. Disk loss = audio output loss (no backup). |
| **Effort** | 8 SP |

**Code:**
```yaml
# render.yaml:134-137
disk:
  name: audio-storage
  mountPath: /var/data/audio
  sizeGB: 1
```

**Recommendation:** Migrate audio storage to Cloudflare R2 or AWS S3 before scaling past MVP. Use signed URLs for client access. The 1GB disk limit will also be hit quickly with production workloads (~100 full-length scripts at ~10MB each).

---

## 8. Auth Architecture

### Current Implementation

**Clerk middleware** (`packages/web/middleware.ts`, lines 1-61): Protects page routes (`/dashboard`, `/projects`, `/settings`, `/admin`, `/billing`, `/writer`, `/reader`). Adds security headers (CSP, HSTS, X-Frame-Options, etc.).

**API-level auth** is NOT handled by the Clerk middleware -- the middleware matcher excludes API routes by design (they need to handle auth programmatically for proper JSON error responses).

**Security headers** are comprehensive:
- Content-Security-Policy with tight allowlists.
- HSTS with 2-year max-age and preload.
- X-Frame-Options SAMEORIGIN.
- Permissions-Policy disables camera, microphone, geolocation.

**CSRF protection** uses origin header validation (`lib/csrf.ts`). Applied consistently to mutation methods.

**Admin authorization** is checked ad-hoc in each admin route by querying `profile.userType`:
```typescript
// packages/web/app/api/admin/stats/route.ts:16-21
const profile = await prisma.profile.findUnique({
  where: { id: userId },
  select: { userType: true },
});
if (profile?.userType !== 'admin') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

This pattern is repeated in all 8 admin routes, performing an extra database query each time. A `withAdminAuth` middleware would eliminate the duplication and the extra round-trip (could cache admin status in the Clerk session claims).

**Webhook routes** correctly skip auth: `stripe/webhook/route.ts` validates via Stripe signature, `webhooks/clerk/route.ts` validates via Clerk webhook secret.

---

## 9. Findings Summary

| ID | Title | Severity | Effort (SP) | Priority |
|----|-------|----------|-------------|----------|
| ARCH-001 | Scoring service eagerly initializes OpenAI client | Medium | 2 | P3 |
| ARCH-002 | DELETE uses POST verb with redirect response | Low | 1 | P4 |
| ARCH-003 | Inconsistent error response format | Medium | 3 | P3 |
| ARCH-004 | JSON columns lack validation | Medium | 3 | P3 |
| ARCH-005 | Subscription state duplicated between Profile and Subscription | Medium | 5 | P2 |
| ARCH-006 | Access token persisted in job metadata | **High** | 2 | **P1** |
| ARCH-007 | Queue worker single-threaded, low throughput | **High** | 5 | **P1** |
| ARCH-008 | Most routes bypass withAuth middleware (no rate limiting) | **High** | 8 | **P1** |
| ARCH-009 | Persistent disk blocks orchestrator scaling | Medium | 8 | P2 |

**Total estimated effort:** 37 SP

### Recommended Fix Order

1. **ARCH-006** (P1, 2 SP) -- Remove access token from job metadata. Security issue.
2. **ARCH-008** (P1, 8 SP) -- Migrate routes to `withAuth` middleware. Ensures rate limiting coverage.
3. **ARCH-007** (P1, 5 SP) -- Increase `maxConcurrentJobs` and refactor worker state for multi-instance safety.
4. **ARCH-005** (P2, 5 SP) -- Resolve subscription source-of-truth before Stripe goes live.
5. **ARCH-009** (P2, 8 SP) -- Migrate to object storage before scaling.
6. **ARCH-003** (P3, 3 SP) -- Standardize error responses.
7. **ARCH-004** (P3, 3 SP) -- Add JSON validation.
8. **ARCH-001** (P3, 2 SP) -- Lazy-init OpenAI client.
9. **ARCH-002** (P4, 1 SP) -- Fix DELETE route.

---

*Review generated 2026-02-15 for Story Magic `feat/clerk-prisma-migration` branch.*
