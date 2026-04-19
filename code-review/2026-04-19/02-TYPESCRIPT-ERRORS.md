# TypeScript Error Report — 2026-04-19

## Before / After

| Package | Before | After | Fixed | Deferred |
|---------|--------|-------|-------|---------|
| web | 0 | 0 | 0 | 0 |
| orchestrator | 0 | 0 | 0 | 0 |

Both packages have `"strict": true` and pass `tsc --noEmit` with zero errors.

## Tech Debt: Remaining `any` Casts (7 suppressed, all justified)

| File | Cast | Justification |
|------|------|--------------|
| `web/lib/ai/providers.ts:63` | `resolveModel(): any` | ai@4 vs @ai-sdk/anthropic@3 LanguageModel version mismatch |
| `web/lib/generation/processor.ts:123,127` | `directorJson: any` | Prisma JsonValue pass-through for complex JSON; deeply nested mutations resist typed alternatives |
| `web/app/projects/[id]/project-workflow.tsx:102` | `directorJson?: any` | Prisma JsonValue; VoiceChooser + AudioChooser each narrow the shape themselves |
| `web/app/projects/[id]/improvement-wizard-button.tsx:19` | `existingScore?: any` | Partial score shape `{id,overallScore}` doesn't satisfy full `StoryScore`; wizard casts internally |
| `orchestrator/src/lib/logger.ts:48,55,82` | 3× `any` | pino-http ESM/CJS dynamic import interop |
| `orchestrator/src/orchestrator/workers/whisper-align.ts:178` | `form as any` | FormData ↔ fetch `body` type incompatibility (node-fetch vs browser types) |

All remaining `any` casts now have `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <reason>` comments.

## Fixed This Session

| File | Error | Fix |
|------|-------|-----|
| `orchestrator/src/director/tools/hybrid-voice-search.ts:270` | `(v: any)` — untyped ElevenLabs API response | Added `ElevenLabsVoice` interface; fixed gender default from `string` to `'Male' \| 'Female'` |
