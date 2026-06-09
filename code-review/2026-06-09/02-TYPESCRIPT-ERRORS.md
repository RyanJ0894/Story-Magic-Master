# TypeScript Error Report — 2026-06-09

## Before / After

| Package | Before (2026-06-03) | After (2026-06-09) | Δ |
|---------|---------------------|--------------------|----|
| `@story-magic/orchestrator` | 0 | 0 | → |
| `@story-magic/web` | 0 | 0 | → |
| **Total** | **0** | **0** | **→** |

Both packages still clean. Maintained through 14 cost-opt PRs touching `llm-client.ts`, `pipeline.ts`, `script-score-service.ts`, `routes/orchestrate.ts`, `routes/analyze.ts`, and the web Adviser migration.

## Notable type discipline this cycle

- PR #178 had to strip `.min()/.max()` from Zod schemas passed to `generateObject` (Anthropic compat). The shape changes were Anthropic-safe AND TypeScript stayed clean.
- PR #185 added `AllDimensionsScoreSchema` (union of 4 existing schemas) without introducing any.
- PR #196 added Prisma `LlmCallLog` model + cost helper — strongly typed, no any.
- PR #197 added the Zod schema walker — reads `_def` defensively but exposes a clean `ForbiddenConstraint[]` interface.

## Deferred (carryover from prior reviews)

The following are `any`/loose-typed but justified:

| File:Line | Pattern | Why |
|-----------|---------|-----|
| `packages/orchestrator/src/lib/logger.ts:48,55,84` | `any` on express middleware | Express `Request`/`Response` typed downstream by `pino-http`; the wrappers are deliberately untyped to avoid version-mismatch noise |
| `packages/orchestrator/src/orchestrator/workers/whisper-align.ts:214` | `body: form as any` | `form-data` library typing quirk; fetch expects different type than form.getBuffer() can produce |
| `packages/web/lib/ai/providers.ts:63` | `resolveModel(): any` | LanguageModelV1 vs V3 SDK mismatch; already has `eslint-disable-next-line` with explanation |
| `packages/web/lib/generation/processor.ts:163,167` | `directorJson: any` | Should be `DirectorJSON` from shared types. **P2 cleanup** — would be a small follow-up PR. |
| `packages/web/app/projects/[id]/project-workflow.tsx:107` | `directorJson?: any` | Same — should be shared type. P2. |
| `packages/web/app/projects/[id]/improvement-wizard-button.tsx:19` | `existingScore?: any` | Should be `ScriptAnalysisReport`. P2. |

**Recommendation:** small PR to tighten the 3 `directorJson: any` / `existingScore: any` declarations using the shared types from `@story-magic/orchestrator` (or `packages/shared`). Estimated 1 SP.
