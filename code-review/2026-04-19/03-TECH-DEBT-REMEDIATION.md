# Tech Debt Remediation — 2026-04-19

## Summary

- console.log removed: 0 (all existing ones are intentional)
- TODOs resolved: 0 (only 2 TODOs exist, both in generated Prisma files)
- `any` casts replaced: 1 (hybrid-voice-search.ts `(v: any)` → `ElevenLabsVoice` interface)
- `any` casts suppressed with justification comments: 3
- Empty catches hardened: 0 (only 1 intentional silent catch in `s/[code]/page.tsx`)
- Deferred: 6 `any` casts

## Fixed

| File:Line | Pattern | Resolution |
|-----------|---------|------------|
| `orchestrator/src/director/tools/hybrid-voice-search.ts:270` | `(v: any)` | Added `ElevenLabsVoice` interface; fixed real bug where `gender` defaulted to `string` instead of `'Male' \| 'Female'` |

## Suppressed with Justification (not fixable without large refactor)

| File:Line | Pattern | Reason |
|-----------|---------|--------|
| `web/lib/ai/providers.ts:63` | `resolveModel(): any` | ai@4 / @ai-sdk/anthropic@3 LanguageModel interface mismatch; will resolve when SDK versions align |
| `web/lib/generation/processor.ts:123,127` | `directorJson: any` | Complex nested JSON mutations; typing to `DirectorScene[]` causes cascading cast errors in audio override loop |
| `web/app/projects/[id]/project-workflow.tsx:102` | `directorJson?: any` | Prisma JsonValue; downstream components narrow type individually |
| `web/app/projects/[id]/improvement-wizard-button.tsx:19` | `existingScore?: any` | Partial `{id,overallScore}` doesn't satisfy full `StoryScore` without threading the type through the page |
| `orchestrator/src/lib/logger.ts:48,55,82` | 3× `any` | pino-http ESM/CJS interop pattern; changing requires restructuring logger initialization |
| `orchestrator/src/orchestrator/workers/whisper-align.ts:178` | `form as any` | FormData `body` type issue between node-fetch and native fetch types |

## TODOs / Deferred

No actionable TODOs in production code. The 2 TODO comments in the codebase are in generated Prisma runtime files (`library.d.ts`) and are not modifiable.
