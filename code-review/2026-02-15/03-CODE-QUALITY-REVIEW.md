# Code Quality Review -- Story Magic

**Date:** 2026-02-15
**Branch:** `feat/clerk-prisma-migration`
**Reviewer:** Chris Therriault (chris@servicevision.net)
**Scope:** `packages/web/` and `packages/orchestrator/` source code

---

## Executive Summary

Code quality across the Story Magic monorepo is strong. Only 3 `as any` casts remain in active source (all justified), type safety is enforced via Zod schemas at API boundaries, and naming conventions are consistent within each layer. The main gaps are (a) incomplete adoption of the `withAuth`/`withProjectAuth` middleware -- roughly 75% of routes still inline auth/CSRF boilerplate, (b) a substantial number of `as unknown` casts in the web package that mask Prisma JSON column typing, and (c) mixed logging strategies across API routes.

**Overall Grade: B+**

---

## 1. Type Safety

### CQ-001 -- Three `as any` casts are justified and documented

| Location | Reason |
|----------|--------|
| `packages/web/app/projects/[id]/page.tsx:191` | `enrichedJobs as any` -- Props type mismatch between server component query result and client component `EnrichedJob[]` interface |
| `packages/orchestrator/src/lib/logger.ts:55` | `(pinoHttpModule as any).default ?? pinoHttpModule` -- ESM/CJS interop for pino-http dynamic import |
| `packages/orchestrator/src/orchestrator/workers/whisper-align.ts:178` | `form as any` -- FormData body passed to `fetch()` where the type system cannot resolve form-data's stream type |

All three are annotated with `eslint-disable-next-line @typescript-eslint/no-explicit-any` comments, showing deliberate suppression rather than negligence.

**Severity: Low** -- Acceptable tech debt. The `enrichedJobs` cast (CQ-001a) could be eliminated by exporting a shared type from the client component and using it in the server component's query projection.

### CQ-002 -- 40+ `as unknown` casts in web package indicate Prisma JSON column friction

Prisma's `Json` column type resolves to `Prisma.JsonValue` at runtime, which is essentially `unknown`. The codebase works around this by casting through `as unknown as SpecificType` in service layers:

- `packages/web/lib/adviser/service.ts` -- 10 occurrences (lines 163, 202, 217, 242, 292, 348, 367, 405)
- `packages/web/lib/revisions/service.ts` -- 7 occurrences (lines 84, 133, 143, 162, 174, 190, 337)
- `packages/web/lib/scoring/service.ts` -- 3 occurrences (lines 177, 196, 208)
- `packages/web/lib/queue/service.ts` -- 2 occurrences (lines 251, 283)
- `packages/web/app/api/stripe/webhook/route.ts` -- 3 occurrences (lines 74, 113, 161)

The adviser, revisions, and scoring services follow a consistent pattern: each defines `RowType` and `rowToX()` mapper functions, then casts the Prisma result through `as unknown as RowType`. This is a well-structured approach but could be improved.

**Recommendation:** Create a generic `castJsonResult<T>(row: unknown): T` utility, or use Prisma's `$extends` API to type JSON columns at the client level. The Stripe webhook casts (line 74: `subscription as unknown as { current_period_end?: number }`) are more concerning -- the Stripe SDK's types already include `current_period_end` on `Stripe.Subscription`, suggesting an outdated `@types/stripe` or incorrect import.

**Severity: Medium** -- Functional but creates maintenance risk. If the Prisma schema changes, the `as unknown` casts will silently accept mismatched types.

### CQ-003 -- `director_json?: any` in client component props

In `packages/web/app/projects/[id]/project-workflow.tsx:100`:

```typescript
interface ProjectWorkflowProps {
  project: {
    // ...
    director_json?: any;  // Untyped JSON blob
  };
}
```

The Director JSON has a well-defined schema in `packages/orchestrator/src/schemas/director-json.test.ts`. This type should be shared.

**Severity: Low** -- Only used for a truthiness check (`!!project.director_json?.scenes` at line 384), but leaves the door open for unvalidated access later.

### CQ-004 -- Orchestrator `as unknown as string` for ffmpeg-static path

Five files cast `ffmpegStatic as unknown as string`:
- `packages/orchestrator/src/orchestrator/preview-pipeline.ts:26`
- `packages/orchestrator/src/orchestrator/workers/progressive-stitch.ts:27`
- `packages/orchestrator/src/orchestrator/workers/export.ts:13`
- `packages/orchestrator/src/orchestrator/workers/mixer.ts:24`
- `packages/orchestrator/src/orchestrator/pipeline.ts:36`

This is a known issue with `ffmpeg-static`'s type declarations. The cast is correct but repeated in every file.

**Recommendation:** Extract `const ffmpegPath = ffmpegStatic as unknown as string` into a shared `packages/orchestrator/src/lib/ffmpeg-path.ts` module.

**Severity: Low** -- Correct but violates DRY.

---

## 2. Code Duplication

### CQ-005 -- Auth/CSRF middleware adoption is incomplete (~75% of routes inline boilerplate)

The project has a well-designed middleware layer in `packages/web/lib/api/middleware.ts` that provides:
- `withAuth(handler, options)` -- Clerk auth + CSRF + rate limiting
- `withProjectAuth(handler, options)` -- Auth + project ownership lookup
- `parseBody(request, zodSchema)` -- Safe JSON parsing + Zod validation

**Routes using middleware (10 routes):**
- `packages/web/app/api/projects/[id]/score/route.ts` -- `withProjectAuth`
- `packages/web/app/api/projects/[id]/suggestions/route.ts` -- `withProjectAuth`
- `packages/web/app/api/projects/[id]/export/route.ts`
- `packages/web/app/api/projects/[id]/revisions/route.ts`
- `packages/web/app/api/projects/[id]/comparables/route.ts`
- `packages/web/app/api/projects/[id]/revisions/compare/route.ts`
- `packages/web/app/api/projects/[id]/suggestions/[suggestionId]/rewrite/route.ts`
- `packages/web/app/api/projects/[id]/suggestions/[suggestionId]/route.ts`
- `packages/web/app/api/projects/[id]/regenerate-scene/route.ts`

**Routes inlining auth boilerplate (45+ routes):** All other `auth()` call sites, including:
- `packages/web/app/api/projects/route.ts` -- Inlines `auth()`, `validateCsrf()`, JSON parse, and Zod validation
- `packages/web/app/api/alerts/route.ts` -- Inlines the same pattern
- `packages/web/app/api/teams/route.ts` -- Inlines the same pattern
- `packages/web/app/api/shares/route.ts`
- `packages/web/app/api/generate/route.ts`
- All Stripe routes, job routes, admin routes, etc.

Each inline route repeats 15-25 lines of auth/CSRF/validation boilerplate that `withAuth` handles in 1 line.

**Severity: High** -- This is the single largest code quality issue. The middleware was clearly added after many routes were written. Inconsistency means that a security change (e.g., switching CSRF strategy) must be applied to 45+ files instead of 1.

**Recommendation:** Migrate all routes to use `withAuth`/`withProjectAuth`. Priority order: mutation routes (POST/PATCH/DELETE) first, then GET routes.

### CQ-006 -- Prisma mock objects duplicated across 3 test setup files

The mock Prisma client is defined independently in:
1. `packages/web/tests/setup.ts` (lines 51-93) -- Full mock with 10 models
2. `packages/web/tests/setup-component.tsx` (lines 117-127) -- Partial mock with 4 models
3. Each unit test file (e.g., `tests/unit/api/projects-route.test.ts:21-32`) -- Local mock

The setup.ts version has `storyScore`, `audioOutput`, `team`, `teamMember`, etc. The component setup only has `project`, `profile`, `job`, `subscription`. This divergence means component tests will crash if they ever touch team or alert APIs.

**Severity: Medium** -- Extract a shared `createMockPrisma()` factory.

---

## 3. Naming Conventions

### CQ-007 -- snake_case vs camelCase boundary is at the component prop layer

Prisma schema uses camelCase (`scriptText`, `pageCount`, `directorJson`). Client components use snake_case in their prop interfaces:

`packages/web/app/projects/[id]/project-workflow.tsx:93-134`:
```typescript
interface ProjectWorkflowProps {
  project: {
    page_count: number;        // snake_case
    script_text: string;       // snake_case
    director_json?: any;       // snake_case
    current_run_number: number; // snake_case
  };
  storyScore?: {
    overall_score?: number;    // snake_case
  };
  audioOverrides?: {
    total_scenes: number;         // snake_case
    scenes_with_overrides: number; // snake_case
  };
}
```

The server component (`packages/web/app/projects/[id]/page.tsx:165-194`) bridges this by manually mapping:
```typescript
page_count: project.pageCount,
script_text: project.scriptText || '',
director_json: project.directorJson,
```

This is a legacy pattern from the Supabase era (Supabase returned snake_case column names). Now that Prisma returns camelCase natively, the mapping layer is unnecessary.

**Severity: Medium** -- The mapping works but adds a translation layer that can break (3 API mismatches were recently fixed per the task context). Migrating component props to camelCase would eliminate this entire class of bugs.

### CQ-008 -- MSW mock handlers use snake_case (stale from Supabase era)

`packages/web/tests/mocks/handlers.ts` uses snake_case in all mock factory functions:
```typescript
export const createMockProject = (overrides = {}) => ({
  user_id: 'user-123',    // Should be userId
  page_count: 90,          // Should be pageCount
  created_at: new Date()   // Should be createdAt
});
```

These mocks were written for the Supabase API response format. They should be updated to match Prisma's camelCase output.

**Severity: Low** -- Tests still pass because they test against MSW responses, not real Prisma queries. But it creates confusion when writing new tests.

---

## 4. Dead Code

### CQ-009 -- No remaining Supabase utility files in source

Grep confirms 0 Supabase imports in active source (`packages/web/lib/`, `packages/web/app/`). The 14 files found containing "supabase" are:
- Test files (6): Test mocks referencing old patterns in comments
- `packages/web/prisma/migrations/0001_init/migration.sql`: SQL migration
- `packages/web/supabase/migrations/`: Legacy migration directory (should be removed or archived)
- `packages/web/app/privacy/page.tsx`: Legal text mentioning Supabase as a vendor
- `packages/web/app/admin/settings/page.tsx`: Settings page (needs investigation)

**Severity: Low** -- Migration is clean. The `supabase/migrations/` directory should be removed to avoid confusion since Prisma now owns the schema.

### CQ-010 -- Orchestrator dist/ contains compiled test files

`packages/orchestrator/dist/` contains compiled `.test.js` and `.test.js.map` files. Test files should be excluded from the build output via tsconfig `exclude` patterns.

**Severity: Low** -- Increases build artifact size but no runtime impact.

---

## 5. Error Handling

### CQ-011 -- Structured error responses are consistent across routes

All 58 API routes return errors in a consistent format:
```json
{ "error": "Human-readable message", "code": "MACHINE_CODE", "details?": "..." }
```

Error codes follow a clear taxonomy:
- `AUTH_REQUIRED` -- 401 responses
- `CSRF_ERROR` -- 403 CSRF failures
- `VALIDATION_ERROR` -- 400 Zod parse failures
- `PROJECT_NOT_FOUND` -- 404 ownership-scoped lookups
- Domain-specific: `QUEUE_ERROR`, `CANCEL_FAILED`, `CANCEL_ERROR`, `LIST_ERROR`, `CREATE_ERROR`, `FETCH_ERROR`

This is excellent for client-side error handling.

### CQ-012 -- Mixed logging: console.error (20+ routes) vs structured logger (5 routes)

The project has a structured logger at `packages/web/lib/logger.ts` but only 5 API routes import it:
- `packages/web/app/api/generate/route.ts`
- `packages/web/app/api/preview/route.ts`
- `packages/web/app/api/projects/[id]/regenerate-scene/route.ts`
- `packages/web/app/api/reader/upload/process/route.ts`
- `packages/web/app/api/generate-demo-script/route.ts`

The remaining 20+ routes use `console.error('[Tag] Error message:', error)`. While the tag prefix pattern is consistent (e.g., `[Teams]`, `[Alerts]`, `[Invite]`), `console.error` output lacks structured metadata (request ID, user ID, duration) needed for production observability.

**Severity: Medium** -- The generation-critical routes use the logger (good), but Stripe webhook errors, share management errors, and admin route errors go to unstructured console. These are exactly the routes that need traceability in production.

**Recommendation:** Add the structured logger to `withAuth` middleware so all routes get it automatically.

### CQ-013 -- Stripe webhook route uses defensive `as unknown` for known SDK types

`packages/web/app/api/stripe/webhook/route.ts:74`:
```typescript
const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;
```

`Stripe.Subscription` already has `current_period_end` as a property. This cast suggests either a type version mismatch or an earlier workaround that was never removed.

**Severity: Low** -- Works correctly but obscures the type system.

---

## Findings Summary

| ID | Severity | Category | Summary |
|----|----------|----------|---------|
| CQ-001 | Low | Type Safety | 3 `as any` casts -- all justified and eslint-suppressed |
| CQ-002 | Medium | Type Safety | 40+ `as unknown` casts for Prisma JSON columns |
| CQ-003 | Low | Type Safety | `director_json?: any` in ProjectWorkflowProps |
| CQ-004 | Low | Type Safety | ffmpeg-static path cast repeated in 5 files |
| CQ-005 | **High** | Duplication | 75% of routes inline auth/CSRF instead of using middleware |
| CQ-006 | Medium | Duplication | Prisma mock defined independently in 3 test setups |
| CQ-007 | Medium | Naming | snake_case component props require manual mapping from camelCase Prisma |
| CQ-008 | Low | Naming | MSW mock handlers use stale snake_case format |
| CQ-009 | Low | Dead Code | `supabase/migrations/` directory should be archived |
| CQ-010 | Low | Dead Code | Compiled test files in orchestrator dist/ |
| CQ-011 | None | Error Handling | Structured error codes are consistent (positive finding) |
| CQ-012 | Medium | Error Handling | 20+ routes use console.error instead of structured logger |
| CQ-013 | Low | Error Handling | Stripe webhook casts around known SDK types |

**High: 1 | Medium: 4 | Low: 7 | Positive: 1**

---

## Recommended Priority Actions

1. **Migrate all API routes to withAuth/withProjectAuth middleware** (CQ-005) -- Estimated 2-3 hours. Eliminates ~500 lines of duplicated boilerplate and centralizes security policy.
2. **Add structured logger to middleware** (CQ-012) -- 30 minutes. Automatically provides request tracing to all routes.
3. **Migrate component props from snake_case to camelCase** (CQ-007) -- Estimated 2 hours. Eliminates the mapping layer that caused 3 recent bugs.
4. **Create shared Prisma JSON typing utilities** (CQ-002) -- 1 hour. Reduces `as unknown` casts and improves refactor safety.
