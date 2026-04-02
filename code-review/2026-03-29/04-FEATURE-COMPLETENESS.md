# Feature Completeness — 2026-03-29

## Completed This Session

| Feature | What Was Missing | What Was Added |
|---------|-----------------|----------------|
| StoryScore calibration corpus | DB schema, ingestion pipeline, scoring pipeline | `CorpusScore` model, `ingest-training-scripts.ts`, `score-corpus.ts`, `/admin/corpus` UI |
| Multi-provider LLM | Hardcoded OpenAI only | `lib/ai/providers.ts` factory (Claude Sonnet 4.6 + Gemini Flash) |
| Few-shot calibration | No anchors, scores clustered 6–7 | `buildCalibrationExamples()` fetches 3 DB anchors per scoring request |
| Admin corpus dashboard | No visibility into corpus health | `/admin/corpus` — coverage %, spread health, category chart, full scored-scripts table |

---

## Still Incomplete (Blocked on External Action)

| Feature | Status | Gap | Blocker |
|---------|--------|-----|---------|
| Calibration corpus populated | Code complete | Migration not applied, no PDFs ingested yet | Needs `prisma migrate deploy` + env vars on Render |
| `storymagicapp.net` DNS | Instructions sent | Domain in Ryan's Vercel account | Ryan must add domain to Vercel + update GoDaddy |
| Formsubmit activation | Waiting | Voice Marketplace form won't work | Ryan must click activation email |

---

## Design Needed

| Feature | Gap | Why Deferred |
|---------|-----|--------------|
| Story Adviser | Backend prompt exists; no frontend UI | Post-launch backlog per roadmap |
| Long script chunking (>120 pages) | No chunking strategy | Architectural decision needed |
| Multi-tenancy data isolation | Schema not partitioned | Enterprise Phase — SP > 20 |
