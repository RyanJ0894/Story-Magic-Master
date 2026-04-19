# Delta Review — 2026-04-19 vs 2026-03-29

## Prior Open Items

| Item | Status | Notes |
|------|--------|-------|
| Apply Prisma migration 0003 to prod | CARRYOVER | Ryan / Chris action |
| Add ANTHROPIC_API_KEY to Render | CARRYOVER | Ryan action |
| Add GOOGLE_GENERATIVE_AI_API_KEY to Render | CARRYOVER | Ryan action |
| Run ingest:training + score:corpus | CARRYOVER | Requires above keys |
| Ryan DNS + Vercel domain setup | CARRYOVER | |
| Story Adviser frontend UI (Sprint 2) | CARRYOVER | Backend prompt exists |

## New Work Since 2026-03-29

All commits between the two review dates:

| Area | Change |
|------|--------|
| Exchange marketplace | New: `app/api/exchange/`, `app/api/projects/[id]/exchange/`, `app/exchange/`, `components/exchange/`, migration 0009 |
| Writer Hub | New: `app/api/writers/`, `app/writer/`, `app/writer/[writerId]/` |
| Project reviews | New: `app/api/projects/[id]/reviews/` |
| Audio fixes | CORP header on orchestrator `/audio` static route |
| Race condition | `processor.ts` — project.status updated before job.status to avoid router.refresh() window |
| Share button | Fixed 404: `/share` → `/listen` |
| Run selector | Added timestamps per run |
| Director schema | `character_age` `.nullish()` fix |
| Rate limiting | Job polling endpoint changed to `loose` tier |
| Revision timeline | Graceful fallback when stored procedure absent |
| ElevenLabs mock | `ELEVENLABS_MOCK=true` env var for $0 TTS during dev |
| Audio player | Fixed empty-array truthy bug + isCompleted defensive check |

## New Issues Identified This Session

1. **No tests on Impact StoryBuilder** (5 API routes, email, R2, cron) — HIGH
2. **ElevenLabs gender field typed as `string` not `'Male' | 'Female'`** — FIXED
3. **Exchange + Writer Hub routes shipped without tests** — FIXED
