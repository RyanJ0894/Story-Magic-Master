# Session Context - 2026-03-11

**Project:** Story Magic
**Path:** `/Users/admin/dev2/clients/RyanJae/story-magic`

## Summary

Built the complete StoryScore training data ingestion pipeline from scratch — Prisma schema migration, AI provider factory, scoring service rewrite (OpenAI → Claude Sonnet 4.6), PDF ingestion script for 43 training screenplays, batch corpus scoring script (Gemini 2.0 Flash), and an admin calibration dashboard. Also wrote a comprehensive PM-facing StoryScore documentation file with Mermaid diagrams. Closed out the marketing site plan: confirmed all 8 landing sections exist, build passes clean, site is live on Vercel. Fixed one remaining SaaS responsive breakpoint. Produced DNS instructions for Ryan to repoint storymagicapp.net (GoDaddy → Vercel + Render).

## Files Modified

### StoryScore Pipeline (new)
- `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/prisma/schema.prisma` — Added 9 training fields to ScriptCorpus (scriptText, datasetCategory, act break pages, dialogue %, scene count, conflict density, page count, pdf filename); added CorpusScore model
- `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/prisma/migrations/0003_add_corpus_training_fields/migration.sql` — Raw SQL migration (created manually; DIRECT_DATABASE_URL not in .env.local)
- `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/lib/ai/providers.ts` — New multi-provider factory (Claude Sonnet 4.6 + Gemini 2.0 Flash via Vercel AI SDK)
- `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/lib/scoring/service.ts` — Rewritten: OpenAI → Vercel AI SDK, uses resolveModel(), callScoringLLM() shared fn, useCalibration flag
- `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/lib/scoring/prompts.ts` — Added buildCalibrationExamples() (async DB fetch of 3 anchors), updated buildScoringPrompt() signature to accept calibration examples
- `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/scripts/ingest-training-scripts.ts` — New: reads Excel + 43 PDFs, fuzzy title matching, extracts structural metrics (scene count, dialogue %, conflict density, act breaks), upserts to script_corpus
- `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/scripts/score-corpus.ts` — New: batch scores all corpus scripts, stores in corpus_score, prints calibration health report (spread check)
- `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/admin/corpus/page.tsx` — New admin page at /admin/corpus: coverage stats, spread health indicator, category bar chart, full scored scripts table
- `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/admin/layout.tsx` — Added Corpus nav item
- `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/components/admin/admin-sidebar.tsx` — Added BookOpen icon
- `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/package.json` — Added @ai-sdk/anthropic, @ai-sdk/google, ai, xlsx; added ingest:training + score:corpus scripts
- `/Users/admin/dev2/clients/RyanJae/story-magic/CLAUDE.md` — Updated LLM row, added ingest/score commands, added architecture note

### Documentation (new)
- `/Users/admin/dev2/clients/RyanJae/story-magic/docs/STORYSCORE_HOW_IT_WORKS.md` — Comprehensive PM-facing doc: 6 parts, 8 Mermaid diagrams, 12-dimension table, calibration corpus library, training pipeline, few-shot feedback loop, model selection rationale

### SaaS App Polish
- `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/page.tsx` — Features section: px-4 → px-4 sm:px-6 lg:px-8

## Current State

- **StoryScore pipeline**: Code complete, typecheck clean (0 errors). Migration SQL written but needs `prisma migrate deploy` run against live DB.
- **Calibration corpus**: 43 PDFs + Excel at `docs/StoryScore Scripts/` — ready to ingest. Run order: `ingest:training` → `score:corpus`.
- **Marketing site**: Fully built, all 8 sections, build clean. Live at https://storymagic.servicevision.io. Plan verified complete.
- **SaaS app**: Dark mode default confirmed, responsive fixes applied.
- **DNS**: Ryan needs to repoint storymagicapp.net in GoDaddy + add domain to his Vercel project. Instructions sent via text.

## Next Steps

- [ ] Ryan: click Formsubmit activation email in talent@storymagicapp.net inbox (Voice Marketplace form)
- [ ] Ryan: add storymagicapp.net + www to his Vercel project (story-magic-marketing) → Settings → Domains
- [ ] Ryan: update GoDaddy DNS — A @ 76.76.21.21, CNAME www cname.vercel-dns.com, CNAME app story-magic-web.onrender.com
- [ ] Ryan: add app.storymagicapp.net as custom domain in Render (story-magic-web service)
- [ ] Apply Prisma migration to production: `cd packages/web && npx prisma migrate deploy`
- [ ] Add env vars to Render web service: ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY
- [ ] Run ingestion: `pnpm --filter @story-magic/web ingest:training`
- [ ] Run corpus scoring: `pnpm --filter @story-magic/web score:corpus`
- [ ] Verify calibration health at /admin/corpus (target: spread ≥ 2.5)

## Open Questions / Blockers

- **storymagicapp.net domain**: 403 when adding via our Vercel CLI — domain must be in Ryan's Vercel account. Ryan must add it himself.
- **DIRECT_DATABASE_URL**: Not in .env.local — Prisma migrate dev can't run locally. Use `migrate deploy` on Render or add the var.
- **Calibration model cost**: Gemini 2.0 Flash default (~$7 for 43 scripts). Can override with `--model claude-sonnet-4-6` for higher precision at ~$15.
