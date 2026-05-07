# Tech Debt Remediation — 2026-05-06

## Summary
- console.log: 0 actionable (all in startup diagnostic or logger implementation)
- `any` casts: 0 actionable (all in generated Prisma client files)
- TODOs: 0 actionable (all in generated Prisma files)
- Items fixed: 3 (webhook idempotency, schema indexes, env var docs)

## Fixed This Session

| Item | File | Fix Applied |
|------|------|-------------|
| Webhook idempotency | `webhook/route.ts:67` | `upsert` on `stripePaymentIntentId`; null-safe fallback |
| Missing unique constraint | `web/prisma/schema.prisma:269` | `@unique` on `stripePaymentIntentId` + migration 0011 |
| Missing composite index | Both schemas | `@@index([projectId, purchaseType, status])` |
| Undocumented env vars | `.env.example` | Added `ELEVENLABS_MODEL`, `DIRECTOR_MODEL_ADVANCED` |

## Console.log Audit

| Location | Pattern | Verdict |
|----------|---------|---------|
| `env.ts:164-174` | `printEnvSummary()` | Acceptable — startup diagnostic only, not request path |
| `logger.ts:40-41` | Logger implementation | Acceptable — this is the logger |
| `csrf.ts:64-65` | Security event | Acceptable — security events should be logged |

## Deferred

None.
