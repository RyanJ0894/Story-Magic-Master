# Test Debt Analysis
**Date:** February 1, 2026

---

## Current Coverage

| Component | Test Files | Tests | Coverage | Grade |
|-----------|-----------|-------|----------|-------|
| Director (prototype) | 0 | 0 | 0% | F |
| Orchestrator (prototype) | 1 | ~5 | ~2% | F |
| Monorepo Orchestrator | 13 | ~50+ | ~24% | D |
| Monorepo Web | 14 | ~40+ | ~20% | D |
| **Total** | **28** | **~95** | **~18%** | **D** |

---

## What's Tested

### Monorepo Orchestrator (13 test files)
- `embedding-store.test.ts` — Vector store operations
- `hybrid-voice-search.test.ts` — Voice search with filters
- `ffmpeg-validator.test.ts` — FFmpeg filtergraph syntax
- `idempotency.test.ts` — Hash deduplication
- `retry.test.ts` — Exponential backoff logic
- `timeline-validator.test.ts` — Timeline overlap detection
- `align.test.ts` — Dialogue alignment
- `cues.test.ts` — Audio cue selection
- `mixer.test.ts` — Mixing configuration
- `director-json.test.ts` — Schema validation
- `health.test.ts` — Health endpoint

### Monorepo Web (14 test files)
- Vitest unit tests with MSW for API mocking
- Playwright E2E specs
- Component tests for UI elements

---

## What's NOT Tested (Critical Gaps)

### Pipeline Integration (Impact: Critical)
No test verifies the full pipeline:
```
Script Upload → Director Parse → Voice Assignment → TTS Generation
    → Whisper Alignment → Timeline Build → Audio Mix → Export
```
**Risk:** Pipeline regressions go undetected until production.

### LLM Determinism (Impact: Critical)
No test verifies:
- Same script → same Director JSON structure
- Voice assignments stable across runs
- Audio selection consistent for identical scenes
**Risk:** Non-deterministic outputs can't be debugged.

### Audio Quality (Impact: High)
No test verifies:
- Output loudness meets -16 LUFS target
- True peak doesn't exceed -1.5dB
- No audio clipping in mixed output
- Crossfade duration is correct (1.5s)
**Risk:** Audio quality regressions ship to customers.

### Long Script Handling (Impact: Critical)
No test for:
- Scripts exceeding context window
- Character consistency across chunks
- Memory behavior with large inputs
- State persistence across processing stages
**Risk:** Primary use case (90-120 pages) completely untested.

### Error Recovery (Impact: High)
No test for:
- ElevenLabs API failure mid-generation
- Supabase connection drop during save
- FFmpeg process crash during mixing
- Partial pipeline failure and resume
**Risk:** Production failures have unknown recovery behavior.

### Security (Impact: High)
No test for:
- Auth bypass attempts
- Rate limit enforcement
- Prompt injection payloads
- Path traversal on download endpoints
- CSRF token validation
**Risk:** Security regressions undetected.

### Payment Flow (Impact: High)
No test for:
- Stripe webhook processing
- Usage limit enforcement
- Subscription tier feature gating
- Failed payment handling
**Risk:** Revenue leakage or feature access bugs.

### Share Flow (Impact: High)
No test for:
- Share link creation and access
- Password-protected share validation
- Expiration handling
- Max plays enforcement
**Risk:** Core feature untested.

---

## Test Plan: Priority Order

### Phase 1: Critical Path (16h)
Tests that must exist before any production traffic.

```
tests/
├── e2e/
│   ├── full-pipeline.test.ts          # Upload → generate → download
│   ├── share-flow.test.ts             # Create share → access → play
│   └── auth-flow.test.ts              # Register → login → protected routes
├── integration/
│   ├── director-pipeline.test.ts      # Script → Director JSON
│   ├── orchestrator-pipeline.test.ts  # Director JSON → audio files
│   └── stripe-webhook.test.ts         # Payment event handling
└── security/
    ├── auth-bypass.test.ts            # Unauthenticated access attempts
    └── input-validation.test.ts       # Oversized inputs, injection
```

### Phase 2: Quality Gates (12h)
Tests for audio quality and determinism.

```
tests/
├── quality/
│   ├── loudness-validation.test.ts    # LUFS measurement on output
│   ├── clipping-detection.test.ts     # Peak analysis
│   └── crossfade-timing.test.ts       # Verify 1.5s transitions
├── determinism/
│   ├── director-stability.test.ts     # Same input → same structure
│   └── voice-consistency.test.ts      # Character voices stable
└── fixtures/
    ├── sample-3page.txt               # Short test script
    ├── sample-15page.txt              # MVP max length
    └── expected-director.json         # Golden file comparison
```

### Phase 3: Robustness (12h)
Tests for failure modes and edge cases.

```
tests/
├── resilience/
│   ├── tts-failure.test.ts            # ElevenLabs error handling
│   ├── supabase-failure.test.ts       # DB connection drops
│   ├── ffmpeg-crash.test.ts           # Process failure recovery
│   └── partial-pipeline.test.ts       # Resume from checkpoint
├── edge-cases/
│   ├── empty-script.test.ts           # Zero scenes
│   ├── single-character.test.ts       # One voice only
│   ├── no-dialogue.test.ts            # Action-only scenes
│   └── unicode-script.test.ts         # Non-ASCII characters
└── performance/
    ├── concurrent-generation.test.ts  # 10 parallel requests
    └── large-script.test.ts           # 120-page processing
```

### Phase 4: Coverage Expansion (16h)
Fill remaining gaps for enterprise readiness.

```
tests/
├── payment/
│   ├── usage-limits.test.ts           # Feature gating by tier
│   ├── subscription-lifecycle.test.ts # Create → upgrade → cancel
│   └── webhook-retry.test.ts          # Idempotent webhook handling
├── features/
│   ├── voice-override.test.ts         # Manual voice selection
│   ├── audio-override.test.ts         # Custom music/SFX
│   ├── storyscore.test.ts             # Analysis pipeline
│   └── revision-tracking.test.ts      # Version management
└── components/
    ├── script-editor.test.tsx         # Editor functionality
    ├── audio-player.test.tsx          # Playback controls
    └── dashboard.test.tsx             # Project list operations
```

---

## Testing Infrastructure Needed

| Tool | Purpose | Status |
|------|---------|--------|
| Vitest | Unit tests (orchestrator + web) | Installed |
| Playwright | E2E browser tests | Installed |
| MSW | API mocking for web tests | Installed |
| ffprobe | Audio quality measurement | Available (ffprobe-static) |
| Golden files | Determinism comparison | Need to create |
| CI pipeline | Automated test runs | GitHub Actions (partial) |

---

## Target Coverage

| Phase | Coverage | Timeline |
|-------|----------|----------|
| Current | ~18% | — |
| Phase 1 | ~40% | Week 1 |
| Phase 2 | ~55% | Week 2 |
| Phase 3 | ~70% | Week 3 |
| Phase 4 | ~80% | Week 4 |
