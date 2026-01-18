# API Reference

> Complete API documentation for Story Magic

## Base URL

| Environment | URL |
|-------------|-----|
| Development | `http://localhost:22002` |
| Production | `https://api.storymagic.ai` |

## Authentication

All API requests (except health check) require authentication via API key.

```bash
Authorization: Bearer <api_key>
```

## Endpoints

### Health Check

Check service status and version.

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "story-magic-orchestrator",
  "version": "1.0.0",
  "timestamp": "2026-01-18T12:00:00.000Z",
  "models": {
    "director": "openai/gpt-4.1",
    "audio_director": "openai/gpt-4.1"
  }
}
```

---

### Generate Scenes

Parse a script and generate Director JSON with voice assignments and audio selections.

```http
POST /generate-scenes
Content-Type: application/json
Authorization: Bearer <api_key>
```

**Request Body:**
```json
{
  "project_id": "string (required)",
  "script_text": "string (required)"
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| project_id | string | Yes | Unique project identifier (UUID) |
| script_text | string | Yes | Full screenplay text (max 500KB) |

**Response:**
```json
{
  "project_id": "uuid",
  "success": true,
  "scene_count": 5,
  "processing_time_ms": 15000,
  "director_json": {
    "project_id": "uuid",
    "scenes": [
      {
        "scene_id": "scene_001",
        "header": "INT. COFFEE SHOP - DAY",
        "mood": "casual",
        "intensity": 0.4,
        "dialogue": [
          {
            "line_id": "line_001",
            "character": "SARAH",
            "text": "I can't believe you said that.",
            "voice_key": "voice_abc123",
            "metadata": {
              "age": 28,
              "gender": "female"
            }
          }
        ],
        "music": [
          {
            "file": "music/m_acoustic_warm_01.mp3",
            "reasoning": "Casual cafe scene with light conversation"
          }
        ],
        "ambience": [
          {
            "file": "ambience/a_cafe_busy_01.mp3",
            "reasoning": "Interior coffee shop environment"
          }
        ]
      }
    ]
  },
  "validation_report": {
    "director_validation": {
      "valid": true,
      "errors": [],
      "warnings": [],
      "auto_corrections": []
    },
    "audio_validation": {
      "valid": true,
      "errors": [],
      "warnings": []
    }
  }
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Invalid request body |
| 401 | UNAUTHORIZED | Missing or invalid API key |
| 413 | PAYLOAD_TOO_LARGE | Script exceeds 500KB |
| 429 | RATE_LIMITED | Too many requests |
| 500 | INTERNAL_ERROR | Server error |

---

### Orchestrate

Generate audio from Director JSON or script text.

```http
POST /orchestrate
Content-Type: application/json
Authorization: Bearer <api_key>
```

**Request Body (with existing Director JSON):**
```json
{
  "project_id": "string (required)",
  "scenes": "Scene[] (required)"
}
```

**Request Body (with script text - runs Director first):**
```json
{
  "project_id": "string (required)",
  "script_text": "string (required)"
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| project_id | string | Yes | Unique project identifier |
| scenes | Scene[] | Conditional | Director JSON scenes array |
| script_text | string | Conditional | Script text (if no scenes provided) |

**Response:**
```json
{
  "status": "success",
  "project_id": "uuid",
  "processing_time_ms": 120000,
  "audio_urls": {
    "episode": "https://storage.supabase.co/audio/uuid/episode.m4a",
    "scenes": {
      "scene_001": "https://storage.supabase.co/audio/uuid/scenes/scene_001.m4a",
      "scene_002": "https://storage.supabase.co/audio/uuid/scenes/scene_002.m4a"
    }
  },
  "playback_manifest": {
    "project_id": "uuid",
    "total": 180.5,
    "public_url": "https://storage.supabase.co/audio/uuid/episode.m4a",
    "order": [
      {
        "scene_id": "scene_001",
        "offset": 0,
        "duration": 45.2,
        "lines": [
          {
            "line_id": "line_001",
            "start": 0,
            "duration": 2.5
          }
        ]
      },
      {
        "scene_id": "scene_002",
        "offset": 43.7,
        "duration": 52.3
      }
    ]
  }
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Invalid request body or scenes |
| 401 | UNAUTHORIZED | Missing or invalid API key |
| 429 | RATE_LIMITED | Too many requests |
| 500 | INTERNAL_ERROR | Server error |
| 503 | SERVICE_UNAVAILABLE | External service unavailable |

---

### Download File

Download generated audio files.

```http
GET /download/:project_id/:filename
Authorization: Bearer <api_key>
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| project_id | string | Project identifier |
| filename | string | File name (e.g., `episode.m4a`, `scene_001.m4a`) |

**Response:**
- Content-Type: `audio/mp4` or `audio/wav`
- Content-Disposition: `attachment; filename="<filename>"`

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 401 | UNAUTHORIZED | Missing or invalid API key |
| 404 | NOT_FOUND | File not found |

---

## Data Types

### Scene

```typescript
interface Scene {
  scene_id: string;           // "scene_001"
  header?: string;            // "INT. COFFEE SHOP - DAY"
  mood?: string;              // "tense", "romantic", "action"
  intensity?: number;         // 0.0 - 1.0
  dialogue: DialogueLine[];
  music?: AudioCue[];
  ambience?: AudioCue[];
  sfx?: AudioCue[];
}
```

### DialogueLine

```typescript
interface DialogueLine {
  line_id: string;            // "line_001"
  character: string;          // "SARAH"
  text: string;               // Dialogue or action text
  voice_key: string;          // ElevenLabs voice ID
  metadata?: {
    age?: number;
    gender?: string;
    ethnicity?: string;
  };
}
```

### AudioCue

```typescript
interface AudioCue {
  file: string;               // "music/m_acoustic_01.mp3"
  reasoning?: string;         // Why this was selected
  start_at?: string | number; // Line ID or timestamp
  end_at?: number;            // End timestamp
  duration?: number;          // Duration in seconds
  volume?: number;            // Volume in dB
  fade_out?: number;          // Fade out duration
}
```

### ValidationReport

```typescript
interface ValidationReport {
  director_validation: {
    valid: boolean;
    errors: ValidationError[];
    warnings: string[];
    auto_corrections: AutoCorrection[];
  };
  audio_validation: {
    valid: boolean;
    errors: ValidationError[];
    warnings: string[];
  };
}
```

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| /health | 100 | 1 minute |
| /generate-scenes | 10 | 1 minute |
| /orchestrate | 5 | 1 minute |
| /download/* | 50 | 1 minute |

Rate limit headers are included in all responses:

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1642000000
```

---

## Error Handling

All errors follow this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable error message",
    "details": {
      "field": "scenes[0].dialogue[0].voice_key",
      "reason": "Voice key not found in catalog"
    }
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Request validation failed |
| UNAUTHORIZED | 401 | Invalid or missing API key |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| RATE_LIMITED | 429 | Rate limit exceeded |
| INTERNAL_ERROR | 500 | Server error |
| SERVICE_UNAVAILABLE | 503 | External service down |

---

## Webhooks (Future)

Webhook support for async processing notifications is planned for a future release.

```json
{
  "event": "orchestration.complete",
  "project_id": "uuid",
  "status": "success",
  "audio_urls": {...},
  "timestamp": "2026-01-18T12:00:00.000Z"
}
```

---

## SDK Examples

### Node.js

```typescript
const response = await fetch('https://api.storymagic.ai/generate-scenes', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  },
  body: JSON.stringify({
    project_id: 'my-project-001',
    script_text: scriptContent,
  }),
});

const result = await response.json();
console.log(`Generated ${result.scene_count} scenes`);
```

### Python

```python
import requests

response = requests.post(
    'https://api.storymagic.ai/generate-scenes',
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {API_KEY}',
    },
    json={
        'project_id': 'my-project-001',
        'script_text': script_content,
    }
)

result = response.json()
print(f"Generated {result['scene_count']} scenes")
```

### cURL

```bash
curl -X POST https://api.storymagic.ai/generate-scenes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "project_id": "my-project-001",
    "script_text": "FADE IN:\n\nINT. COFFEE SHOP - DAY\n\n..."
  }'
```
