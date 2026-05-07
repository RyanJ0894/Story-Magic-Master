# Tech Debt Remediation — 2026-05-07

## Summary

| Category | Found | Fixed | Deferred |
|----------|-------|-------|---------|
| `any` casts | 5 | 1 | 4 (all intentional with eslint-disable) |
| `console.log` in prod paths | 0 | — | — |
| TODOs / FIXMEs | 0 | — | — |

---

## Findings

### `any` casts fixed

| File | Line | Before | After |
|------|------|--------|-------|
| `app/api/generate/route.ts` | 112 | `(project as any).directorJson?.scenes` | `(project.directorJson as { scenes?: unknown[] } \| null)?.scenes` |

### `any` casts deferred (intentional)

All remaining casts have explicit `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comments with justification inline. No action needed unless the Vercel AI SDK stabilizes or a `DirectorJson` interface is formally defined.

| File | Line | Reason |
|------|------|--------|
| `project-workflow.tsx:104` | `directorJson?: any` | Prisma JsonValue; downstream narrowed per-component |
| `lib/ai/providers.ts:63` | `resolveModel(): any` | Vercel AI SDK v3/v4 version mismatch |
| `lib/generation/processor.ts:134` | `directorJson as any` | Same Prisma JsonValue constraint |
| `lib/generation/processor.ts:138` | `let directorJson: any` | Receives director pipeline result (runtime-typed JSON) |

### console.log scan

Only legitimate usages found:
- `lib/csrf.ts` — security logger (intentional debug output for CSRF violations)
- `lib/logger.ts` — the logger implementation itself
- `packages/orchestrator/src/lib/env.ts` — startup config display

Zero `console.log` calls in billing, auth, webhook, or production paths.

### TODOs

Zero `TODO`, `FIXME`, or `HACK` comments found in non-test TypeScript files.
