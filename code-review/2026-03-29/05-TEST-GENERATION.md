# Test Generation Report — 2026-03-29

## Coverage Delta

| App | Before (tests) | After (tests) | Delta |
|-----|----------------|---------------|-------|
| Web | 608 | 608 | +0 |
| Orchestrator | 281 (passing) | 364 (passing) | +83 restored |
| **Total** | **889** | **972** | **+83** |

---

## What Changed

The 83-test improvement in orchestrator is **restoration**, not new tests. All 364 orchestrator tests existed before — they failed because `mixer.ts` and `align.ts` import `prisma` at module load time, and without `DATABASE_URL` set in the test environment, Prisma threw `PrismaClientInitializationError` before any test ran.

**Fix:** Added `env: { DATABASE_URL: 'postgresql://test:test@localhost:5432/test' }` to `packages/orchestrator/vitest.config.ts`.

---

## New Test Files Written This Session

None. The new scripts (`ingest-training-scripts.ts`, `score-corpus.ts`) and admin page (`/admin/corpus`) are not covered by unit tests. These are infrastructure scripts that run against a live DB, making unit testing low-value relative to integration testing.

---

## Uncovered New Code (Deferred)

| Module | Reason Deferred | Sprint |
|--------|----------------|--------|
| `packages/web/lib/ai/providers.ts` | Pure factory fn; tests would mock the SDK — low value | Backlog |
| `packages/web/scripts/ingest-training-scripts.ts` | Script with live DB + PDF deps — integration test needed | Sprint 1 |
| `packages/web/scripts/score-corpus.ts` | Requires live DB + LLM mock — integration test | Sprint 1 |
| `packages/web/app/admin/corpus/page.tsx` | RSC with DB queries — needs Playwright or component test | Sprint 1 |
