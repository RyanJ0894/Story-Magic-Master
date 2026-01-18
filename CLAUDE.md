# CLAUDE.md - Story Magic Monorepo

This file provides guidance to Claude Code when working with this codebase.

## Project Overview

Story Magic is an AI-powered audio production platform that transforms screenplays into immersive audio experiences. This monorepo contains all services for the SaaS product.

## Repository Structure

```
story-magic/
├── packages/
│   ├── director/       # Python/FastAPI - Script parsing & audio direction
│   ├── orchestrator/   # Node.js/Express - Audio generation pipeline
│   └── web/            # Next.js - Frontend application
├── docker-compose.yml  # Local development stack
├── .env.local          # Local credentials (gitignored)
└── pnpm-workspace.yaml # Monorepo configuration
```

## Credentials & Secrets

**Location:** `.env.local` (gitignored, never commit)

Contains:
- Supabase project credentials (story-magic)
- API keys (OpenAI, ElevenLabs, Groq)
- Stripe keys
- Service URLs

**To access credentials:** Read `.env.local` in the repo root.

## Development Commands

### Root Level
```bash
pnpm install              # Install all dependencies
pnpm dev                  # Start all services in parallel
pnpm dev:web              # Start only frontend
pnpm dev:director         # Start only Director Agent
pnpm dev:orchestrator     # Start only Orchestrator
pnpm docker:up            # Start Docker services
pnpm docker:down          # Stop Docker services
```

### Director Agent (Python)
```bash
cd packages/director
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py            # Starts on port 8000
```

### Orchestrator (Node.js)
```bash
cd packages/orchestrator
pnpm install
pnpm dev                  # Starts on port 3001
```

### Web (Next.js)
```bash
cd packages/web
pnpm install
pnpm dev                  # Starts on port 3000
```

## Environment Variables

Copy `.env.local` to each package as needed:
- `packages/web/.env.local` - Frontend (NEXT_PUBLIC_* vars)
- `packages/director/.env` - Director Agent
- `packages/orchestrator/.env` - Orchestrator

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 + Tailwind CSS |
| Auth & DB | Supabase |
| Director | Python/FastAPI + LiteLLM |
| Orchestrator | Node.js/Express + FFmpeg |
| TTS | ElevenLabs |
| LLM | OpenAI GPT-4 |
| Payments | Stripe |

## Supabase Project

- **Project Name:** story-magic
- **Credentials:** See `.env.local`
- **Dashboard:** https://supabase.com/dashboard/project/[project-id]

## API Endpoints

### Director Agent (port 8000)
- `GET /` - Health check
- `POST /generate-scenes` - Parse script into director JSON

### Orchestrator (port 3001)
- `GET /health` - Health check
- `POST /orchestrate` - Generate audio from director JSON

### Web (port 3000)
- Next.js App Router routes

## Database Schema

See `packages/web/supabase/migrations/` for schema definitions.

Key tables:
- `profiles` - User profiles (extends auth.users)
- `projects` - User projects
- `jobs` - Generation jobs
- `usage` - Usage tracking per billing period

## Testing

```bash
pnpm test                 # Run all tests
pnpm --filter @story-magic/web test
pnpm --filter @story-magic/orchestrator test
```

## Deployment

- **Frontend:** Vercel
- **Director:** Render.com
- **Orchestrator:** Render.com
- **Database:** Supabase (managed)

## Related Documentation

Full documentation in the parent `docs/` folder:
- `../docs/ARCHITECTURE.md` - System design
- `../docs/PROJECT_PLAN.md` - Implementation plan
- `../docs/MVP_SAAS_PLAN.md` - Product roadmap
- `../docs/AUTOSCORE_PLAN.md` - Future features
