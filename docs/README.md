# Story Magic Documentation

> Comprehensive documentation for the Story Magic audio production platform

## Quick Links

| Document | Description |
|----------|-------------|
| [Project README](../README.md) | Project overview and quick start |
| [Architecture](ARCHITECTURE.md) | System design and data flow |
| [API Reference](API.md) | Complete API documentation |
| [Data Formats](DATA_FORMATS.md) | JSON schemas and data structures |

## Getting Started

- **New developers:** Start with the [Contributing Guide](guides/CONTRIBUTING.md)
- **Deploying:** See the [Deployment Guide](guides/DEPLOYMENT.md)
- **API integration:** Check the [API Reference](API.md)

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
| [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) | Production readiness assessment and gaps |
| [TOOLING.md](TOOLING.md) | Recommended production tools (Sentry, Pino, etc.) |

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
| [planning/ENTERPRISE_READINESS.md](planning/ENTERPRISE_READINESS.md) | Enterprise deployment plan (SOC 2, TPN/MPAA) |
| [planning/AUTOSCORE_PLAN.md](planning/AUTOSCORE_PLAN.md) | AutoScore & AutoEdit feature roadmap |

### Archive

| Document | Purpose |
|----------|---------|
| [archive/CODE_REVIEW_LEGACY.md](archive/CODE_REVIEW_LEGACY.md) | Code review of legacy Python/JS implementation |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Story Magic                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 Consolidated TypeScript Service           │   │
│  │                                                           │   │
│  │  ┌───────────────┐    ┌───────────────────────────────┐  │   │
│  │  │   Director    │    │        Orchestrator           │  │   │
│  │  │   Pipeline    │───▶│         Pipeline              │  │   │
│  │  │               │    │                               │  │   │
│  │  │ • Script Parse│    │ • TTS Generation              │  │   │
│  │  │ • Voice Select│    │ • Whisper Alignment           │  │   │
│  │  │ • Audio Select│    │ • Timeline Building           │  │   │
│  │  │ • Validation  │    │ • Professional Mixing         │  │   │
│  │  └───────────────┘    │ • Scene Export                │  │   │
│  │                       └───────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         ▼                    ▼                    ▼             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │   Supabase   │   │  ElevenLabs  │   │   OpenAI     │        │
│  │   Database   │   │     TTS      │   │     LLM      │        │
│  └──────────────┘   └──────────────┘   └──────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Current Status

**Phase:** TypeScript Consolidation Complete - Ready for Production Testing

| Component | Status |
|-----------|--------|
| Director Pipeline | ✅ Complete |
| Validation System | ✅ Complete |
| TTS Worker | ✅ Complete |
| Alignment Worker | ✅ Complete |
| Timeline Worker | ✅ Complete |
| Export Worker | ✅ Complete |
| Mixer Worker | ✅ Complete |
| Unit Tests | ✅ 204 tests passing |
| E2E Tests | 🔄 Infrastructure ready |
| Production Deploy | 🔲 Pending |

## Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ |
| Language | TypeScript 5+ |
| Framework | Express.js |
| Frontend | Next.js 14 |
| LLM | Vercel AI SDK |
| TTS | ElevenLabs |
| Audio | FFmpeg |
| Database | Supabase (PostgreSQL) |
| Validation | Zod |
| Testing | Vitest, Playwright |

## Key Concepts

### Director Pipeline

The Director Pipeline parses screenplays and selects audio:

1. **DirectorAgent** - Parses script into structured dialogue with voice assignments
2. **AudioDirectorAgent** - Selects music, ambience, and SFX for each scene
3. **Validators** - Ensures output quality with automatic error correction

### Orchestration Pipeline

The Orchestration Pipeline generates the final audio:

1. **TTS Worker** - Generates speech using ElevenLabs
2. **Align Worker** - Creates word-level timing with Whisper
3. **Timeline Worker** - Builds event sequence for mixing
4. **Mixer Worker** - Professional audio mixing with FFmpeg
5. **Export Worker** - Concatenates scenes and generates manifest

### Audio Standards

| Parameter | Value |
|-----------|-------|
| Target Loudness | -16 LUFS (EBU R128) |
| True Peak | -1.5 dB |
| Sample Rate | 48 kHz |
| Output Format | M4A (AAC) |

## Contributing

See [guides/CONTRIBUTING.md](guides/CONTRIBUTING.md) for development guidelines.

## Support

- **Documentation Issues:** Open a GitHub Issue
- **Feature Requests:** Open a GitHub Discussion
- **Security Issues:** Email security@storymagic.ai
