# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Story Magic is an AI-powered audio production platform that transforms screenplays into immersive audio experiences. This is a pnpm monorepo with two active packages: `web` (Next.js frontend) and `orchestrator` (Express backend).

**Current State (Mar 2026):** MVP ~95% complete. Phases 0-7 done. 642 tests passing. Ready for staging deployment.

## Repository Structure

```
story-magic/
├── packages/
│   ├── shared/         # Shared Prisma schema + generated client
│   │   └── prisma/     # schema.prisma + migrations (single source of truth)
│   ├── orchestrator/   # TypeScript/Express — Director + Orchestrator pipeline (port 22002)
│   │   └── src/
│   │       ├── director/   # Script parsing, voice assignment, LLM agents
│   │       ├── orchestrator/  # TTS, audio mix, timeline, export
│   │       ├── routes/     # Express routes (generate-scenes, orchestrate, analyze, preview)
│   │       ├── lib/        # env, logger, prisma, sentry, monitoring, cleanup
│   │       └── middleware/ # auth, rate-limit
│   └── web/            # Next.js 14 App Router frontend (port 22000)
│       ├── app/        # Routes: dashboard, projects, writer, reader, billing, admin, settings
│       ├── lib/        # db, features, stripe, queue, generation, scoring, upload, ...
│       ├── components/ # Shared UI components (Radix + Tailwind)
│       ├── hooks/      # React hooks
│       └── supabase/   # Storage bucket config (auth is Clerk, not Supabase)
├── docker-compose.yml  # Local dev: PostgreSQL, Redis
├── .doppler.yaml       # Doppler project config (story-magic/dev) — committed
└── .env.local          # Credentials fallback (gitignored; prefer Doppler)
```

## Development Commands

```bash
# Root
pnpm install              # Install all workspace dependencies
doppler run -- pnpm dev   # Start all services (secrets from Doppler — preferred)
pnpm dev                  # Start all services (uses .env.local if Doppler not available)
pnpm dev:web              # Web only (port 22000)
pnpm dev:orchestrator     # Orchestrator only (port 22002)
pnpm build                # Build all packages
pnpm lint                 # Lint all packages
pnpm test                 # Run all tests
pnpm docker:up            # Start PostgreSQL + Redis
pnpm docker:down
pnpm docker:logs
pnpm clean                # Remove node_modules, .next, dist

# Per-package (orchestrator)
pnpm --filter @story-magic/orchestrator test
pnpm --filter @story-magic/orchestrator test:watch
pnpm --filter @story-magic/orchestrator typecheck

# Per-package (web)
pnpm --filter @story-magic/web test
pnpm --filter @story-magic/web test:watch
pnpm --filter @story-magic/web test:e2e         # Playwright E2E
pnpm --filter @story-magic/web test:component   # Component tests
pnpm --filter @story-magic/web test:all         # Unit + component + E2E
pnpm --filter @story-magic/web typecheck
pnpm --filter @story-magic/web seed:corpus      # Seed film corpus
pnpm --filter @story-magic/web ingest:training  # Ingest training PDFs → script_corpus
pnpm --filter @story-magic/web score:corpus     # Batch score corpus (Gemini Flash default)

# Single test file
pnpm --filter @story-magic/orchestrator test -- src/director/pipeline.test.ts
pnpm --filter @story-magic/web test -- tests/someTest.test.ts
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router) + Tailwind + Radix UI |
| Auth | Clerk (`@clerk/nextjs`) |
| Database | PostgreSQL via Prisma (shared schema in `packages/shared`) |
| Queue/Cache | Redis (Upstash in prod) |
| Orchestrator | TypeScript/Express + FFmpeg |
| TTS | ElevenLabs |
| LLM | Claude Sonnet 4.6 (production scoring), Gemini 2.0 Flash (corpus batch), OpenAI GPT-4 / Groq |
| Payments | Stripe |
| Monitoring | Sentry + Checkly heartbeats |
| Deployment | Render.com (web + orchestrator) |

## Architecture Notes

- **Director is not a separate service** — it is consolidated into the orchestrator at `src/director/`. The Python FastAPI prototype is deprecated.
- **Single Prisma schema** — `packages/shared/prisma/schema.prisma`. Run migrations from `packages/shared`.
- **Auth is Clerk**, not Supabase. Supabase is used only for file storage buckets. Middleware at `packages/web/middleware.ts` uses `clerkMiddleware`.
- **Feature flags** live in `packages/web/lib/features/flags.ts`. Gate new features with `isFeatureEnabled(FEATURES.X)` or `<FeatureGate feature="X">`.
- **StoryScore uses Claude Sonnet 4.6** via `lib/ai/providers.ts` (Vercel AI SDK). Corpus batch scoring uses Gemini 2.0 Flash. Env vars needed: `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`.
- **Calibration corpus** at `docs/StoryScore Scripts/` — 43 PDFs + Excel. Run `ingest:training` then `score:corpus` to populate `script_corpus` + `corpus_score` tables. Admin UI at `/admin/corpus`.
- **Orchestrator auth middleware** (`src/middleware/auth.js`) verifies Clerk JWTs on all protected routes.
- **Download endpoint** in `src/index.ts` includes IDOR and path traversal protection — maintain these checks when modifying.
- **Connection pool**: 8 connections per service (16 total), targeting a ~20-connection PostgreSQL limit.

## API Endpoints

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /health` | None | Health check |
| `POST /generate-scenes` | Required | Parse script → director JSON |
| `POST /orchestrate` | Required | Generate audio from director JSON |
| `POST /analyze` | Required | Script analysis |
| `POST /preview` | Required | Preview audio generation |
| `GET /download/:project_id/:filename` | Required | Secure file download |

## Database Schema (Key Tables)

Both packages share the same PostgreSQL database. Key tables (web schema):
- `users` / `profiles` — Clerk user data synced via webhook
- `projects` — User projects with script content
- `jobs` — Audio generation jobs with status tracking
- `usage` — Usage tracking per billing period

Run migrations: `cd packages/shared && pnpm prisma migrate dev`

## Environment Variables

See `.env.local` in repo root. Required vars:

```
# Database + Queue
DATABASE_URL
REDIS_URL

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY

# AI Services
OPENAI_API_KEY or GROQ_API_KEY
ELEVENLABS_API_KEY

# Stripe
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

# Orchestrator (used by web)
ORCHESTRATOR_URL
```

## Testing

- **Orchestrator**: Vitest (364 tests)
- **Web**: Vitest unit (278 tests) + Playwright E2E + Vitest component tests
- Tests are co-located in `tests/` directories or alongside source as `*.test.ts`

## Deployment

- **Frontend + Orchestrator:** Render.com (config in `render.yaml`)
- **CI/CD:** GitHub Actions
- **Runbooks:** `packages/web/scripts/deploy-runbook.md`, `packages/web/scripts/stripe-test-checklist.md`
