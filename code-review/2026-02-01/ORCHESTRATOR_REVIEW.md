# Orchestrator Code Review
**Date:** February 1, 2026
**Location:** `/Orchestrator/` (Node.js/Express prototype)
**LOC:** 4,281 across 21 source files + 131 audio assets
**Status:** Prototype — partially superseded by `story-magic/packages/orchestrator/`

---

## File Inventory

| File | Lines | Purpose |
|------|-------|---------|
| `server.js` | 103 | Express server with /orchestrate and /health |
| `workers/orchestrator.js` | 370 | Pipeline orchestrator (TTS→align→cues→timeline→mixer→export) |
| `workers/mixer.js` | 1,048 | Professional audio mixing engine (EBU R128) |
| `workers/mix.js` | 831 | Legacy mixer (95% commented-out code) |
| `workers/tts.js` | 77 | ElevenLabs TTS with caching |
| `workers/whisper-align.js` | 265 | Whisper ASR for word-level timing |
| `workers/align.js` | 111 | Scene dialogue alignment with pacing |
| `workers/timeline.js` | 174 | Timeline event builder |
| `workers/timeline-validator.js` | 188 | Overlap detection and auto-fix |
| `workers/cues.js` | 42 | Audio cue selection |
| `workers/export.js` | 174 | Scene concatenation with crossfades |
| `lib/mixer.js` | 117 | RMS envelope analysis (legacy) |
| `lib/audio.js` | 108 | Audio utilities |
| `lib/catalog-loader.js` | 95 | Audio library loader |
| `lib/zod-schemas.js` | 141 | Schema validation |
| `lib/ffmpeg-validator.js` | 133 | FFmpeg filtergraph validation |
| `lib/db.js` | 81 | Supabase voice mapping |
| `lib/storage.js` | 66 | Stem caching |
| `lib/retry.js` | 77 | Exponential backoff with jitter |
| `lib/idempotency.js` | 15 | Hash-based deduplication |
| `tests/test-orchestrator.js` | 65 | Minimal schema/env tests |

---

## Pipeline Architecture

```
Director JSON → [1] TTS (ElevenLabs, p-limit 3)
             → [2] Whisper Alignment (word-level timing)
             → [3] Cue Selection (from Director JSON)
             → [4] Timeline Builder (events + validation)
             → [5] Professional Mixer (EBU R128, ducking, EQ)
             → [6] Export (crossfade concatenation + manifest)
```

---

## Audio Processing: 9/10

The mixer is the crown jewel of this codebase. Professional-grade audio processing:

- **EBU R128 loudness normalization** (-16 LUFS target, two-pass analysis)
- **Film-standard gain staging** (dialogue 0dB, music -22dB, ambience -26dB)
- **Adaptive ducking** with RMS envelope analysis (50ms hop, 150ms lookahead)
- **Multi-band EQ separation** (dialogue frequencies cut from backgrounds)
- **Sidechain compression** (threshold 0.04, ratio 3, attack 120ms)
- **True peak limiting** at -1.5dB
- **Equal-power crossfades** (1.5s between scenes)
- **Output:** M4A (AAC, 48kHz, 192kbps)

---

## Code Quality: 6/10

### Strengths
- Robust retry logic with exponential backoff and jitter
- Zod schema validation at boundaries
- FFmpeg filtergraph syntax validation
- Stem caching prevents duplicate TTS calls
- Timeline auto-fix for orphaned events

### Weaknesses

| Issue | Severity | Detail |
|-------|----------|--------|
| Triple mixer implementation | High | `workers/mixer.js`, `workers/mix.js`, `lib/mixer.js` — unclear which is active |
| 831 lines of commented code | High | `workers/mix.js` is 95% comments from old attempts |
| Inconsistent state types | Medium | SFX timing mixes `line_id` strings with numeric timestamps |
| Console.log with emojis | Medium | Not parseable by log aggregators |
| Conflicting gain values | Medium | mixer.js:732 says -4dB, later uses -22dB |
| No structured logging | Medium | All `console.log`, no levels (error/warn/info) |
| Hardcoded defaults | Medium | 10+ values scattered across files |

---

## External Integrations

### ElevenLabs TTS: Good
- Proper API key validation
- Retryable (429, 5xx) vs fatal error distinction
- Output: mp3_44100_128, transcoded to WAV
- Parallel limit: 3 concurrent calls

### Whisper Alignment: Good (with caveats)
- Supports whisper.cpp (local) and OpenAI API (cloud)
- Fallback chain: whisper.cpp → OpenAI → duration-based
- Word-level timing with Levenshtein matching
- JSON parsing is version-dependent (fragile)

### Supabase: Fair
- Voice mapping, stem storage, alignment, timeline, manifest
- Falls back to local JSON for voice_map
- No connection pooling or health checks
- Upload failures silently continue

---

## Security: 2/10

| Issue | Severity |
|-------|----------|
| No endpoint authentication | Critical |
| Path traversal on /download/:project_id/:filename | Critical |
| No input validation on /orchestrate | Critical |
| Wildcard CORS | High |
| No rate limiting | High |
| 50MB JSON body limit | Medium |
| Sensitive data in console output | Medium |

---

## Testing: 1/10

Single test file (65 lines) covering only schema validation and env var presence. No pipeline tests, no error path tests, no audio quality tests.

---

## Performance Estimates (per 5-minute script)

| Operation | Time |
|-----------|------|
| TTS (per line) | 2-5s |
| Whisper alignment | 10-30s |
| Mixing (per scene) | 30-120s |
| Concatenation | 10-20s |
| **Total** | **8-15 min** |

Sequential processing only — no cross-scene parallelization.

---

## Audio Catalog

131 files organized by type:
- **Music:** 40 tracks (`m_*.mp3`)
- **Ambience:** 37 tracks (`amb_*.mp3`)
- **SFX:** 53 effects (`sfx_*.mp3`)

**Issues:**
- No metadata (duration, tags, genre, BPM, key)
- No search/filtering (loads all into arrays)
- No versioning or update mechanism
- All loaded on startup (O(n) scan)

---

## Technical Debt Summary

| ID | Issue | Severity | Effort |
|----|-------|----------|--------|
| ORC-01 | Triple mixer implementation (consolidate) | High | 4h |
| ORC-02 | 831 lines of commented code in mix.js | High | 1h |
| ORC-03 | No authentication on endpoints | Critical | 4h |
| ORC-04 | Path traversal on /download | Critical | 2h |
| ORC-05 | No input validation | High | 4h |
| ORC-06 | Console.log needs structured logging | Medium | 4h |
| ORC-07 | Hardcoded config values | Medium | 3h |
| ORC-08 | SFX timing type inconsistency | Medium | 2h |
| ORC-09 | Conflicting gain values | Medium | 1h |
| ORC-10 | Audio catalog has no metadata | Low | 8h |

---

## Recommendation

**Superseded by `story-magic/packages/orchestrator/`.** The consolidated TypeScript version has proper auth, rate limiting, structured logging, and TypeScript type safety.

**Action:** Deprecate standalone `Orchestrator/`. Keep audio catalog assets (they're used by both). Clean up `mix.js` dead code.
