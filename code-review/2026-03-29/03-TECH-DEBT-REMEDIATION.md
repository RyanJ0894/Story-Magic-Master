# Tech Debt Remediation — 2026-03-29

## Summary

- `console.log` removed: 1
- `any` casts replaced: 4
- TODOs resolved: 0 (none found in production paths)
- Empty catches hardened: 0
- Deferred: 0 items

---

## Fixed

| File | Pattern | Resolution |
|------|---------|------------|
| `packages/orchestrator/src/lib/sentry.ts:32` | `console.log(...)` in production init path | Replaced with `log.info(...)` using existing pino logger |
| `packages/web/scripts/ingest-training-scripts.ts:251` | `null as any` for Decimal field | Removed cast — Prisma accepts `null` directly for optional Decimal |
| `packages/web/scripts/ingest-training-scripts.ts:254` | `null as any` for `conflictDensity` | Same fix |
| `packages/web/scripts/ingest-training-scripts.ts:256` | `null as any` for `emotionalArcScore` | Same fix |
| `packages/web/scripts/ingest-training-scripts.ts:268` | `(prisma.scriptCorpus as any).create(...)` | Removed cast — Prisma types now include `scriptCorpus.create` after `prisma generate` |

---

## Scan Findings (No Action Needed)

| File | Pattern | Disposition |
|------|---------|-------------|
| `packages/orchestrator/src/lib/logger.ts` | `console.log` | Logger wrapper — intentional |
| `packages/orchestrator/src/lib/csrf.ts` | `console.warn` | CSRF double-submit fallback warning — appropriate |
| `packages/web/lib/ai/providers.ts` | `: any` return on `resolveModel()` | SDK version mismatch (LanguageModelV1 vs V3) — intentional, documented |
| `packages/orchestrator/src/director/validation/director-validator.ts` | Regex pattern `TODO` token | False positive — matched keyword inside regex string literal |

---

## TODOs Converted to Issues

None. No actionable TODOs found in production source files.

---

## Deferred

None. All SP ≤ 2 items were fixed this session.
