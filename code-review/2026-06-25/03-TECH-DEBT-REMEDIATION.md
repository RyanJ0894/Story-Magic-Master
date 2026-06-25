# Tech Debt Remediation — 2026-06-25

## Summary

| Metric | Count | Action |
|--------|-------|--------|
| `console.log` in production paths | 0 actionable | All 24 hits are intentional (logger.ts impl, csrf.ts security log, env.ts boot banner, BuildStamp) |
| `as any` / `: any` casts | 5 actionable / 12 total | All five are SDK-interop boundaries — left as-is |
| `TODO/FIXME` | 1 actionable | T-01 placeholder voice ID, BLOCKED on Ryan |
| Mock data in production | 0 | grep `const mock[A-Z]` returned no hits |
| `?? mock` / `\|\| mock` fallbacks | 0 | clean |
| `max-h-[Npx]` on dynamic DB lists | 2 marginal | `enterprise/dashboard/page.tsx:309,355` `max-h-[480px]` — P2 if list grows past ~15 items |
| `toLocaleString()` without locale | 0 actionable | only hit is `date-time.tsx:50` which is intentional client-side localized timestamp display |

## Fixed this session

| File:Line | Pattern | Resolution |
|-----------|---------|------------|
| `run-selector.tsx:105,184` | `toLocaleString(undefined, ...)` | → explicit `'en-US'` locale (UX-D-01) |

## Deferred — context-specific

| File:Line | Pattern | Why kept | Sprint |
|-----------|---------|----------|--------|
| `logger.ts:60,67,109` | `let _httpLogger: any \| pinoHttpModule as any \| (req: any, res: any)` | pino-http CJS/ESM interop + Express handler signature | never |
| `rate-limit.ts:144,146,167` | `normal: any; strict: any; IORedis: any` | ioredis dynamic import + rate-limit factory return | never |
| `audio.ts:244` | `const asObj = h as any` | unknown ElevenLabs WS message shape | next reachable cleanup |
| `providers.ts:63` | `resolveModel(modelId: string): any` | AI-SDK provider union return is too unwieldy as a type | next reachable cleanup |
| `enterprise/dashboard/page.tsx:309,355` | `max-h-[480px] overflow-y-auto` | works fine at typical N≤10 entries; mark P2 polish if real-world data exceeds | post-GTM |
| `hybrid-voice-search.ts:38` | `TODO(PLACEHOLDER): replace voice_id with Ryan's actual female teen voice` | BLOCKED on Ryan picking from catalog | when Ryan provides IDs |
