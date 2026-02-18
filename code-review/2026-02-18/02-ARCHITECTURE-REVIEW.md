# Architecture Review -- Story Magic

**Date:** 2026-02-18
**Reviewer:** Chris Therriault (chris@servicevision.net)
**Scope:** Next.js API routes (`packages/web/app/api/`), Express orchestrator (`packages/orchestrator/src/`), shared middleware, and service communication patterns.

---

## Executive Summary

The codebase shows strong architectural discipline for an MVP. The `withAuth`/`withProjectAuth` middleware pattern, centralized `parseBody` helper, and consistent use of Zod schemas across most routes demonstrate a well-thought-out design. The orchestrator has proper env validation with Zod at startup.

Key areas for improvement center on (1) business logic scattered across route handlers instead of a service layer, (2) inconsistent error response shapes, and (3) some N+1 query patterns in the reader library.

**Total findings: 14**
**Critical: 0 | High: 2 | Medium: 7 | Low: 4 | Informational: 1**

---

## 1. Separation of Concerns

### ARCH-001 | HIGH | Business Logic in Route Handlers
**File:** `packages/web/app/api/generate/route.ts:55-110`
**File:** `packages/web/app/api/preview/route.ts:45-175`
**File:** `packages/web/app/api/shares/access/[code]/route.ts:134-268`
**Description:** Several route handlers contain significant business logic that should be extracted into service modules. The `generate` route includes script sanitization, voice override mapping, job creation, and queue enqueue logic. The `preview` route has budget checking, audio override application, voice override merging, and orchestrator calls. The share access route has subscription checking, view counting, library entry creation, and audio lookup -- all inline.

```typescript
// generate/route.ts -- 110 lines of business logic in the handler
export const POST = withAuth(async (request, { userId, prisma }) => {
  // Parse body (10 lines)
  // Fetch project (5 lines)
  // Validate script content (5 lines)
  // Validate page count (5 lines)
  // Sanitize script (5 lines)
  // Build voice overrides (10 lines)
  // Create job if needed (8 lines)
  // Enqueue job (12 lines)
  // Return response (5 lines)
});
```

**SP:** 8
**Recommendation:** Extract into service modules:
- `lib/generation/service.ts` -- `createGenerationJob(projectId, userId, options)`
- `lib/preview/service.ts` -- `createPreview(projectId, sceneId, userId)`
- `lib/shares/service.ts` -- `accessShare(code, userId?)` and `verifySharePassword(code, password)`

This would reduce route handlers to 10-20 lines each: validate input, call service, return response.

---

### ARCH-002 | MEDIUM | Admin Authorization Duplicated Across Routes
**File:** `packages/web/app/api/admin/audit-logs/route.ts:4-9`
**File:** `packages/web/app/api/admin/settings/route.ts:22-27`
**File:** `packages/web/app/api/admin/stats/route.ts:7-12`
**File:** `packages/web/app/api/admin/subscriptions/route.ts:11-18`
**File:** `packages/web/app/api/admin/users/route.ts:13-18`
**Description:** Every admin route repeats the same pattern: fetch profile, check `userType === 'admin'`, return 403. This is done 8+ times across admin routes.

```typescript
// Repeated in EVERY admin route handler:
const profile = await prisma.profile.findUnique({
  where: { id: userId },
  select: { userType: true },
});
if (profile?.userType !== 'admin') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**SP:** 3
**Recommendation:** Create a `withAdminAuth` middleware that extends `withAuth`:
```typescript
export function withAdminAuth(handler, options) {
  return withAuth(async (request, ctx) => {
    const profile = await ctx.prisma.profile.findUnique({
      where: { id: ctx.userId }, select: { userType: true },
    });
    if (profile?.userType !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return handler(request, { ...ctx, isAdmin: true });
  }, options);
}
```

---

### ARCH-003 | MEDIUM | Ownership Verification Duplicated in Suggestion/Revision Routes
**File:** `packages/web/app/api/suggestions/[id]/route.ts:49-67`
**File:** `packages/web/app/api/suggestions/[id]/rewrite/route.ts:63-77`
**File:** `packages/web/app/api/revisions/[id]/route.ts:51-65`
**File:** `packages/web/app/api/revisions/[id]/compare/[toId]/route.ts:32-46`
**Description:** The `verifySuggestionOwnership` and `verifyRevisionOwnership` helper functions are **duplicated** in each route file. Each file defines its own copy of the same function.

```typescript
// Defined identically in suggestions/[id]/route.ts AND suggestions/[id]/rewrite/route.ts
async function verifySuggestionOwnership(suggestionId, userId): Promise<boolean> {
  const suggestion = await prisma.suggestion.findUnique({
    where: { id: suggestionId },
    select: { project: { select: { userId: true } } },
  });
  return suggestion?.project.userId === userId;
}
```

**SP:** 2
**Recommendation:** Extract to `lib/suggestions/ownership.ts` and `lib/revisions/ownership.ts`, or better yet, create `withSuggestionAuth` and `withRevisionAuth` middleware wrappers.

---

## 2. Error Handling Patterns

### ARCH-004 | HIGH | Inconsistent Error Response Shapes
**File:** Multiple routes
**Description:** Error responses use at least 4 different shapes across the codebase, making it difficult for the frontend to handle errors consistently.

**Shape 1** (most routes): `{ error: string, code: string, details?: object }`
```typescript
// generate/route.ts
{ error: 'Invalid request parameters', code: 'VALIDATION_ERROR', details: ... }
```

**Shape 2** (admin routes): `{ error: string }` (no code)
```typescript
// admin/stats/route.ts
{ error: 'Forbidden' }
```

**Shape 3** (share routes): `{ error: string, details?: object }` (no code)
```typescript
// shares/[shareId]/route.ts
{ error: 'Invalid request', details: parseResult.error.flatten().fieldErrors }
```

**Shape 4** (some routes): `{ error: string, code: string, details: string }` (details as string, not object)
```typescript
// alerts/route.ts
{ error: 'Failed to list alerts', code: 'LIST_ERROR', details: error.message }
```

**SP:** 5
**Recommendation:** Define a standard `ApiError` type and helper:
```typescript
interface ApiError { error: string; code: string; details?: Record<string, unknown> }
function apiError(error: string, code: string, status: number, details?: object): NextResponse
```
Apply to all routes. The `code` field should always be present for programmatic error handling.

---

### ARCH-005 | MEDIUM | Error Details Leak Internal Information
**File:** `packages/web/app/api/alerts/route.ts:51-54`
**File:** `packages/web/app/api/projects/[id]/feedback/route.ts:93`
**File:** `packages/web/app/api/admin/corpus/populate/route.ts:23`
**Description:** Several routes return `error.message` in the `details` field of error responses. In production, this could leak internal implementation details (database errors, file paths, etc.).

```typescript
// alerts/route.ts
return NextResponse.json({
  error: 'Failed to list alerts',
  code: 'LIST_ERROR',
  details: error instanceof Error ? error.message : 'Unknown error',  // Leaks internals
}, { status: 500 });
```

**SP:** 2
**Recommendation:** In production, return a generic message. Include `details` only when `NODE_ENV !== 'production'`. Log the full error server-side.

---

### ARCH-006 | LOW | Inconsistent HTTP Status Codes for Similar Operations
**File:** Multiple
**Description:** Authorization failures return different status codes depending on the route:
- Admin routes return `403` with `{ error: 'Forbidden' }`
- Job ownership failures return `403` with `{ error: 'Forbidden', code: 'FORBIDDEN' }`
- Project ownership failures return `404` (via `withProjectAuth`) -- correct, to prevent enumeration
- Share ownership failures return `404` with `{ error: 'Share not found or not authorized' }`
- Team access failures return `403` with `{ error: 'Access denied', code: 'FORBIDDEN' }`

The inconsistency between 403 and 404 for ownership failures is partially intentional (404 prevents enumeration), but should be documented as a policy.

**SP:** 1
**Recommendation:** Document the authorization response policy: "Return 404 for resource ownership failures to prevent enumeration. Return 403 only for role-based access (admin) where the resource ID is already known to the user."

---

## 3. Database Query Patterns

### ARCH-007 | MEDIUM | N+1 Query Pattern in Reader Library
**File:** `packages/web/app/api/reader/library/route.ts:62-95`
**Description:** The reader library GET handler makes 4 sequential database calls after the initial `findMany`:
1. `findMany` -- library entries with includes
2. `findMany` -- active subscriptions for all writers
3. `findMany` -- audio outputs for all projects
4. Transform and return

While queries 2 and 3 use `{ in: [...] }` (batched, not N+1), the handler still makes 3 separate round-trips that could be optimized.

```typescript
// Three separate queries after initial findMany:
const entries = await prisma.readerLibrary.findMany({ ... });

// Batch 2: subscription status for all writers
const activeSubscriptions = await prisma.subscription.findMany({
  where: { userId: { in: writerIds }, status: { in: ['active', 'trialing'] } },
});

// Batch 3: audio durations for all projects
const audioOutputs = await prisma.audioOutput.findMany({
  where: { projectId: { in: projectIds } },
});
```

**SP:** 3
**Recommendation:** Use `Promise.all` to parallelize the subscription and audio output queries. They are independent and can run concurrently:
```typescript
const [activeSubscriptions, audioOutputs] = await Promise.all([
  prisma.subscription.findMany({ where: { userId: { in: writerIds } } }),
  prisma.audioOutput.findMany({ where: { projectId: { in: projectIds } } }),
]);
```

---

### ARCH-008 | MEDIUM | Admin Stats Makes 9 Sequential Queries
**File:** `packages/web/app/api/admin/stats/route.ts:16-31`
**Description:** The admin stats endpoint already uses `Promise.all` to parallelize 9 count queries, which is good. However, 9 separate `COUNT(*)` queries could be replaced with a single aggregation query or materialized view for better performance as the user base grows.

```typescript
const [totalUsers, writerCount, readerCount, ...] = await Promise.all([
  prisma.profile.count(),
  prisma.profile.count({ where: { userType: 'writer' } }),
  prisma.profile.count({ where: { userType: 'reader' } }),
  // ...6 more count queries
]);
```

**SP:** 2
**Recommendation:** For now, this is acceptable with `Promise.all`. When the platform grows beyond ~10K users, consider replacing with a single raw SQL query using conditional aggregation:
```sql
SELECT
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE user_type = 'writer') as writer_count,
  ...
FROM profiles;
```

---

### ARCH-009 | LOW | Missing Prisma `select` on Full Project Fetch
**File:** `packages/web/app/api/projects/[id]/route.ts:25`
**Description:** The `withProjectAuth` middleware fetches the full project record (all columns) even though most route handlers only need a few fields. The `project` object in the context is typed as `Record<string, unknown>`, losing type safety.

```typescript
// middleware.ts -- fetches ALL columns
const project = await prisma.project.findFirst({
  where: { id: projectId, userId },
});
// Returns project as Record<string, unknown>
```

**SP:** 2
**Recommendation:** Add a `select` option to `withProjectAuth` that defaults to common fields, or allow route handlers to specify which fields they need. This reduces data transfer and improves type safety.

---

## 4. API Design

### ARCH-010 | MEDIUM | Dual Route Patterns for Same Resources
**File:** `packages/web/app/api/projects/[id]/suggestions/[suggestionId]/route.ts`
**File:** `packages/web/app/api/suggestions/[id]/route.ts`
**File:** `packages/web/app/api/projects/[id]/suggestions/[suggestionId]/rewrite/route.ts`
**File:** `packages/web/app/api/suggestions/[id]/rewrite/route.ts`
**Description:** Suggestions and rewrites are accessible via two different URL patterns:
1. `/api/projects/[id]/suggestions/[suggestionId]` (nested under project, uses `withProjectAuth`)
2. `/api/suggestions/[id]` (standalone, uses `withAuth` + manual ownership check)

Both patterns exist for revisions as well. This doubles the attack surface and maintenance burden.

```
# Duplicate routes:
/api/projects/[id]/suggestions/[suggestionId]        -- withProjectAuth
/api/suggestions/[id]                                  -- withAuth + verifySuggestionOwnership

/api/projects/[id]/suggestions/[suggestionId]/rewrite -- withProjectAuth
/api/suggestions/[id]/rewrite                          -- withAuth + verifySuggestionOwnership

/api/projects/[id]/revisions/compare                   -- withProjectAuth
/api/revisions/[id]/compare/[toId]                     -- withAuth + verifyRevisionOwnership
```

**SP:** 3
**Recommendation:** Pick one pattern and deprecate the other. The nested pattern (`/api/projects/[id]/...`) is preferable because `withProjectAuth` handles ownership checking automatically. Add deprecation headers to the standalone routes and migrate frontend callers.

---

### ARCH-011 | LOW | Response Format Inconsistency
**File:** Multiple
**Description:** Response envelope formats vary across routes:

| Pattern | Example Routes |
|---------|---------------|
| `{ project: {...} }` | GET /api/projects/[id] |
| `{ projects: [...] }` | GET /api/projects |
| `{ data: {...} }` | GET /api/admin/users/[id] |
| `{ data: [...], pagination: {...} }` | GET /api/admin/users |
| `{ success: true, ... }` | POST /api/projects/[id]/score |
| Direct object (no envelope) | POST /api/projects, PATCH /api/admin/subscriptions |
| `{ share: {...} }` | GET /api/shares/[id] |

The admin routes use `data` as the envelope key, while other routes use the resource name. Some mutation responses include `success: true`, others don't.

**SP:** 3
**Recommendation:** Standardize on a convention: `{ [resourceName]: data }` for single resources, `{ [pluralName]: data[], pagination?: {...} }` for lists, `{ success: true, [resourceName]?: data }` for mutations. Document in the OpenAPI spec.

---

## 5. Configuration Management

### ARCH-012 | LOW | Web Package Missing Env Validation
**File:** `packages/orchestrator/src/lib/env.ts` (good example)
**File:** `packages/web/` (no equivalent)
**Description:** The orchestrator has comprehensive Zod-based environment validation at startup (`validateEnv()` + `printEnvSummary()`). The web package has no equivalent -- environment variables are accessed via `process.env.X` throughout route handlers with no startup validation.

```typescript
// Orchestrator has this (good):
const envSchema = z.object({
  PORT: z.string().default('22002'),
  DATABASE_URL: optionalString,
  OPENAI_API_KEY: optionalString,
  ...
});

// Web package: no env validation at all
// Routes just do: process.env.OPENAI_API_KEY (may be undefined)
```

**SP:** 3
**Recommendation:** Create `packages/web/lib/env.ts` with a Zod schema for all required environment variables. Call `validateEnv()` in the Next.js instrumentation hook or in a shared module imported by routes.

---

## 6. Service Communication

### ARCH-013 | MEDIUM | Orchestrator Fetch Calls Lack Timeout and Retry
**File:** `packages/web/app/api/preview/route.ts:130-148`
**File:** `packages/web/app/api/reader/upload/process/route.ts:117-134`
**Description:** Calls from the web service to the orchestrator use plain `fetch()` without timeout configuration or retry logic. If the orchestrator is slow or unresponsive, the web request will hang until the default timeout (which may be very long or infinite).

```typescript
// preview/route.ts
const response = await fetch(`${orchestratorUrl}/preview`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(serviceKey && { 'X-Service-Key': serviceKey }) },
  body: JSON.stringify({ project_id: projectId, scene }),
  // No timeout, no retry
});
```

**SP:** 3
**Recommendation:** Add `signal: AbortSignal.timeout(30000)` to all orchestrator fetch calls. Consider creating a shared `orchestratorFetch()` wrapper in `lib/orchestrator/client.ts` that includes:
- Timeout (30s for generation, 60s for orchestration)
- Retry with exponential backoff (1 retry)
- Consistent error handling
- Service key injection
- Structured logging

---

### ARCH-014 | INFORMATIONAL | Fire-and-Forget Processing in Upload Route
**File:** `packages/web/app/api/reader/upload/process/route.ts:73`
**Description:** The upload processing route calls `triggerProcessing()` without `await`, creating a fire-and-forget async operation. While this is intentional (the route returns immediately with a job ID), the `triggerProcessing` function uses the module-level `prisma` import instead of the one from the route context, and errors in the async processing are caught but may not be properly tracked.

```typescript
// Route handler returns immediately
triggerProcessing(projectId, job.id, filePath, needsOCR);  // No await
return NextResponse.json({ projectId, jobId: job.id, status: 'processing' });
```

**SP:** 1
**Recommendation:** This pattern is acceptable for MVP. For production hardening:
1. Use the queue system (`enqueue()`) instead of fire-and-forget
2. Add Sentry breadcrumbs to the async function
3. Track the promise to prevent unhandled rejections (add `.catch()`)

---

## Findings Summary Table

| ID | Severity | SP | Description | File(s) |
|----|----------|----|----|---------|
| ARCH-001 | HIGH | 8 | Business logic in route handlers instead of service layer | generate, preview, shares/access |
| ARCH-002 | MEDIUM | 3 | Admin authorization check duplicated 8+ times | admin/*/route.ts |
| ARCH-003 | MEDIUM | 2 | Ownership verification functions duplicated across files | suggestions/*, revisions/* |
| ARCH-004 | HIGH | 5 | Inconsistent error response shapes (4+ formats) | multiple |
| ARCH-005 | MEDIUM | 2 | Error details leak internal info in production | alerts, feedback, corpus |
| ARCH-006 | LOW | 1 | Inconsistent HTTP status codes for auth failures | multiple |
| ARCH-007 | MEDIUM | 3 | Reader library queries could be parallelized | reader/library/route.ts |
| ARCH-008 | MEDIUM | 2 | Admin stats uses 9 separate count queries | admin/stats/route.ts |
| ARCH-009 | LOW | 2 | withProjectAuth fetches all columns, loses type safety | middleware.ts |
| ARCH-010 | MEDIUM | 3 | Duplicate route patterns for suggestions/revisions | suggestions/*, revisions/* |
| ARCH-011 | LOW | 3 | Response format varies across routes | multiple |
| ARCH-012 | LOW | 3 | Web package lacks env validation at startup | packages/web/ |
| ARCH-013 | MEDIUM | 3 | Orchestrator fetch calls have no timeout or retry | preview, upload/process |
| ARCH-014 | INFO | 1 | Fire-and-forget async in upload route | reader/upload/process |

**Total Story Points:** 41 SP

---

## Architecture Strengths

1. **Middleware composition:** `withAuth`, `withProjectAuth`, and `parseBody` eliminate boilerplate and enforce security by default. CSRF validation is automatic for mutations.

2. **Rate limiting tiers:** Three-tier rate limiting (strict/normal/loose) with Redis + in-memory fallback is production-ready. Expensive routes (generation, preview, score) correctly use `strict`.

3. **Zod validation coverage:** ~80% of mutation routes use Zod schemas. The `parseBody` helper makes it easy to add validation.

4. **Orchestrator env validation:** The orchestrator validates all env vars at startup with Zod, failing fast on misconfiguration.

5. **Audit logging:** Admin actions have comprehensive audit trails with IP, user agent, and before/after state.

6. **Queue system:** Jobs are persisted in the database with status tracking, enabling crash recovery and observability.

7. **Webhook security:** Both Stripe and Clerk webhooks verify cryptographic signatures before processing.

---

## Recommended Priority Order

### Sprint 1 (Quick Wins, ~8 SP)
1. ARCH-002: Create `withAdminAuth` middleware (3 SP)
2. ARCH-003: Extract ownership helpers (2 SP)
3. ARCH-007: Parallelize reader library queries (3 SP)

### Sprint 2 (Error Consistency, ~7 SP)
4. ARCH-004: Standardize error response format (5 SP)
5. ARCH-005: Redact error details in production (2 SP)

### Sprint 3 (Service Layer, ~11 SP)
6. ARCH-001: Extract business logic to service modules (8 SP)
7. ARCH-013: Create orchestrator fetch wrapper with timeout/retry (3 SP)

### Sprint 4 (Cleanup, ~12 SP)
8. ARCH-010: Deprecate duplicate route patterns (3 SP)
9. ARCH-011: Standardize response envelopes (3 SP)
10. ARCH-012: Add web env validation (3 SP)
11. ARCH-009: Add select to withProjectAuth (2 SP)
12. ARCH-006: Document auth response policy (1 SP)
