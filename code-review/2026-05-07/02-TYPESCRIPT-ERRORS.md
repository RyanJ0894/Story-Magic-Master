# TypeScript Error Report — 2026-05-07

## Before / After

| Package | Before | After | Fixed | Deferred |
|---------|--------|-------|-------|---------|
| web | 0 | 0 | 0 | 0 |
| orchestrator | 0 | 0 | 0 | 0 |

TypeScript baseline was already 0 errors in both packages at session start.

---

## `any` Cast Inventory

| File | Line | Pattern | Status |
|------|------|---------|--------|
| `generate/route.ts` | 112 | `(project as any).directorJson?.scenes` | **FIXED** → `(project.directorJson as { scenes?: unknown[] } \| null)?.scenes` |
| `project-workflow.tsx` | 104 | `directorJson?: any` | INTENTIONAL — eslint-disable with justification (Prisma JsonValue; downstream components narrow shape) |
| `lib/ai/providers.ts` | 63 | `resolveModel(): any` | INTENTIONAL — eslint-disable with justification (Vercel AI SDK v3/v4 mismatch) |
| `processor.ts` | 134 | `existingProject?.directorJson as any` | INTENTIONAL — eslint-disable comment; complex director JSON shape |
| `processor.ts` | 138 | `let directorJson: any` | INTENTIONAL — eslint-disable comment; assigned from director pipeline (untyped result) |

**Net reduction:** 1 `any` cast eliminated. 4 intentional casts with eslint-disable remain — all documented.

---

## Verification

```
pnpm --filter @story-magic/web exec tsc --noEmit    → no output (0 errors)
pnpm --filter @story-magic/orchestrator exec tsc --noEmit → no output (0 errors)
```
