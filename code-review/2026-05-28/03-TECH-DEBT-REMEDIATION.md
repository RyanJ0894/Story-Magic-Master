# Tech Debt Remediation — 2026-05-28

## Summary
- console.log removed: **5** (generate-button.tsx ×3, invite/page.tsx ×2)
- `any` casts replaced: 0 (deferred — all are justified, see 02-TYPESCRIPT-ERRORS.md)
- TODOs resolved: 0 (remaining: PLACEHOLDER voice IDs — external/Ryan)
- Deferred: 7 `any` casts (all justified)

## Fixed This Session

| File:Line | Pattern | Resolution |
|-----------|---------|------------|
| `packages/web/app/projects/[id]/generate-button.tsx:151` | `console.log('[Audio] First segment ready', url)` | Removed — pipeline confirmed stable in prod |
| `packages/web/app/projects/[id]/generate-button.tsx:163` | `console.log('[Audio] Segments ready', count, url)` | Removed |
| `packages/web/app/projects/[id]/generate-button.tsx:174–179` | `console.log('[Audio] Job complete', {...})` | Removed |
| `packages/web/app/invite/[token]/page.tsx:93` | `console.log('[Invite] Accepting token', ...)` | Removed |
| `packages/web/app/invite/[token]/page.tsx:102` | `console.log('[Invite] Response', ...)` | Removed |

## Open TODOs (External)

| File:Line | TODO | Owner | Sprint |
|-----------|------|-------|--------|
| `packages/orchestrator/src/director/tools/hybrid-voice-search.ts:38` | Replace placeholder female-teen voice IDs | Ryan | External |

## Deferred `any` casts

See `02-TYPESCRIPT-ERRORS.md` — all 7 remaining `any` uses are justified by SDK limitations or runtime-parsed JSON. No action this sprint.
