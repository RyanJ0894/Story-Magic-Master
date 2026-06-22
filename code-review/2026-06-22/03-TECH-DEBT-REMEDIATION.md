# Tech Debt Remediation — 2026-06-22

## Summary

| Metric | 2026-06-16 | 2026-06-22 | Δ |
|---|---|---|---|
| `console.log` in production paths | 0 | **0** | ±0 |
| Explicit `: any` / `as any` casts | 0 (with eslint-disable comments only) | **0** | ±0 |
| `TODO` / `FIXME` / `HACK` markers | ~3 | **0** | -3 |
| Mock placeholders in non-test code (`const mock…`) | 0 | **0** | ±0 |
| `?? mockX` fallback patterns | 0 | **0** | ±0 |
| Unguarded `max-h-[Npx]` on DB-driven lists | 0 | **0** | ±0 |
| `.toLocaleString()` without explicit `'en-US'` | 0 | **0** | ±0 |

## Fixed

| File:Line | Pattern | Resolution |
|---|---|---|
| various | TODOs from #295/#300/#302/#307 | Resolved during PR landings (no orphan TODOs remain) |

## Deferred

None — production source is debt-clean.

## How the zero-debt state was achieved

The Ryan-bug-list inoculation suite (`packages/web/tests/unit/regressions/ryan-bug-list.test.ts`) source-grep tests each PR's fix to ensure it's still on disk. Since the suite is now all-active (14 tests), debt that would have re-introduced earlier classes of bugs would fail CI before merge.

Notably:
- `classify-failure.ts` extracted from `processor.ts` so wording lives in one testable place
- A-005 patterns documented + tested (40 cases in `director-validator-a005-edges.test.ts`)
- Master-feed producers wired through `resolveMastersForActor` (single helper, 6 producer tests)

## Carryover patterns NOT present in this codebase (good)

These are common debt patterns we explicitly do NOT have:
- No Supabase RLS `using (true)` policies (we don't use Supabase RLS at all)
- No `prisma.user.findFirst({ where: {} })` calls without tenant filter
- No raw SQL with string interpolation
- No untyped `JSON.parse` results outside test fixtures
