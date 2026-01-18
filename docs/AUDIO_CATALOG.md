# Audio Catalog

## Overview

The audio catalog contains 140+ professional audio assets organized into four categories:

| Category | Count | Location |
|----------|-------|----------|
| Music | 35 tracks | `Orchestrator/catalog/music/` |
| Ambience | 45 tracks | `Orchestrator/catalog/ambience/` |
| SFX | 60+ tracks | `Orchestrator/catalog/sfx/` |
| Voices | 50+ | ElevenLabs API (metadata in Director) |

## Music Library

### Groups

| Group | Description | Intensity Range |
|-------|-------------|-----------------|
| UPLIFTING | Hopeful, bright, inspiring | 50-70 |
| DRAMATIC | Emotional, powerful, sweeping | 60-80 |
| TENSE | Suspenseful, nervous, uncertain | 70-85 |
| EPIC | Grand, cinematic, heroic | 75-90 |
| MELANCHOLIC | Sad, reflective, somber | 40-60 |
| ACTION | Fast-paced, energetic, driving | 80-95 |

### Selection Guidelines

**By Scene Mood:**
```
"romantic"     → UPLIFTING, MELANCHOLIC (intensity 40-60)
"tense"        → TENSE (intensity 70-85)
"action"       → ACTION, EPIC (intensity 80-95)
"sad"          → MELANCHOLIC (intensity 40-60)
"triumphant"   → EPIC, UPLIFTING (intensity 70-90)
"mysterious"   → TENSE (intensity 50-70)
```

**By Scene Intensity:**
```
0.0 - 0.3  → Low intensity tracks (30-50)
0.3 - 0.5  → Medium-low tracks (40-60)
0.5 - 0.7  → Medium tracks (50-70)
0.7 - 0.85 → High tracks (70-85)
0.85 - 1.0 → Very high tracks (85-100)
```

### Music Volume Standards

| Context | Volume (dB) |
|---------|-------------|
| Background (under dialogue) | -28 to -25 |
| Feature moment | -20 to -18 |
| Transition/sting | -15 to -12 |

**Ducking:** Music ducks by 7dB during dialogue.

## Ambience Library

### Groups

| Group | Typical Scenes |
|-------|----------------|
| Forest | EXT. WOODS, JUNGLE, PARK |
| Beach & Ocean | EXT. BEACH, PIER, COASTAL |
| City Streets | EXT. DOWNTOWN, ALLEY, MARKET |
| Suburbs & Countryside | EXT. FARM, RURAL ROAD |
| Medical Facilities | INT. HOSPITAL, CLINIC, ER |
| Office & Corporate | INT. OFFICE, CONFERENCE ROOM |
| Vehicles | INT. CAR, PLANE, TRAIN |
| Battlefield/War Zones | EXT. WARZONE, COMBAT |
| Weather | Rain, Storm, Wind overlays |

### Selection Guidelines

**By Scene Header Keywords:**
```
"EXT." + "FOREST"      → Forest group
"EXT." + "BEACH"       → Beach & Ocean group
"EXT." + "CITY"        → City Streets group
"INT." + "HOSPITAL"    → Medical Facilities group
"INT." + "OFFICE"      → Office & Corporate group
"INT." + "CAR"         → Vehicles group
```

**Time of Day:**
```
"DAY"    → Standard versions, brighter ambience
"NIGHT"  → Night versions if available, quieter
"DAWN"   → Morning bird sounds, calm
"DUSK"   → Evening transitions
```

### Ambience Volume Standards

| Context | Volume (dB) |
|---------|-------------|
| Background bed | -24 to -20 |
| Featured environment | -18 to -15 |
| Weather overlay | -22 to -18 |

**Note:** Ambience should fade in over 5 seconds and out over 2 seconds by default.

## SFX Library

### Groups

| Group | Examples |
|-------|----------|
| Doors | Slam, creak, open, close, knock |
| Fighting | Punch, kick, body fall, struggle |
| Explosions | Distant, close, debris |
| Gunshots | Single, burst, reload |
| Vehicles | Car pass, crash, engine |
| Nature | Thunder, wind gust, water splash |
| UI/Foley | Footsteps, object handling |

### Trigger Detection

SFX are triggered by script analysis:

**Capitalized Words (Primary):**
```
"SLAMS"     → s_door_slam_*.wav
"CRASHES"   → s_crash_*.wav
"EXPLODES"  → s_explosion_*.wav
"GUNSHOT"   → s_gunshot_*.wav
"SCREAMS"   → (handled by TTS, not SFX)
```

**Action Line Patterns:**
```
"The door closes"           → s_door_close_*.wav
"He punches the wall"       → s_punch_*.wav
"Glass shatters"            → s_glass_break_*.wav
"Thunder rumbles"           → s_thunder_*.wav
```

### SFX Timing

**start_at Options:**
1. **Line ID:** `"start_at": "line_005"` - Plays when that line starts
2. **Timestamp:** `"start_at": 12.5` - Plays at absolute timestamp

**Duration:**
- Short SFX (impacts): No duration needed
- Sustained SFX: Specify duration in seconds
- Looping SFX: Use start_at and end_at

### SFX Volume Standards

| Type | Volume (dB) |
|------|-------------|
| Subtle (ambience-like) | -20 to -15 |
| Standard | -12 to -8 |
| Impactful | -6 to -3 |
| Featured | 0 to +3 |

## Voice Library (ElevenLabs)

### Categories

| Label | Count | Description |
|-------|-------|-------------|
| Older Male | 12+ | 50+ years, authoritative |
| Male - 40s to 50s | 8+ | Middle-aged male |
| Young Male | 6+ | Teens to 20s |
| Female - 20s to 30s | 10+ | Young adult female |
| Female - 40s+ | 6+ | Mature female |
| Child | 4+ | Pre-teen voices |

### Voice Attributes

| Attribute | Values |
|-----------|--------|
| Gender | Male, Female |
| Tone | Calm, Energetic, Serious, Warm |
| Style | American, British, Southern, African American, Indian |

### Voice Selection Rules

**Character Matching Priority:**
1. Gender match (required)
2. Age range match (strong preference)
3. Tone match (preference)
4. Ethnicity/accent match (if specified)

**Consistency Enforcement:**
- Once assigned, a character keeps the same voice
- Voice cannot be reassigned in subsequent scenes
- Validator rejects duplicate voice assignments to different characters

### Voice Metadata Location

```
Director/director_rag_agent/knowledge_bases/
├── eleven_labs_voices_current.json     # Full catalog
└── voice_embeddings_store/
    ├── voice_embeddings.npy            # 384-dim vectors
    ├── voices_metadata.json            # Indexed metadata
    └── config.json                     # Embedding config
```

## Embedding Configuration

All audio catalogs use semantic embeddings for intelligent selection.

### Common Settings

```json
{
  "model_name": "all-MiniLM-L6-v2",
  "embedding_dim": 384,
  "text_fields": ["group", "mood", "style", "tags"],
  "filter_fields": ["group", "style", "intensity", "loopable"]
}
```

### Embedding Locations

```
Director/director_rag_agent/knowledge_bases/
├── audio_embeddings_store/
│   ├── music/
│   │   ├── music_embeddings.npy
│   │   ├── music_metadata.json
│   │   └── music_config.json
│   ├── ambience/
│   │   └── ...
│   └── sfx/
│       └── ...
└── voice_embeddings_store/
    └── ...
```

## Adding New Assets

### Process

1. **Add audio file** to appropriate `catalog/` subdirectory
2. **Update catalog JSON** in `knowledge_bases/` with metadata
3. **Regenerate embeddings** (manual process currently)
4. **Test selection** with sample scenes

### Metadata Template

```json
{
  "file": "music/m_new_track_01.mp3",
  "id": "m_new_track_01",
  "title": "New Track 01",
  "group": "DRAMATIC",
  "style": "orchestral",
  "mood": ["dramatic", "emotional", "powerful"],
  "tags": ["cinematic", "orchestra", "strings"],
  "intensity": 75,
  "loopable": true
}
```

### File Requirements

| Format | Sample Rate | Bit Depth | Channels |
|--------|-------------|-----------|----------|
| MP3 | 44.1kHz | 16-bit | Stereo |
| WAV | 44.1kHz or 48kHz | 16/24-bit | Mono/Stereo |

## Known Gaps

### Music
- Limited action/thriller options
- Need more ethnic/world music styles
- Could use more subtle underscore tracks

### Ambience
- Missing specific environments (submarine, space station)
- Need more crowd size variations
- Weather overlay variety limited

### SFX
- Some categories sparse (sports, machinery)
- Need more subtle/quiet versions
- Vehicle variety could expand

### Voices
- Limited child/teen options
- Accents could be more diverse
- Need more elderly voices
