# TypeScript Error Report — 2026-05-28

## Before / After

| Package | Before | After | Fixed | Deferred |
|---------|--------|-------|-------|---------|
| orchestrator | 0 | 0 | 0 | 0 |
| web | 0 | 0 | 0 | 0 |

Zero TypeScript errors in both packages. No action required.

## Deferred `any` casts (documented, not fixed — SP > 2)

| File:Line | Pattern | Reason |
|-----------|---------|--------|
| `packages/orchestrator/src/lib/logger.ts:48` | `let _httpLogger: any` | Dynamic require pattern for pino-http; typed properly would require overhaul |
| `packages/orchestrator/src/lib/logger.ts:55` | `(pinoHttpModule as any).default` | ESM/CJS interop for pino-http dynamic import |
| `packages/orchestrator/src/lib/logger.ts:82` | `req: any, res: any` | Express middleware — would need `Request`/`Response` import |
| `packages/orchestrator/src/orchestrator/workers/whisper-align.ts:178` | `form as any` | `undici` FormData ↔ `fetch` body type incompatibility; SDK limitation |
| `packages/web/lib/ai/providers.ts:63` | `resolveModel: any` | Vercel AI SDK `LanguageModelV1` union makes return type opaque; typed version is complex |
| `packages/web/lib/generation/processor.ts:135,139` | `directorJson as any` | Runtime-parsed LLM JSON; type is `unknown` at parse time, validated by Zod downstream |
| `packages/web/app/projects/[id]/project-workflow.tsx:106` | `directorJson?: any` | Same — passed through; typed at the Zod boundary |
