# TypeScript Error Report — 2026-06-14

## Before / After
| Package | Before | After | Fixed | Deferred |
|---------|--------|-------|-------|---------|
| Orchestrator | 0 | 0 | — | — |
| Web | 0 | 0 | — | — |

Both packages pass `tsc --noEmit` clean. Baseline preserved from 2026-06-09.

## Notes

- Generated Prisma client at `packages/orchestrator/src/generated/prisma/` produces ~87 `any` casts of its own — these are inside `.d.ts` runtime files and not part of app code. They DO NOT count against tech debt.
- Real app-code `any` count: ~14 — see 03-TECH-DEBT-REMEDIATION.md.

No action this session.
