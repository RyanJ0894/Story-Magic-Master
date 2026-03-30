# Sprint Plan — 2026-03-29

## Completed This Session (v3 Remediation)

- [x] Fixed 1 TypeScript error (orchestrator: `prisma generate`)
- [x] Restored 83 failing orchestrator tests (DATABASE_URL in vitest env)
- [x] Removed 1 `console.log` → `log.info` (sentry.ts)
- [x] Removed 4 `any` casts (ingest-training-scripts.ts)
- [x] Built complete StoryScore calibration pipeline (schema, ingestion, scoring, admin UI)
- [x] Upgraded scoring LLM: OpenAI → Claude Sonnet 4.6 via Vercel AI SDK
- [x] Added multi-provider AI factory (Claude + Gemini)
- [x] Added few-shot calibration (buildCalibrationExamples)

---

## Sprint 1 — Deploy and Activate (1–2 days)

**Goal:** Get calibration corpus live and scoring pipeline running.

| # | Task | SP | Owner |
|---|------|----|-------|
| S1-1 | Apply Prisma migration: `cd packages/web && npx prisma migrate deploy` | 1 | Chris |
| S1-2 | Add `ANTHROPIC_API_KEY` + `GOOGLE_GENERATIVE_AI_API_KEY` to Render web service | 1 | Chris |
| S1-3 | Run `pnpm --filter @story-magic/web ingest:training` | 1 | Chris |
| S1-4 | Run `pnpm --filter @story-magic/web score:corpus` | 1 | Chris |
| S1-5 | Verify calibration health at `/admin/corpus` (target: spread ≥ 2.5) | 1 | Chris |
| S1-6 | Ryan: add `storymagicapp.net` to Vercel project, update GoDaddy DNS | 2 | Ryan |
| S1-7 | Ryan: add `app.storymagicapp.net` custom domain to Render (story-magic-web) | 1 | Ryan |
| S1-8 | Ryan: click Formsubmit activation email in `talent@storymagicapp.net` | 1 | Ryan |

**Total: 9 SP**

---

## Sprint 2 — Post-Launch Intelligence (1–2 weeks)

| # | Task | SP | Notes |
|---|------|----|-------|
| S2-1 | Story Adviser frontend UI | 5 | Backend prompt exists; needs route + components |
| S2-2 | Integration tests for ingest + score scripts | 5 | Vitest + mock DB |
| S2-3 | Component tests for `/admin/corpus` | 3 | Playwright or Vitest component |
| S2-4 | Score re-calibration workflow | 3 | UI to mark anchors, trigger re-score |
| S2-5 | Export calibration report (CSV) | 2 | Admin action from corpus page |

**Total: 18 SP**

---

## Backlog (No Sprint Yet)

- Long script chunking (>120 pages) — architectural decision needed
- Multi-tenancy / data isolation — enterprise phase
- SOC 2 Type II audit prep
- Story Adviser v2 (interactive feedback loop)
