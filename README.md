# Story Magic

> Transform screenplays into immersive audio experiences with AI

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)]()

Story Magic is an AI-powered audio production platform that converts film and television scripts (up to 120 pages) into professional-quality audio experiences with intelligent voice casting, music selection, ambient soundscapes, and sound effects.

## Features

- **Intelligent Script Parsing** - AI-driven analysis of screenplays with character identification and dialogue extraction
- **Smart Voice Casting** - Semantic search across 100+ voice profiles with demographic matching
- **Adaptive Audio Selection** - Context-aware music, ambience, and SFX selection based on scene mood and location
- **Professional Mixing** - EBU R128 loudness normalization, adaptive ducking, and film-standard gain staging
- **Word-Level Alignment** - Whisper ASR integration for precise dialogue timing
- **Two-Stage Validation** - LLM output validation with automatic error correction

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Story Magic Pipeline                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │   Script     │───▶│   Director   │───▶│   Audio Director     │  │
│  │   (PDF)      │    │    Agent     │    │       Agent          │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
│                             │                      │                 │
│                             ▼                      ▼                 │
│                      ┌─────────────────────────────────┐            │
│                      │        Validators               │            │
│                      │  (Auto-correction pipeline)     │            │
│                      └─────────────────────────────────┘            │
│                                    │                                 │
│  ┌─────────────────────────────────▼─────────────────────────────┐  │
│  │                    Orchestration Pipeline                      │  │
│  │  ┌─────┐  ┌───────┐  ┌──────────┐  ┌───────┐  ┌────────┐     │  │
│  │  │ TTS │─▶│ Align │─▶│ Timeline │─▶│ Mixer │─▶│ Export │     │  │
│  │  └─────┘  └───────┘  └──────────┘  └───────┘  └────────┘     │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                    │                                 │
│                                    ▼                                 │
│                         ┌──────────────────┐                        │
│                         │  Audio Output    │                        │
│                         │  (M4A @ -16 LUFS)│                        │
│                         └──────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Python 3.11+ (for legacy Director service, being consolidated)
- FFmpeg (bundled via ffmpeg-static)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/story-magic.git
cd story-magic

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Start all services
pnpm dev
```

### Environment Variables

```bash
# LLM Providers
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...

# Text-to-Speech
ELEVENLABS_API_KEY=...

# Database
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Optional: Whisper (word-level alignment)
WHISPER_CPP_PATH=/path/to/whisper
WHISPER_MODEL_PATH=/path/to/ggml-base.en.bin
```

## Project Structure

```
story-magic/
├── packages/
│   ├── orchestrator/          # TypeScript audio pipeline service
│   │   ├── src/
│   │   │   ├── director/      # Script parsing & audio selection
│   │   │   │   ├── agents/    # LLM agents (Director, AudioDirector)
│   │   │   │   ├── tools/     # Semantic search tools
│   │   │   │   ├── validation/# Two-stage validators
│   │   │   │   └── prompts/   # System prompts
│   │   │   ├── orchestrator/  # Audio generation pipeline
│   │   │   │   └── workers/   # TTS, Align, Timeline, Mixer, Export
│   │   │   ├── routes/        # API endpoints
│   │   │   ├── schemas/       # Zod validation schemas
│   │   │   └── lib/           # Shared utilities
│   │   ├── catalog/           # Audio assets (130+ files)
│   │   │   ├── music/         # 40 music tracks
│   │   │   ├── ambience/      # 37 ambient sounds
│   │   │   └── sfx/           # 53 sound effects
│   │   └── knowledge_bases/   # Embeddings & catalogs
│   ├── director/              # Legacy Python service (deprecated)
│   └── web/                   # Next.js frontend
├── docs/                      # Documentation
├── samples/                   # Test scripts
└── docker-compose.yml         # Local development
```

## API Reference

### Health Check

```bash
GET /health
```

Returns service status and version information.

### Generate Scenes (Director Pipeline)

```bash
POST /generate-scenes
Content-Type: application/json

{
  "project_id": "uuid",
  "script_text": "FADE IN:\n\nINT. COFFEE SHOP - DAY\n\n..."
}
```

Returns parsed script with voice assignments and audio selections.

### Orchestrate (Audio Generation)

```bash
POST /orchestrate
Content-Type: application/json

{
  "project_id": "uuid",
  "scenes": [...],           # DirectorJSON scenes array
  "script_text": "..."       # Optional: runs Director first
}
```

Returns audio URLs and playback manifest.

### Download Output

```bash
GET /download/:project_id/:filename
```

Download generated audio files.

## Development

### Running Services

```bash
# All services (recommended for development)
pnpm dev

# Individual services
pnpm dev:orchestrator    # Port 22002
pnpm dev:web            # Port 22000

# Docker services (PostgreSQL, etc.)
pnpm docker:up
pnpm docker:down
```

### Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Type checking
pnpm typecheck
```

### Building

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @story-magic/orchestrator build
```

## Audio Standards

| Parameter | Value | Standard |
|-----------|-------|----------|
| Target Loudness | -16 LUFS | EBU R128 (streaming) |
| True Peak | -1.5 dB | Broadcast safe |
| Sample Rate | 48 kHz | Professional audio |
| Output Format | M4A (AAC) | Wide compatibility |
| Crossfades | 1.5s equal-power | Smooth scene transitions |

## Documentation

- [Architecture](docs/ARCHITECTURE.md) - System design and data flow
- [API Reference](docs/API.md) - Complete API documentation
- [Roadmap](docs/ROADMAP.md) - Development timeline and milestones
- [Requirements](docs/REQUIREMENTS.md) - Feature requirements and priorities
- [Contributing](docs/CONTRIBUTING.md) - Development guidelines
- [Deployment](docs/DEPLOYMENT.md) - Production deployment guide

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ with TypeScript |
| LLM | Vercel AI SDK (OpenAI, Anthropic, Groq) |
| TTS | ElevenLabs API |
| ASR | Whisper (OpenAI API or whisper.cpp) |
| Audio | FFmpeg (bundled via ffmpeg-static) |
| Database | Supabase (PostgreSQL) |
| Validation | Zod |
| Frontend | Next.js 14 |

## Roadmap

See [ROADMAP.md](docs/ROADMAP.md) for the complete development timeline.

**Current Phase:** TypeScript Consolidation (Phase 8)

- [x] Phase 1-7: Director Agent ported to TypeScript
- [ ] Phase 8: Orchestrator workers conversion
- [ ] Phase 9: Cleanup and finalization
- [ ] Phase 10: Production deployment

## License

Proprietary - All rights reserved.

## Support

For support, please contact the development team or open an issue in the repository.
