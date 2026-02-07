# Story Magic Documentation

> Comprehensive documentation for the Story Magic audio production platform
> **Last Updated:** February 1, 2026

## Quick Links

| Document | Description |
|----------|-------------|
| [Project README](../README.md) | Project overview and quick start |
| [Architecture](ARCHITECTURE.md) | System design and data flow |
| [API Reference](API.md) | Complete API documentation |
| [Data Formats](DATA_FORMATS.md) | JSON schemas and data structures |
| [Production Readiness](PRODUCTION_READINESS.md) | Deployment assessment |

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
| [planning/ROADMAP.md](planning/ROADMAP.md) | Development phases and milestones |
| [planning/MVP_SAAS_PLAN.md](planning/MVP_SAAS_PLAN.md) | Public SaaS launch plan |
| [planning/ENTERPRISE_READINESS.md](planning/ENTERPRISE_READINESS.md) | Enterprise deployment (SOC 2, TPN/MPAA) |
| [planning/AUTOSCORE_PLAN.md](planning/AUTOSCORE_PLAN.md) | AutoScore & AutoEdit feature roadmap |

### Intelligence Features

| Document | Purpose |
|----------|---------|
| [STORYSCORE_DESIGN.md](STORYSCORE_DESIGN.md) | 12-dimension script scoring system |
| [STORY_ADVISER_PLAN.md](STORY_ADVISER_PLAN.md) | Inline editing and AI suggestions |
| [FULL_CAPABILITY_PLAN.md](FULL_CAPABILITY_PLAN.md) | Full capability roadmap |
| [BACKLOG.md](BACKLOG.md) | Feature backlog |
| [BUSINESS_MODEL.md](BUSINESS_MODEL.md) | Revenue model and pricing |
| [BIBLIOGRAPHY.md](BIBLIOGRAPHY.md) | Research sources |

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

## Current Status (February 2026)

**Phase:** Pre-Launch — Fixing blockers before MVP 1.0

| Area | Score | Status |
|------|-------|--------|
| Architecture | 9/10 | Consolidated TypeScript monorepo |
| Security | 7/10 | Auth + rate limiting; prototype exposure |
| Code Quality | 8/10 | Strict TypeScript, Zod validation |
| Test Coverage | 4/10 | ~18% overall; pipeline E2E missing |
| Deployment | 8/10 | Render.yaml ready; not yet deployed |

**Critical blockers:** Public share page, voice override wiring, prototype deprecation.
See [code-review/2026-02-01/EXECUTIVE_SUMMARY.md](../code-review/2026-02-01/EXECUTIVE_SUMMARY.md) for full assessment.

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
