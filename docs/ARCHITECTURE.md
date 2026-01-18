# Architecture

> System design and data flow for Story Magic

## Overview

Story Magic is a two-stage audio production pipeline that transforms screenplays into professional audio experiences:

1. **Director Stage** - AI-driven script parsing and audio selection
2. **Orchestration Stage** - Audio generation, mixing, and export

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Story Magic System                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        Director Pipeline                             │    │
│  │  ┌──────────────┐   ┌──────────────┐   ┌─────────────────────────┐  │    │
│  │  │  Script      │   │  Director    │   │   Audio Director        │  │    │
│  │  │  Input       │──▶│  Agent       │──▶│   Agent                 │  │    │
│  │  │  (PDF/Text)  │   │              │   │                         │  │    │
│  │  └──────────────┘   └──────┬───────┘   └───────────┬─────────────┘  │    │
│  │                            │                        │                │    │
│  │                            ▼                        ▼                │    │
│  │                    ┌───────────────┐       ┌───────────────┐        │    │
│  │                    │  Voice Search │       │ Audio Search  │        │    │
│  │                    │  Tool         │       │ Tools         │        │    │
│  │                    └───────────────┘       └───────────────┘        │    │
│  │                            │                        │                │    │
│  │                            ▼                        ▼                │    │
│  │                    ┌─────────────────────────────────────────┐      │    │
│  │                    │           Validators                     │      │    │
│  │                    │  • DirectorJSONValidator                 │      │    │
│  │                    │  • SceneAudioValidator                   │      │    │
│  │                    │  • Auto-correction pipeline              │      │    │
│  │                    └─────────────────────────────────────────┘      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     Orchestration Pipeline                           │    │
│  │                                                                      │    │
│  │  ┌───────┐  ┌─────────┐  ┌──────────┐  ┌───────┐  ┌──────────┐     │    │
│  │  │  TTS  │─▶│  Align  │─▶│ Timeline │─▶│ Mixer │─▶│  Export  │     │    │
│  │  └───────┘  └─────────┘  └──────────┘  └───────┘  └──────────┘     │    │
│  │      │           │            │            │            │           │    │
│  │      ▼           ▼            ▼            ▼            ▼           │    │
│  │  ElevenLabs  Whisper    Validator     FFmpeg      Supabase         │    │
│  │                ASR                    Filter      Storage          │    │
│  │                                       Graphs                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│                           ┌──────────────────┐                              │
│                           │   Audio Output   │                              │
│                           │  M4A @ -16 LUFS  │                              │
│                           └──────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Director Pipeline

### DirectorAgent

The DirectorAgent parses screenplay text into structured JSON with voice assignments.

**Responsibilities:**
- Parse scene headers (INT/EXT, location, time)
- Extract dialogue lines with character attribution
- Identify character metadata (age, gender, ethnicity)
- Assign unique voices using semantic search
- Handle character reveals (unknown name → revealed name)
- Preserve action/description lines for narrator
- Expand abbreviations (INT. → Interior)
- Remove parentheticals from dialogue

**Input:**
```typescript
interface DirectorAgentInput {
  project_id: string;
  script_text: string;
}
```

**Output:**
```typescript
interface DirectorJSON {
  project_id: string;
  scenes: Scene[];
}

interface Scene {
  scene_id: string;
  header: string;
  mood?: string;
  intensity?: number;
  dialogue: DialogueLine[];
}

interface DialogueLine {
  line_id: string;
  character: string;
  text: string;
  voice_key: string;
  metadata?: CharacterMetadata;
}
```

### AudioDirectorAgent

The AudioDirectorAgent selects music, ambience, and SFX for each scene.

**Responsibilities:**
- Select background music based on scene mood
- Select ambient sounds based on location (INT/EXT)
- Identify SFX triggers from capitalized action words
- Apply knowledge base patterns for selection
- Enforce mandatory ambience rules (FOREST, HOSPITAL, etc.)

**Input:** DirectorJSON from DirectorAgent

**Output:**
```typescript
interface SceneAudioJSON {
  project_id: string;
  audio_selections: SceneAudioEntry[];
}

interface SceneAudioEntry {
  scene_id: string;
  music?: AudioCue[];
  ambience?: AudioCue[];
  sfx?: AudioCue[];
}
```

### Semantic Search Tools

Both agents use embedding-based semantic search:

| Tool | Purpose | Embeddings |
|------|---------|------------|
| `search_voices` | Find voice profiles by description | 384-dim (all-MiniLM-L6-v2) |
| `search_music` | Find music tracks by mood/style | 384-dim |
| `search_ambience` | Find ambient sounds by location | 384-dim |
| `search_sfx` | Find sound effects by action | 384-dim |

### Validation Pipeline

Two-stage validation with automatic correction:

```
DirectorJSON ──▶ DirectorJSONValidator ──▶ AutoCorrect ──▶ Validated
                        │
                        ▼
              Validation Checks:
              • Voice uniqueness
              • Age-to-label mapping
              • Ethnicity-to-style mapping
              • Character consistency

SceneAudioJSON ──▶ SceneAudioValidator ──▶ AutoCorrect ──▶ Validated
                         │
                         ▼
               Validation Checks:
               • Ambience matches location
               • SFX has valid line_id references
               • Music mood aligns with scene
               • Files exist in catalog
```

## Orchestration Pipeline

### Step 1: TTS Generation

Converts dialogue text to speech using ElevenLabs API.

```typescript
interface StemResult {
  line_id: string;
  path: string;        // Local file path
  duration: number;    // Duration in seconds
  cached: boolean;     // Whether retrieved from cache
}
```

**Features:**
- Parallel generation (4 concurrent requests)
- Content-hash based caching (idempotent)
- Automatic retry with exponential backoff
- Voice map persistence to database

### Step 2: Alignment

Computes word-level timing using Whisper ASR.

```typescript
interface LineAlignment {
  line_id: string;
  start: number;       // Start time in seconds
  end: number;         // End time in seconds
  words?: WordTiming[];
}

interface WordTiming {
  w: string;           // Word text
  s: number;           // Start time (absolute)
  e: number;           // End time (absolute)
}
```

**Features:**
- Whisper.cpp for local processing
- OpenAI Whisper API fallback
- Duration-based fallback if ASR unavailable
- Context-aware gap computation

### Step 3: Timeline Building

Constructs event timeline from alignment and cue selections.

```typescript
interface Timeline {
  scene_id: string;
  events: TimelineEvent[];
}

type TimelineEvent =
  | { type: 'dialogue_in'; line_id: string; at: number }
  | { type: 'dialogue_out'; line_id: string; at: number }
  | { type: 'music_in'; cue_id: string; at: number; fade: number; gain_db: number }
  | { type: 'music_out'; cue_id: string; at: number; fade: number }
  | { type: 'ambience_in'; cue_id: string; at: number; fade: number; gain_db: number }
  | { type: 'ambience_out'; cue_id: string; at: number; fade: number }
  | { type: 'sfx_at'; cue_id: string; at: number; gain_db: number; duration: number };
```

**Timeline Validator Checks:**
- No overlapping music tracks (except crossfades)
- No orphaned out events without corresponding in events
- Dialogue ducking is sufficient
- Events are in chronological order

### Step 4: Professional Mixing

FFmpeg-based audio mixing with film-standard gain staging.

**Mix Parameters:**
| Track | Gain | Notes |
|-------|------|-------|
| Dialogue | 0 dB | Reference level |
| Music | -4 dB | Ducked during dialogue |
| Ambience | -6 dB | Subtle background |
| SFX | -4 dB | Clear and punchy |

**Features:**
- Adaptive ducking based on dialogue RMS envelope
- Sidechain compression fallback
- EBU R128 loudness normalization (-16 LUFS)
- True peak limiting (-1.5 dB)
- Music/ambience looping to scene duration

### Step 5: Export

Scene concatenation and manifest generation.

```typescript
interface PlaybackManifest {
  project_id: string;
  order: ManifestSceneEntry[];
  total: number;           // Total duration in seconds
  public_url: string | null;
}

interface ManifestSceneEntry {
  scene_id: string;
  offset: number;          // Start offset in final audio
  duration: number;
  lines?: LineTimingEntry[];
}
```

**Features:**
- Equal-power crossfades between scenes (1.5s)
- Supabase Storage upload
- Public URL generation
- Line-level timing for playback UI

## Data Flow

```
Script Text
    │
    ▼
┌─────────────────┐
│ DirectorAgent   │◀──── search_voices tool
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ DirectorJSON    │
│ Validator       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AudioDirector   │◀──── search_music, search_ambience, search_sfx
│ Agent           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SceneAudio      │
│ Validator       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────┐
│ TTS Worker      │────▶│ Audio Stems │
└────────┬────────┘     └─────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────┐
│ Align Worker    │────▶│ Alignments  │
└────────┬────────┘     └─────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────┐
│ Timeline Worker │────▶│ Timelines   │
└────────┬────────┘     └─────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────┐
│ Mixer Worker    │────▶│ Scene Audio │
└────────┬────────┘     └─────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────┐
│ Export Worker   │────▶│ Final M4A   │
└─────────────────┘     └─────────────┘
```

## Database Schema

### Core Tables

```sql
-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Director JSON storage
CREATE TABLE director_jsons (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  director_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TTS stem caching
CREATE TABLE tts_stems (
  id UUID PRIMARY KEY,
  project_id UUID,
  line_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  voice_key TEXT NOT NULL,
  storage_path TEXT,
  duration_sec NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(content_hash, voice_key)
);

-- Voice-character mapping
CREATE TABLE voice_maps (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  character TEXT NOT NULL,
  voice_key TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Timeline storage
CREATE TABLE timelines (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  scene_id TEXT NOT NULL,
  timeline_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mix manifests
CREATE TABLE mix_manifests (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  scene_id TEXT NOT NULL,
  mix_manifest_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alignments
CREATE TABLE alignments (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  scene_id TEXT NOT NULL,
  alignment_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Runtime | Node.js 20+ | Server runtime |
| Language | TypeScript 5+ | Type safety |
| Framework | Express.js | HTTP server |
| LLM | Vercel AI SDK | Multi-provider LLM |
| TTS | ElevenLabs API | Voice synthesis |
| ASR | Whisper | Speech alignment |
| Audio | FFmpeg | Audio processing |
| Database | Supabase | PostgreSQL + Storage |
| Validation | Zod | Runtime type validation |
| Embeddings | all-MiniLM-L6-v2 | Semantic search |

## Scaling Considerations

### Current Limitations
- Single-threaded Node.js (I/O bound, not CPU bound)
- In-memory embedding stores
- Local file storage for audio stems

### Future Scaling
- Worker threads for CPU-intensive mixing
- Redis for embedding cache
- S3/GCS for stem storage
- Queue-based job processing (BullMQ)
- Horizontal scaling with load balancer

## Security

### API Security
- API key authentication for all endpoints
- Rate limiting per project
- Input validation via Zod schemas

### Data Security
- No PII storage beyond project metadata
- Encrypted storage for audio files
- TLS for all external API calls

### Content Security
- Script content processed in memory
- Temporary files cleaned up after processing
- No persistent logging of script content
