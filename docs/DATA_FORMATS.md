# Data Formats

## Director JSON Schema

The Director JSON is the primary data contract between the Director Agent and Orchestrator.

### Top-Level Structure

```typescript
interface DirectorJSON {
  project_id: string;           // Unique project identifier
  script_id?: string;           // Optional script reference
  scenes: Scene[];              // Ordered array of scenes
}
```

### Scene Object

```typescript
interface Scene {
  scene_id: string;             // "scene_001", "scene_002", etc.
  summary?: string;             // Brief scene description
  mood?: string;                // "tense", "romantic", "action-packed"
  intensity: number;            // 0.0 - 1.0 scale
  dialogue: DialogueLine[];     // Ordered dialogue/action lines
  music?: MusicCue[];           // Background music selections
  ambience?: AmbienceCue[];     // Environmental audio
  sfx?: SFXCue[];               // Sound effects
  mix?: MixSettings;            // Audio mixing parameters
}
```

### Dialogue Line

```typescript
interface DialogueLine {
  line_id: string;              // "line_001", "line_002", etc.
  character: string;            // Character name (use revealed name)
  text: string;                 // Dialogue or action description
  voice_key?: string;           // ElevenLabs voice ID
  character_age?: number;       // Approximate age
  character_gender?: string;    // "male", "female", "non-binary"
  character_ethnicity?: string; // For voice matching
  metadata?: object;            // Additional line metadata
}
```

### Audio Cue Objects

```typescript
interface MusicCue {
  file: string;                 // "music/m_orchestra_epic_01.mp3"
  volume?: number;              // dB, default -25
  start_at?: number;            // Timestamp in seconds
  end_at?: number;              // Timestamp in seconds
}

interface AmbienceCue {
  file: string;                 // "ambience/a_forest_calm_01.mp3"
  volume?: number;              // dB, default -20
  start_at?: number;
  end_at?: number;
}

interface SFXCue {
  file: string;                 // "sfx/s_door_slam_heavy_01.wav"
  start_at: string | number;    // Line ID ("line_005") or timestamp
  duration?: number;            // Seconds
  fade_out?: number;            // Fade duration in seconds
  volume?: number;              // dB, default -6
}
```

### Mix Settings

```typescript
interface MixSettings {
  target_lufs?: number;         // Default: -16 (EBU R128)
  true_peak_db?: number;        // Default: -1
}
```

## Example Director JSON

```json
{
  "project_id": "amnesia-ep1",
  "scenes": [
    {
      "scene_id": "scene_001",
      "summary": "Lucky and Medic in a tense battlefield moment",
      "mood": "tense",
      "intensity": 0.8,
      "dialogue": [
        {
          "line_id": "line_001",
          "character": "Medic",
          "text": "Hold still, soldier. We'll stop the bleeding.",
          "voice_key": "xZVrOjUURog02K298cjt",
          "character_gender": "male",
          "character_age": 35
        },
        {
          "line_id": "line_002",
          "character": "Lucky",
          "text": "Pipe down, Nelson. I've had worse paper cuts.",
          "voice_key": "iiidtqDt9FBdT1vfBluA",
          "character_gender": "male",
          "character_age": 28
        }
      ],
      "music": [
        {
          "file": "music/m_orchestra_tense_01.mp3",
          "volume": -25,
          "start_at": 0
        }
      ],
      "ambience": [
        {
          "file": "ambience/a_battlefield_distant_01.mp3",
          "volume": -20,
          "start_at": 0
        }
      ],
      "sfx": [
        {
          "file": "sfx/s_explosion_distant_01.wav",
          "start_at": "line_002",
          "volume": -12
        }
      ]
    }
  ]
}
```

## Alignment Schema

Output from Whisper alignment stage.

```typescript
interface Alignment {
  scene_id: string;
  lines: AlignedLine[];
}

interface AlignedLine {
  line_id: string;
  start: number;                // Seconds
  end: number;                  // Seconds
  words?: WordTiming[];         // Word-level timing
}

interface WordTiming {
  w: string;                    // Word text
  s: number;                    // Start time (seconds)
  e: number;                    // End time (seconds)
}
```

### Example Alignment

```json
{
  "scene_id": "scene_001",
  "lines": [
    {
      "line_id": "line_001",
      "start": 0.0,
      "end": 2.8,
      "words": [
        { "w": "Hold", "s": 0.0, "e": 0.3 },
        { "w": "still,", "s": 0.35, "e": 0.7 },
        { "w": "soldier.", "s": 0.75, "e": 1.2 },
        { "w": "We'll", "s": 1.4, "e": 1.6 },
        { "w": "stop", "s": 1.65, "e": 1.9 },
        { "w": "the", "s": 1.95, "e": 2.1 },
        { "w": "bleeding.", "s": 2.15, "e": 2.8 }
      ]
    }
  ]
}
```

## Timeline Schema

Event-based timeline for audio mixing.

```typescript
interface Timeline {
  scene_id: string;
  events: TimelineEvent[];
}

type TimelineEvent =
  | DialogueInEvent
  | DialogueOutEvent
  | MusicInEvent
  | MusicOutEvent
  | AmbienceInEvent
  | AmbienceOutEvent
  | SFXEvent;

interface DialogueInEvent {
  type: 'dialogue_in';
  line_id: string;
  at: number;                   // Timestamp
}

interface DialogueOutEvent {
  type: 'dialogue_out';
  line_id: string;
  at: number;
}

interface MusicInEvent {
  type: 'music_in';
  cue_id: string;
  at: number;
  fade: number;                 // Default: 1 second
  gain_db: number;              // Default: -25
  duck_db: number;              // Default: 7 (ducking during dialogue)
}

interface MusicOutEvent {
  type: 'music_out';
  cue_id: string;
  at: number;
  fade: number;                 // Default: 2 seconds
}

interface AmbienceInEvent {
  type: 'ambience_in';
  cue_id: string;
  at: number;
  fade: number;                 // Default: 5 seconds
  gain_db: number;              // Default: -20
}

interface AmbienceOutEvent {
  type: 'ambience_out';
  cue_id: string;
  at: number;
  fade: number;                 // Default: 2 seconds
}

interface SFXEvent {
  type: 'sfx_at';
  cue_id: string;
  at: number;
  gain_db: number;              // Default: -6
}
```

## Output Manifest Schema

Generated after successful processing.

```typescript
interface PlaybackManifest {
  project_id: string;
  scenes: SceneManifest[];
  total: number;                // Total duration in seconds
  public_url: string;           // Supabase Storage URL
  generated_at: string;         // ISO 8601 timestamp
  statistics: Statistics;
}

interface SceneManifest {
  scene_id: string;
  offset: number;               // Cumulative start time
  duration: number;             // Scene duration in seconds
  lines?: LineManifest[];
}

interface LineManifest {
  line_id: string;
  start: number;                // Absolute timestamp in episode
  duration: number;
}

interface Statistics {
  scene_count: number;
  dialogue_lines: number;
  ambience_cues: number;
  music_cues: number;
  sfx_cues: number;
}
```

### Example Manifest

```json
{
  "project_id": "amnesia-ep1",
  "scenes": [
    {
      "scene_id": "scene_001",
      "offset": 0,
      "duration": 45.2,
      "lines": [
        { "line_id": "line_001", "start": 0.0, "duration": 2.8 },
        { "line_id": "line_002", "start": 3.2, "duration": 2.1 }
      ]
    },
    {
      "scene_id": "scene_002",
      "offset": 43.7,
      "duration": 38.5
    }
  ],
  "total": 82.2,
  "public_url": "https://xxx.supabase.co/storage/v1/object/public/audio/amnesia-ep1/episode.m4a",
  "generated_at": "2026-01-15T10:30:00Z",
  "statistics": {
    "scene_count": 2,
    "dialogue_lines": 15,
    "ambience_cues": 2,
    "music_cues": 2,
    "sfx_cues": 5
  }
}
```

## Audio Catalog Schemas

### Music Catalog Entry

```typescript
interface MusicEntry {
  file: string;                 // "music/m_string_orchestra_uplifting_01.mp3"
  id: string;                   // "m_string_orchestra_uplifting_01"
  title: string;                // "String Orchestra Uplifting 01"
  group: string;                // "UPLIFTING", "DRAMATIC", "TENSE"
  style: string;                // "orchestral strings", "electronic"
  mood: string[];               // ["uplifting", "hopeful", "bright"]
  tags: string[];               // ["cinematic", "orchestra", "strings"]
  intensity: number;            // 0-100 scale
  loopable: boolean;
}
```

### Ambience Catalog Entry

```typescript
interface AmbienceEntry {
  file: string;                 // "ambience/a_forest_calm_01.mp3"
  id: string;
  title: string;
  group: string;                // "Forest", "Beach & Ocean", "City"
  style: string;
  mood: string[];
  tags: string[];
  intensity: number;
  loopable: boolean;
}
```

### SFX Catalog Entry

```typescript
interface SFXEntry {
  file: string;                 // "sfx/s_door_slam_heavy_01.wav"
  id: string;
  title: string;
  group: string;                // "Fighting", "Explosions", "Doors"
  style: string;
  tags: string[];
  intensity: number;
}
```

### Voice Catalog Entry

```typescript
interface VoiceEntry {
  voice_id: string;             // ElevenLabs voice ID
  label: string;                // "Older Male", "Female - 20s to 30s"
  gender: string;               // "Male", "Female"
  tone: string;                 // "Calm", "Energetic", "Serious"
  style: string;                // "American", "British", "Southern"
}
```

## Validation Rules

### Voice Consistency
- Each character must have exactly one `voice_key` across all scenes
- `voice_key` must exist in the voice catalog
- Gender/age should match character metadata when provided

### Audio File References
- All `file` references must exist in `catalog/` directory
- File paths are relative to `catalog/` root
- Supported formats: `.mp3`, `.wav`, `.m4a`

### Timing Constraints
- `start_at` must be non-negative
- `end_at` must be greater than `start_at` when both specified
- SFX `start_at` as line ID must reference existing `line_id`

### Intensity Scale
- Scene `intensity`: 0.0 - 1.0
- Catalog `intensity`: 0 - 100 (map: multiply by 100)

## File Naming Conventions

### Audio Files
```
m_[style]_[mood]_[variation].mp3     # Music
a_[location]_[mood]_[variation].mp3  # Ambience
s_[object]_[action]_[variation].wav  # SFX
```

### Examples
```
m_orchestra_epic_01.mp3
m_string_orchestra_uplifting_01.mp3
a_forest_calm_01.mp3
a_city_streets_busy_02.mp3
s_door_slam_heavy_01.wav
s_explosion_distant_02.wav
```
