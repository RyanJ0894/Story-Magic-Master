# TypeScript Error Report — 2026-03-29

## Before / After

| App | Before | After | Fixed | Deferred |
|-----|--------|-------|-------|---------|
| Web | 0 | 0 | 0 | 0 |
| Orchestrator | 1 | 0 | 1 | 0 |

## Fixed This Session

| File | Error | Fix Applied |
|------|-------|------------|
| `packages/orchestrator/src/lib/prisma.ts` | `PrismaClient` not exported (Prisma client not generated) | Ran `npx prisma generate` in orchestrator package |

## Notes

- Web package was already at 0 errors — `prisma generate` had been run this session after adding `CorpusScore` model and new `ScriptCorpus` fields
- Orchestrator had 1 error from missing generated client — resolved by `prisma generate`
- The `resolveModel()` function in `lib/ai/providers.ts` intentionally uses `any` return type due to `LanguageModelV1` vs `LanguageModelV3` version mismatch between `ai@4` and `@ai-sdk/anthropic@3`. This is documented with an `eslint-disable` comment and is not a fixable type error — it requires upstream SDK alignment.

## Deferred

None.
