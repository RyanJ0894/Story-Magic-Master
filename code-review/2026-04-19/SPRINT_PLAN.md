# Sprint Plan — 2026-04-19

## Completed This Session

- [x] Fixed ElevenLabs gender type bug in `hybrid-voice-search.ts`
- [x] Added `eslint-disable` justifications to all remaining `any` casts
- [x] Wrote 32 tests for Exchange + Writer Hub API routes (3 new test files)
- [x] Fixed CORP header on orchestrator `/audio` static route (ships in prior commit)
- [x] Fixed audio player race condition: project.status updated before job.status
- [x] Fixed Share button 404: `/share` → `/listen`

---

## Sprint 1 — Before First Paying Users (1–3 days)

| # | Task | SP | Owner | Notes |
|---|------|----|-------|-------|
| S1-1 | Write tests for `GET/POST /api/projects/[id]/reviews` | 2 | Chris | Simple auth + upsert pattern |
| S1-2 | Write tests for Impact StoryBuilder API (stories CRUD) | 5 | Chris | Mock R2 + Resend; skip Stripe |
| S1-3 | Write tests for `director-agent.ts` (mock LLM) | 4 | Chris | Happy path + JSON parse error |
| S1-4 | Write tests for `script-score-service.ts` (mock LLM) | 3 | Chris | Score validation + dimensions |
| S1-5 | Apply Prisma migration 0003 to production DB | 1 | Chris | `cd packages/web && npx prisma migrate deploy` |
| S1-6 | Add `ANTHROPIC_API_KEY` + `GOOGLE_GENERATIVE_AI_API_KEY` to Render | 1 | Ryan | |
| S1-7 | Run `pnpm --filter @story-magic/web ingest:training` + `score:corpus` | 1 | Chris | After S1-6 |
| S1-8 | Rotate Clerk keys from test → production | 1 | Ryan | Critical before real users |
| S1-9 | Verify `/admin/corpus` calibration (spread ≥ 2.5) | 1 | Chris | After S1-7 |

**Total: 19 SP**

---

## Sprint 2 — Post-Launch Polish (1–2 weeks)

| # | Task | SP | Notes |
|---|------|----|-------|
| S2-1 | Story Adviser frontend UI | 5 | Backend prompt + API route exist |
| S2-2 | Tests for `lib/comparable/service.ts` + embeddings | 4 | Vector similarity mocking |
| S2-3 | Tests for `lib/revisions/service.ts` | 3 | Stored procedure mocking |
| S2-4 | Tests for `lib/adviser/service.ts` | 3 | OpenAI mock |
| S2-5 | Score re-calibration workflow (mark anchors, trigger re-score) | 3 | Admin action |
| S2-6 | Export calibration report as CSV | 2 | Admin action |

**Total: 20 SP**

---

## Backlog (No Sprint Yet)

- Admin CRUD tests (11 routes)
- Long script chunking (>120 pages) — architectural
- Multi-tenancy / data isolation — enterprise phase
- SOC 2 Type II audit prep
- Voice marketplace (placeholder page)
- R2 storage integration tests
