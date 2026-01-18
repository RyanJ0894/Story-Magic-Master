# Story Magic Orchestrator

Consolidated TypeScript service for Story Magic audio production. Combines the Director Pipeline (script parsing & audio selection) with the Orchestration Pipeline (audio generation & mixing).

## Architecture

```
Script → Director Pipeline → Director JSON → Orchestrator Pipeline → Final Audio
              │                                        │
              ├─ DirectorAgent (LLM)                   ├─ TTS (ElevenLabs)
              ├─ AudioDirectorAgent (LLM)              ├─ Alignment (Whisper)
              └─ Validation (auto-correction)         ├─ Timeline Building
                                                      ├─ Professional Mixing
                                                      └─ Scene Export
```

## Features

- **Director Pipeline**: AI-powered script parsing with voice and audio selection
- **AI TTS**: High-quality dialogue generation via ElevenLabs
- **Word-Level Alignment**: Whisper ASR with intelligent fallback
- **Professional Mixing**: Film-standard gain staging with adaptive ducking
- **EBU R128 Compliance**: -16 LUFS loudness normalization

## Development

```bash
# Install dependencies
pnpm install

# Run development server (port 22002)
pnpm dev

# Build for production
pnpm build

# Type check
pnpm typecheck

# Run production server
pnpm start
```

## Environment Variables

```bash
# LLM Providers
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk-...

# Audio
ELEVENLABS_API_KEY=...

# Database
SUPABASE_URL=...
SUPABASE_ANON_KEY=...

# Server
PORT=22002
```

## API Endpoints

### Health Check
```
GET /health
```

### Generate Scenes (Director Pipeline)
```
POST /generate-scenes
Content-Type: application/json

{
  "project_id": "uuid",
  "script_text": "FADE IN:\n\nINT. HOUSE - DAY\n..."
}
```

### Orchestrate (Full Pipeline)
```
POST /orchestrate
Content-Type: application/json

{
  "project_id": "uuid",
  "script_text": "...",  // OR
  "scenes": [...]        // Director JSON scenes
}
```

### Download Output
```
GET /download/:project_id/:filename
```

## Project Structure

```
src/
├── index.ts                 # Express server
├── routes/                  # API routes
├── director/                # Director Pipeline
│   ├── agents/              # LLM agents
│   ├── tools/               # Search tools
│   ├── validation/          # Validators
│   └── prompts/             # System prompts
├── orchestrator/            # Orchestration Pipeline
│   ├── pipeline.ts          # Main pipeline
│   └── workers/             # Processing workers
├── schemas/                 # Zod schemas
└── lib/                     # Utilities
```

## Audio Standards

| Parameter | Value |
|-----------|-------|
| Target Loudness | -16 LUFS (EBU R128) |
| True Peak | -1.5 dB |
| Sample Rate | 48 kHz |
| Output Format | M4A (AAC) |

## Deployment

Deployed on Render.com with automatic GitHub integration.
