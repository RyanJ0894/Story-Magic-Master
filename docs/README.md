# Story Magic Documentation

> Comprehensive documentation for the Story Magic audio production platform
> **Last Updated:** February 7, 2026

## Quick Links

| Document | Description |
|----------|-------------|
| [Consolidated Roadmap](ROADMAP-2026-02-07.md) | **Single source of truth** for go-forward plan |
| [Production TODO](TODO_PRODUCTION_LAUNCH.md) | Detailed ticket tracker (96 tickets, all complete) |
| [Production Readiness](PRODUCTION_READINESS.md) | Deployment assessment and health scorecard |
| [Architecture](ARCHITECTURE.md) | System design and data flow |
| [API Reference](API.md) | Complete API documentation |
| [Deploy Runbook](../scripts/deploy-runbook.md) | Step-by-step deployment procedures |

## Getting Started

- **New developers:** Start with the [Contributing Guide](guides/CONTRIBUTING.md)
- **Deploying:** See the [Deployment Guide](guides/DEPLOYMENT.md)
- **API integration:** Check the [API Reference](API.md)
- **Current status:** See [Production Readiness](PRODUCTION_READINESS.md)

---

## Documentation Index

### Core Documentation

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, data flow, component interactions |
| [API.md](API.md) | REST API endpoints, request/response formats |
| [DATA_FORMATS.md](DATA_FORMATS.md) | JSON schemas, data structures, validation |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Functional and non-functional requirements |
| [AUDIO_CATALOG.md](AUDIO_CATALOG.md) | Music, ambience, SFX asset library |
| [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) | Production readiness assessment |
| [TOOLING.md](TOOLING.md) | Production tools (Sentry, Pino, Checkly, etc.) |
| [FEATURE_FLAGS.md](FEATURE_FLAGS.md) | Feature flag strategy |

### Development Guides

| Document | Purpose |
|----------|---------|
| [guides/CONTRIBUTING.md](guides/CONTRIBUTING.md) | Code style, git workflow, testing |
| [guides/DEPLOYMENT.md](guides/DEPLOYMENT.md) | Production deployment instructions |

### Planning & Strategy

| Document | Purpose |
|----------|---------|
| [ROADMAP-2026-02-07.md](ROADMAP-2026-02-07.md) | **Consolidated go-forward plan** (single source of truth) |
| [TODO_PRODUCTION_LAUNCH.md](TODO_PRODUCTION_LAUNCH.md) | Detailed ticket tracker (96 tickets, 254 SP) |
| [planning/ENTERPRISE_READINESS.md](planning/ENTERPRISE_READINESS.md) | Enterprise deployment (SOC 2, TPN/MPAA) |
| [planning/AUTOSCORE_PLAN.md](planning/AUTOSCORE_PLAN.md) | AutoScore & AutoEdit feature roadmap |
| [planning/ROADMAP.md](planning/ROADMAP.md) | ARCHIVED — Phase history |
| [planning/MVP_SAAS_PLAN.md](planning/MVP_SAAS_PLAN.md) | ARCHIVED — Launch checklists extracted |

### Intelligence Features & Business

| Document | Purpose |
|----------|---------|
| [STORYSCORE_DESIGN.md](STORYSCORE_DESIGN.md) | 12-dimension script scoring system (Phase A reference) |
| [STORY_ADVISER_PLAN.md](STORY_ADVISER_PLAN.md) | Inline editing and AI suggestions (Phase A reference) |
| [BUSINESS_MODEL.md](BUSINESS_MODEL.md) | Revenue model and pricing |
| [BIBLIOGRAPHY.md](BIBLIOGRAPHY.md) | Research sources |
| [FULL_CAPABILITY_PLAN.md](FULL_CAPABILITY_PLAN.md) | ARCHIVED — Absorbed into consolidated roadmap |
| [BACKLOG.md](BACKLOG.md) | ARCHIVED — Absorbed into Phase 4 |

### Code Reviews

| Document | Purpose |
|----------|---------|
| [../code-review/2026-02-01/](../code-review/2026-02-01/) | **Latest:** Full codebase review with requirements sync |
| [../code-review/2026-01-28-technical-review.md](../code-review/2026-01-28-technical-review.md) | Technical deep-dive (setImmediate, job queue) |
| [../code-review/2026-01-19.md](../code-review/2026-01-19.md) | Post-consolidation review |
| [archive/CODE_REVIEW_LEGACY.md](archive/CODE_REVIEW_LEGACY.md) | Pre-consolidation prototype review |

### Session History

| Document | Purpose |
|----------|---------|
| [SESSION_CONTEXT.md](SESSION_CONTEXT.md) | Jan 18 production hardening session |
| [CONSOLIDATION_PROGRESS_REPORT.md](CONSOLIDATION_PROGRESS_REPORT.md) | TypeScript consolidation summary (Jan 19) |
| [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) | Phase-based implementation (Jan 21) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Story Magic                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 Consolidated TypeScript Service           │   │
│  │  ┌───────────────┐    ┌───────────────────────────────┐  │   │
│  │  │   Director    │    │        Orchestrator           │  │   │
│  │  │   Pipeline    │───▶│         Pipeline              │  │   │
│  │  │ • Script Parse│    │ • TTS Generation              │  │   │
│  │  │ • Voice Select│    │ • Whisper Alignment           │  │   │
│  │  │ • Audio Select│    │ • Timeline Building           │  │   │
│  │  │ • Validation  │    │ • Professional Mixing         │  │   │
│  │  └───────────────┘    │ • Scene Export                │  │   │
│  │                       └───────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│         ┌────────────────────┼────────────────────┐             │
│         ▼                    ▼                    ▼             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │   Supabase   │   │  ElevenLabs  │   │   OpenAI     │        │
│  └──────────────┘   └──────────────┘   └──────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

## Current Status (February 7, 2026)

**Phase:** MVP Complete — Ready for staging deployment

| Area | Score | Status |
|------|-------|--------|
| Architecture | 9/10 | Consolidated TypeScript monorepo |
| Security | 9/10 | CORS, CSRF, Helmet/HSTS, path traversal, auth guards |
| Code Quality | 8/10 | Strict TypeScript, Zod validation, Pino logging |
| Test Coverage | 7/10 | 642 tests (364 orchestrator + 278 web) |
| Deployment | 9/10 | Staging config ready, CI pipeline, cleanup scheduler |

**All 96 tickets complete** across 8 phases (254 SP). See [Consolidated Roadmap](ROADMAP-2026-02-07.md) for go-forward plan.

## Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ |
| Language | TypeScript 5+ (strict) |
| Framework | Express.js (API), Next.js 14 (frontend) |
| LLM | Vercel AI SDK (OpenAI, Groq) |
| TTS | ElevenLabs |
| Audio | FFmpeg (EBU R128, -16 LUFS) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase JWT + SSR |
| Payments | Stripe |
| Validation | Zod |
| Testing | Vitest, Playwright |
| Monitoring | Sentry, Checkly, Pino |
