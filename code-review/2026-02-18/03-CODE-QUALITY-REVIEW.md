# Code Quality Review -- Story Magic

**Date:** 2026-02-18
**Reviewer:** Chris Therriault <chris@servicevision.net>
**Scope:** `packages/web/` (Next.js 14) and `packages/orchestrator/` (Express/TypeScript)
**Method:** Static analysis via grep/ripgrep + manual source inspection

---

## Executive Summary

The codebase is generally well-structured with consistent file organization, comprehensive JSDoc, and good use of Zod for request validation in newer routes. However, several systemic patterns degrade type safety and maintainability:

1. **40 `as unknown as` casts** across service layers, almost all working around Prisma return types
2. **Inconsistent error handling** -- 5 different catch-block patterns across 112+ catch blocks in API routes
3. **Duplicate OpenAI client initialization** in 3 separate files
4. **30+ API routes manually parsing JSON** instead of using the existing `parseBody` helper
5. **70 `console.*` calls** in production code alongside a structured logger

**Total findings:** 18
**Estimated remediation:** 38 SP

---

## 1. Type Safety

### CQ-001 | CRITICAL | Systemic `as unknown as Row` casts in service layer

**Files:** Multiple service files in `packages/web/lib/`
**Count:** 16 instances across 4 service files

Every Prisma query result in the adviser, scoring, revisions, and queue services is double-cast through `as unknown as XxxRow` before being passed to a row-to-domain converter function. This bypasses all type checking between the Prisma schema and the application domain types.

**Worst offender -- `packages/web/lib/adviser/service.ts`:**
```typescript
// Line 163
suggestions.push(rowToSuggestion(inserted as unknown as SuggestionRow));

// Line 202
return sortSuggestions((data as unknown as SuggestionRow[]).map(rowToSuggestion));

// Line 217
return rowToSuggestion(data as unknown as SuggestionRow);

// Line 242
return rowToSuggestion(data as unknown as SuggestionRow);

// Line 292
return (existing as unknown as RewriteRow[]).map(rowToRewrite);

// Line 348
rewrites.push(rowToRewrite(inserted as unknown as RewriteRow));

// Line 367
return (data as unknown as RewriteRow[]).map(rowToRewrite);

// Line 405
return rowToRewrite(data as unknown as RewriteRow);
```

Same pattern in `packages/web/lib/scoring/service.ts` (lines 181, 200, 212), `packages/web/lib/revisions/service.ts` (lines 84, 133, 143, 162, 174, 190, 337), and `packages/web/lib/queue/service.ts` (lines 267, 299).

**Root cause:** The `SuggestionRow`, `RewriteRow`, `StoryScoreRow`, and `RevisionRow` types are hand-written interfaces that do not align with the Prisma-generated types. The row converter functions expect these manual types.

**Recommendation:** Either (a) derive Row types from Prisma's generated types using `Prisma.SuggestionGetPayload<{}>`, or (b) write the converter functions to accept the Prisma type directly. This eliminates 16 unsafe casts and ensures schema changes propagate to domain types at compile time.

**Story Points:** 5

---

### CQ-002 | HIGH | `as unknown as` casts in Stripe webhook for SDK type gaps

**File:** `packages/web/app/api/stripe/webhook/route.ts`
**Lines:** 99, 183, 237

```typescript
// Line 99
const sub = subscription as unknown as { current_period_start?: number; current_period_end?: number };

// Line 183
const invoiceData = invoice as unknown as {
  subscription?: string | { id: string };
  period_start?: number;
  period_end?: number;
};

// Line 237
const invoiceData = invoice as unknown as {
  subscription?: string | { id: string };
};
```

The Stripe SDK types are being bypassed to access fields that exist at runtime but are not in the type definitions. The duplicate `invoiceData` cast on lines 183 and 237 creates an identical anonymous type in two places.

**Recommendation:** Create a shared `StripeInvoiceExtended` type and use Stripe's `Stripe.Invoice & StripeInvoiceExtended` intersection. Or update the Stripe SDK version where these fields are properly typed.

**Story Points:** 2

---

### CQ-003 | HIGH | `as any` casts in orchestrator

**File:** `packages/orchestrator/src/lib/logger.ts`
**Lines:** 48, 55, 82

```typescript
// Line 48
let _httpLogger: any = null;

// Line 55
const pinoHttp = (pinoHttpModule as any).default ?? pinoHttpModule;

// Line 82
export const httpLogger = (req: any, res: any, next: () => void) => {
```

**File:** `packages/orchestrator/src/orchestrator/workers/whisper-align.ts`
**Line:** 178

```typescript
body: form as any,
```

The logger file has 3 `eslint-disable-next-line @typescript-eslint/no-explicit-any` suppressions. The httpLogger middleware parameters should use Express's `Request`/`Response` types or `IncomingMessage`/`ServerResponse`.

**Recommendation:** Type `_httpLogger` as the `pino-http` middleware type. Use `express.Request`/`express.Response` for the httpLogger export. For whisper-align, use `RequestInit['body']` with proper FormData typing.

**Story Points:** 2

---

### CQ-004 | HIGH | `as unknown as` for LLM SDK return types

**File:** `packages/orchestrator/src/lib/llm-client.ts`
**Lines:** 76, 80, 185

```typescript
// Line 76
return anthropic(modelName) as unknown as LanguageModelV1;

// Line 80
return google(modelName) as unknown as LanguageModelV1;

// Line 185
abortSignal: undefined as unknown as AbortSignal,
```

AI SDK provider functions return types that should already satisfy `LanguageModelV1`. The `undefined as unknown as AbortSignal` is a null-safety escape hatch that could mask runtime errors if the tool execution framework changes.

**Recommendation:** Check if `@ai-sdk/anthropic` and `@ai-sdk/google` have been updated to export compatible types. If not, file an issue. For the AbortSignal, pass `AbortSignal.timeout(300000)` or use an actual controller signal.

**Story Points:** 2

---

### CQ-005 | MEDIUM | Untyped `any` in component props

**File:** `packages/web/app/projects/[id]/project-workflow.tsx`, line 101
**File:** `packages/web/app/projects/[id]/improvement-wizard-button.tsx`, line 19

```typescript
// project-workflow.tsx:101
directorJson?: any;

// improvement-wizard-button.tsx:19
existingScore?: any;
```

These component props accept any shape without validation. `directorJson` represents the core Director pipeline output and should have a well-defined type. `existingScore` should use the `StoryScore` type from `@/lib/scoring/types`.

**Recommendation:** Import and use `DirectorJSON` and `StoryScore` types for these props.

**Story Points:** 1

---

### CQ-006 | MEDIUM | Untyped ElevenLabs API response

**File:** `packages/orchestrator/src/director/tools/hybrid-voice-search.ts`, line 270

```typescript
return voices.map((v: any) => ({
  voice_id: v.voice_id,
  name: v.name,
  gender: v.labels?.gender || 'Male',
  label: v.labels?.age || v.labels?.use_case || 'General',
  style: v.labels?.accent || 'American',
  tone: v.labels?.descriptive ? Object.values(v.labels.descriptive) : [],
  description: v.description,
  preview_url: v.preview_url,
}));
```

The ElevenLabs voice list response is untyped. This is a third-party API boundary -- a runtime validation layer (Zod) would catch API changes.

**Recommendation:** Define an `ElevenLabsVoiceResponse` interface and validate with `z.array(elevenLabsVoiceSchema).parse()`.

**Story Points:** 2

---

### CQ-007 | MEDIUM | `project` cast to `Record<string, unknown>` in middleware

**File:** `packages/web/lib/api/middleware.ts`, line 162

```typescript
return handler(request, { userId, prisma, params, projectId, project: project as unknown as Record<string, unknown> });
```

The Prisma `project` query returns a fully typed object, but it is cast to an opaque record when passed to route handlers. Every handler that needs project fields must then access them with string keys and no type safety.

**Recommendation:** Define `ProjectAuthContext.project` as the Prisma `Project` type (from `@prisma/client`) instead of `Record<string, unknown>`.

**Story Points:** 2

---

## 2. Error Handling Consistency

### CQ-008 | HIGH | Five different catch-block patterns across API routes

**Scope:** `packages/web/app/api/` -- 112+ catch blocks

The codebase uses at least 5 different error handling patterns in API routes:

| Pattern | Count | Example |
|---------|-------|---------|
| `catch (error)` + `log.error(...)` + generic 500 | 68 | Most newer routes |
| `catch {` (no error capture) + return generic error | 36 | `projects/route.ts` |
| `catch (error)` + `error instanceof Error ? error.message : 'Unknown error'` | 21 | `teams/`, `alerts/`, `suggestions/` |
| `catch (error)` + `error instanceof Error ? error.message : String(error)` | 2 | `feedback/route.ts` |
| `catch (err)` + varying patterns | 8 | `health/route.ts` |

Newer routes (teams, alerts, suggestions standalone) use a consistent pattern with structured error codes:
```typescript
} catch (error) {
  return NextResponse.json({
    error: 'Human message',
    code: 'ERROR_CODE',
    details: error instanceof Error ? error.message : 'Unknown error',
  }, { status: 500 });
}
```

But older routes (projects, audio-overrides, voice-assignments) silently swallow errors:
```typescript
} catch {
  return NextResponse.json({ error: 'Failed to save audio overrides' }, { status: 500 });
}
```

**Recommendation:** Standardize on Pattern 3 with structured codes. Better yet, create an `apiError()` helper in middleware.ts that formats errors consistently and logs them. This is a refactor that touches many files but eliminates the inconsistency.

**Story Points:** 5

---

### CQ-009 | MEDIUM | `console.*` used alongside structured logger

**Scope:** 70 `console.*` calls across production code

**Files with structured `log` import but also using `console.*`:**
- `packages/web/lib/adviser/service.ts` -- lines 165, 350: `console.error('Failed to insert suggestion:', err);`
- `packages/web/lib/comparable/service.ts` -- lines 200, 266: `console.error('[Comparable] Insert error:', err);`
- `packages/web/lib/revisions/service.ts` -- line 138: `console.error('Failed to auto-score revision:', err);`

**Files using `console.*` where structured logger should be used:**
- `packages/web/lib/email/resend.ts` -- 10 calls (lines 74, 78, 81, 129, 133, 136, 180, 184, 187, 227, 233)
- `packages/web/lib/csrf.ts` -- line 63: `console.warn(...)` for security events
- `packages/web/app/projects/[id]/voice-chooser.tsx` -- lines 364, 379, 486

**Recommendation:** Replace all `console.*` in server-side code with the structured `log` import from `@/lib/logger`. For client components, create a minimal client-side logger wrapper.

**Story Points:** 3

---

## 3. Code Duplication

### CQ-010 | HIGH | Three independent OpenAI client initializations

**Files:**
- `packages/web/lib/adviser/service.ts`, line 32: `const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });`
- `packages/web/lib/scoring/service.ts`, lines 25-31: Lazy `getOpenAI()` with `let _openai: OpenAI | null = null;`
- `packages/web/lib/comparable/embeddings.ts`, lines 20-31: Lazy `getOpenAI()` with `let openaiClient: OpenAI | null = null;`

Three files independently create OpenAI clients. The adviser service eagerly initializes (crashes if API key is missing at import time), while scoring and embeddings use lazy initialization (different variable names: `_openai` vs `openaiClient`).

**Recommendation:** Create `packages/web/lib/openai.ts` with a single lazy-initialized client singleton, similar to the existing `packages/web/lib/db.ts` pattern for Prisma.

**Story Points:** 2

---

### CQ-011 | HIGH | Duplicate LLM call + JSON parse + validate pattern

**Files:**
- `packages/web/lib/adviser/service.ts`, lines 85-107 (suggestion generation)
- `packages/web/lib/adviser/service.ts`, lines 309-331 (rewrite generation)
- `packages/web/lib/scoring/service.ts`, lines 57-86

All three follow the identical pattern:
```typescript
const response = await openai.chat.completions.create({ model, messages, temperature, max_tokens, response_format: { type: 'json_object' } });
const content = response.choices[0]?.message?.content;
if (!content) throw new Error('No response from LLM');
let parsed: unknown;
try { parsed = JSON.parse(content); } catch { throw new Error('Failed to parse LLM response as JSON'); }
if (!validateXxxResponse(parsed)) throw new Error('LLM response does not match expected schema');
```

**Recommendation:** Extract a `callOpenAIJson<T>(options: { model, prompt, temperature, maxTokens, validator: (data: unknown) => data is T }): Promise<T>` utility. Reduces 20+ lines to 1 call in each service.

**Story Points:** 3

---

### CQ-012 | HIGH | 30+ routes manually parse JSON instead of using `parseBody`

**Scope:** `packages/web/app/api/`

The middleware file `packages/web/lib/api/middleware.ts` (lines 172-203) exports a `parseBody` helper that handles JSON parsing + Zod validation + error formatting. But only 1 route actually uses it (`regenerate-scene`). At least 30 routes manually call `await request.json()` with their own try/catch and validation logic.

Example of manual pattern repeated across routes (`packages/web/app/api/projects/[id]/feedback/route.ts`, lines 49-69):
```typescript
let body: unknown;
try {
  body = await request.json();
} catch {
  return NextResponse.json(
    { error: 'Invalid JSON body', code: 'PARSE_ERROR' },
    { status: 400 }
  );
}
const parseResult = SubmitFeedbackSchema.safeParse(body);
if (!parseResult.success) {
  return NextResponse.json(
    { error: 'Invalid request', code: 'VALIDATION_ERROR', details: parseResult.error.flatten().fieldErrors },
    { status: 400 }
  );
}
```

This is exactly what `parseBody` does. Every route reinvents the same 15-20 lines.

**Recommendation:** Migrate all routes to use `parseBody`. This also standardizes the error code (`PARSE_ERROR` vs `INVALID_JSON`) and response format.

**Story Points:** 5

---

### CQ-013 | MEDIUM | Duplicate email send pattern in resend.ts

**File:** `packages/web/lib/email/resend.ts`

The three email functions (`sendTeamInviteEmail`, `sendScriptStatusChangeEmail`, `sendScriptSharedEmail`) follow an identical structure:
1. Destructure params
2. Build URL
3. Render email template
4. Call `getResendClient().emails.send()`
5. Handle error/success with identical `console.error`/`console.log` blocks

Lines 56-86, 104-141, 160-192 are structurally identical with only the template and subject line differing.

**Recommendation:** Extract a `sendEmail<T>(template: (props: T) => ReactElement, props: T, subject: string, to: string): Promise<EmailResult>` wrapper.

**Story Points:** 2

---

### CQ-014 | MEDIUM | Duplicate Prisma singleton boilerplate

**Files:**
- `packages/web/lib/db.ts` (lines 1-30)
- `packages/orchestrator/src/lib/prisma.ts` (lines 1-24)

Both files use the same `globalThis as unknown as { prisma: PrismaClient }` singleton pattern. The web version includes connection limit logic; the orchestrator does not. Both share the same hot-reload guard.

**Recommendation:** This is acceptable for a monorepo with separate packages, but the connection limit logic should be shared or documented. Low priority.

**Story Points:** 1

---

## 4. Naming Conventions

### CQ-015 | MEDIUM | Mixed snake_case and camelCase in type definitions

**File:** `packages/web/lib/types/marketplace.ts`

The marketplace types use snake_case consistently (`created_at`, `user_id`, `project_id`) matching database column names, while all other type files (scoring, adviser, revisions, queue) use camelCase Row types that are manually mapped. This creates two conventions in the same codebase.

Examples from `packages/web/lib/types/marketplace.ts`:
```typescript
created_at: string;   // line 21
updated_at: string;   // line 22
user_id: string;      // line 34
project_id: string;   // line 80
```

Versus `packages/web/lib/adviser/types.ts` which uses `SuggestionRow` with fields like `project_id`, `score_id` etc., then manually converts to camelCase domain types.

**Recommendation:** Standardize on Prisma-generated types (camelCase) for application code. Keep snake_case only in raw SQL query results where unavoidable.

**Story Points:** 2

---

### CQ-016 | LOW | Inconsistent error variable naming in catch blocks

**Scope:** `packages/web/app/api/`

Catch blocks use three different variable names:
- `catch (error)` -- 68 occurrences
- `catch (err)` -- 8 occurrences (health route, adviser service)
- `catch {` -- 36 occurrences (no variable)

While this does not cause bugs, it complicates searching and automated refactoring.

**Recommendation:** Standardize on `catch (error)` across all routes during the CQ-008 error handling refactor.

**Story Points:** 0 (included in CQ-008)

---

## 5. Dead Code and Smells

### CQ-017 | MEDIUM | Feedback route works around missing database table

**File:** `packages/web/app/api/projects/[id]/feedback/route.ts`

Lines 86-101 and 135-142 contain runtime detection for a missing database table:
```typescript
const errorMessage = error instanceof Error ? error.message : String(error);
if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
  console.log('[Feedback] Table does not exist, feedback logged:', { ... });
  return NextResponse.json({ success: true, logged: true, message: 'Feedback logged (table pending migration)' });
}
```

This is a runtime workaround for a schema migration that has not been applied. It means feedback data is silently lost in production. The route header comment (line 8) confirms: "No Prisma model for feedback yet."

**Recommendation:** Either apply the migration to create the feedback table, or remove the route until the migration is ready. Silent data loss is worse than an error.

**Story Points:** 2

---

### CQ-018 | LOW | `eslint-disable` suppression comments

**Scope:** 6 `eslint-disable` comments in production code

```
packages/web/app/api/generate-demo-script/route.ts:25    // eslint-disable-next-line no-control-regex
packages/web/components/comparable/ComparableSection.tsx:99  // eslint-disable-next-line react-hooks/exhaustive-deps
packages/orchestrator/src/lib/logger.ts:47               // eslint-disable-next-line @typescript-eslint/no-explicit-any
packages/orchestrator/src/lib/logger.ts:54               // eslint-disable-next-line @typescript-eslint/no-explicit-any
packages/orchestrator/src/lib/logger.ts:81               // eslint-disable-next-line @typescript-eslint/no-explicit-any
packages/orchestrator/src/orchestrator/workers/whisper-align.ts:177  // eslint-disable-next-line @typescript-eslint/no-explicit-any
```

The 3 suppressions in `logger.ts` and 1 in `whisper-align.ts` are covered by CQ-003. The `react-hooks/exhaustive-deps` suppression in `ComparableSection.tsx` should be reviewed for correctness.

**Recommendation:** Resolve the underlying type issues (CQ-003) and re-enable the rules. Review the deps suppression.

**Story Points:** 0 (included in CQ-003)

---

## Summary Table

| ID | Severity | SP | Category | Description |
|----|----------|-----|----------|-------------|
| CQ-001 | CRITICAL | 5 | Type Safety | 16 `as unknown as Row` casts in service layer |
| CQ-002 | HIGH | 2 | Type Safety | Stripe webhook `as unknown as` for SDK type gaps |
| CQ-003 | HIGH | 2 | Type Safety | `as any` and `: any` in orchestrator logger + whisper |
| CQ-004 | HIGH | 2 | Type Safety | `as unknown as LanguageModelV1` in LLM client |
| CQ-005 | MEDIUM | 1 | Type Safety | Untyped `any` in component props |
| CQ-006 | MEDIUM | 2 | Type Safety | Untyped ElevenLabs API response |
| CQ-007 | MEDIUM | 2 | Type Safety | Project cast to `Record<string, unknown>` in middleware |
| CQ-008 | HIGH | 5 | Error Handling | 5 different catch-block patterns across 112+ blocks |
| CQ-009 | MEDIUM | 3 | Error Handling | 70 console.* calls alongside structured logger |
| CQ-010 | HIGH | 2 | Duplication | 3 independent OpenAI client initializations |
| CQ-011 | HIGH | 3 | Duplication | Duplicate LLM call + parse + validate pattern |
| CQ-012 | HIGH | 5 | Duplication | 30+ routes bypass parseBody helper |
| CQ-013 | MEDIUM | 2 | Duplication | 3 structurally identical email send functions |
| CQ-014 | MEDIUM | 1 | Duplication | Duplicate Prisma singleton boilerplate |
| CQ-015 | MEDIUM | 2 | Naming | Mixed snake_case/camelCase in type definitions |
| CQ-016 | LOW | 0 | Naming | Inconsistent error variable naming in catch blocks |
| CQ-017 | MEDIUM | 2 | Dead Code | Feedback route silently drops data on missing table |
| CQ-018 | LOW | 0 | Dead Code | 6 eslint-disable suppressions |

**Total: 38 SP across 18 findings (1 CRITICAL, 7 HIGH, 8 MEDIUM, 2 LOW)**
