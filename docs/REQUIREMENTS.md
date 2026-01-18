# Requirements

> Feature requirements and technical specifications for Story Magic

## Functional Requirements

### FR-1: Script Parsing

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-1.1 | Parse PDF and plain text scripts | P1 | Complete |
| FR-1.2 | Extract scene headers (INT/EXT, location, time) | P1 | Complete |
| FR-1.3 | Extract dialogue with character attribution | P1 | Complete |
| FR-1.4 | Extract action/description lines | P1 | Complete |
| FR-1.5 | Handle character reveals (unknown → named) | P1 | Complete |
| FR-1.6 | Remove parentheticals from dialogue | P1 | Complete |
| FR-1.7 | Expand abbreviations (INT., V.O., etc.) | P1 | Complete |
| FR-1.8 | Support scripts up to 120 pages | P1 | In Progress |
| FR-1.9 | Preserve original dialogue text exactly | P1 | Complete |
| FR-1.10 | Generate unique scene IDs | P1 | Complete |

### FR-2: Voice Selection

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-2.1 | Semantic search across 100+ voice profiles | P1 | Complete |
| FR-2.2 | Filter by gender (Male/Female) | P1 | Complete |
| FR-2.3 | Filter by age label (Teen, 20s-30s, Older) | P1 | Complete |
| FR-2.4 | Filter by ethnicity/style (American, African American, British, etc.) | P1 | Complete |
| FR-2.5 | Ensure voice uniqueness per character | P1 | Complete |
| FR-2.6 | Match teen characters to teen voices | P1 | Complete |
| FR-2.7 | Match ethnicity to appropriate style | P1 | Complete |
| FR-2.8 | Consistent voice across all character appearances | P1 | Complete |
| FR-2.9 | Manual voice override option | P2 | Pending |
| FR-2.10 | Voice preview before generation | P2 | Pending |

### FR-3: Audio Selection

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-3.1 | Select music based on scene mood | P1 | Complete |
| FR-3.2 | Select ambience based on location | P1 | Complete |
| FR-3.3 | Identify SFX from capitalized actions | P1 | Complete |
| FR-3.4 | Mandatory ambience for key locations | P1 | Complete |
| FR-3.5 | Limit 0-3 SFX per scene | P1 | Complete |
| FR-3.6 | Knowledge base pattern matching | P1 | Complete |
| FR-3.7 | Manual music override option | P2 | Pending |
| FR-3.8 | Manual SFX timing adjustment | P2 | Pending |
| FR-3.9 | Custom audio asset upload | P3 | Pending |

### FR-4: Audio Generation

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-4.1 | Generate TTS using ElevenLabs API | P1 | Complete |
| FR-4.2 | Cache TTS stems by content hash | P1 | Complete |
| FR-4.3 | Parallel TTS generation (4 concurrent) | P1 | Complete |
| FR-4.4 | Word-level timing via Whisper | P1 | Complete |
| FR-4.5 | Context-aware gap computation | P1 | Complete |
| FR-4.6 | Build event timeline from alignment | P1 | Complete |
| FR-4.7 | Validate timeline for conflicts | P1 | Complete |
| FR-4.8 | Auto-fix timeline issues | P1 | Complete |

### FR-5: Audio Mixing

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-5.1 | Mix dialogue with music and ambience | P1 | Complete |
| FR-5.2 | Adaptive ducking during dialogue | P1 | Complete |
| FR-5.3 | EBU R128 loudness normalization (-16 LUFS) | P1 | Complete |
| FR-5.4 | True peak limiting (-1.5 dB) | P1 | Complete |
| FR-5.5 | Loop music/ambience to scene length | P1 | Complete |
| FR-5.6 | SFX timing at specific timestamps | P1 | Complete |
| FR-5.7 | Equal-power crossfades between scenes | P1 | Complete |
| FR-5.8 | Film-standard gain staging | P1 | Complete |

### FR-6: Output & Export

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-6.1 | Export to M4A (AAC codec) | P1 | Complete |
| FR-6.2 | Generate playback manifest | P1 | Complete |
| FR-6.3 | Upload to Supabase Storage | P1 | Complete |
| FR-6.4 | Generate public download URLs | P1 | Complete |
| FR-6.5 | Scene-by-scene audio files | P1 | Complete |
| FR-6.6 | Full episode concatenation | P1 | Complete |
| FR-6.7 | Line-level timing in manifest | P1 | Complete |
| FR-6.8 | Export to MP3 format | P2 | Pending |
| FR-6.9 | Export to WAV format | P2 | Pending |

---

## Non-Functional Requirements

### NFR-1: Performance

| ID | Requirement | Target | Status |
|----|-------------|--------|--------|
| NFR-1.1 | API response time (p95) | <2s | TBD |
| NFR-1.2 | Audio generation per scene | <30s | TBD |
| NFR-1.3 | Full pipeline for 10-scene script | <5min | TBD |
| NFR-1.4 | Concurrent project processing | 10+ | TBD |
| NFR-1.5 | Memory usage per request | <2GB | TBD |

### NFR-2: Reliability

| ID | Requirement | Target | Status |
|----|-------------|--------|--------|
| NFR-2.1 | Service uptime | 99.9% | TBD |
| NFR-2.2 | LLM call success rate | >95% | TBD |
| NFR-2.3 | TTS generation success rate | >99% | TBD |
| NFR-2.4 | Validation pass rate (first attempt) | >85% | TBD |
| NFR-2.5 | Validation pass rate (after auto-fix) | >98% | TBD |

### NFR-3: Scalability

| ID | Requirement | Target | Status |
|----|-------------|--------|--------|
| NFR-3.1 | Concurrent users | 100+ | TBD |
| NFR-3.2 | Scripts processed per day | 1000+ | TBD |
| NFR-3.3 | Audio storage capacity | 10TB+ | TBD |
| NFR-3.4 | Horizontal scaling | Auto | Pending |

### NFR-4: Security

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| NFR-4.1 | API key authentication | P1 | Complete |
| NFR-4.2 | TLS for all connections | P1 | Complete |
| NFR-4.3 | Input validation (Zod) | P1 | Complete |
| NFR-4.4 | Rate limiting | P1 | Pending |
| NFR-4.5 | No PII in logs | P1 | Complete |
| NFR-4.6 | Encrypted storage | P2 | Pending |
| NFR-4.7 | SOC 2 Type II | P3 | Pending |
| NFR-4.8 | TPN/MPAA compliance | P3 | Pending |

### NFR-5: Maintainability

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| NFR-5.1 | TypeScript strict mode | P1 | Complete |
| NFR-5.2 | Zod schema validation | P1 | Complete |
| NFR-5.3 | Comprehensive logging | P1 | Complete |
| NFR-5.4 | Error tracking (Sentry) | P2 | Pending |
| NFR-5.5 | Unit test coverage >80% | P2 | Pending |
| NFR-5.6 | API documentation | P2 | In Progress |

---

## Validation Requirements

### VR-1: Director Output Validation

| ID | Rule | Auto-Fix | Status |
|----|------|----------|--------|
| VR-1.1 | Voice keys must be unique per character | Yes | Complete |
| VR-1.2 | Teen characters (17-19) must have Teen voice label | Yes | Complete |
| VR-1.3 | African American characters must have matching style | Yes | Complete |
| VR-1.4 | All dialogue lines must have voice_key | Yes | Complete |
| VR-1.5 | Scene IDs must be unique | Yes | Complete |
| VR-1.6 | Line IDs must be unique within scene | Yes | Complete |
| VR-1.7 | Character names must be consistent | Yes | Complete |

### VR-2: Audio Selection Validation

| ID | Rule | Auto-Fix | Status |
|----|------|----------|--------|
| VR-2.1 | Ambience must match scene location type | Yes | Complete |
| VR-2.2 | SFX start_at must reference valid line_id | Yes | Complete |
| VR-2.3 | Music file must exist in catalog | Yes | Complete |
| VR-2.4 | Ambience file must exist in catalog | Yes | Complete |
| VR-2.5 | SFX file must exist in catalog | Yes | Complete |
| VR-2.6 | Max 3 SFX per scene | Yes | Complete |

### VR-3: Timeline Validation

| ID | Rule | Auto-Fix | Status |
|----|------|----------|--------|
| VR-3.1 | No overlapping music tracks | No | Complete |
| VR-3.2 | No orphaned _out events | Yes | Complete |
| VR-3.3 | Events in chronological order | Yes | Complete |
| VR-3.4 | Sufficient dialogue ducking (>3dB) | Warning | Complete |
| VR-3.5 | No circular dependencies | No | Complete |

---

## Audio Catalog Requirements

### Music Catalog (40 tracks)

| Category | Count | Examples |
|----------|-------|----------|
| Orchestral | 12 | strings_orchestra_tense, strings_orchestra_sad |
| Piano | 8 | piano_slow_sad, piano_uplifting |
| Electronic | 6 | synth_ambient, synth_dramatic |
| Acoustic | 8 | acoustic_guitar_warm, acoustic_hopeful |
| Percussion | 6 | drums_action, drums_suspense |

### Ambience Catalog (37 tracks)

| Category | Count | Examples |
|----------|-------|----------|
| Nature | 12 | forest_birds, ocean_waves, rain_light |
| Urban | 10 | city_traffic, cafe_busy, street_night |
| Interior | 10 | office_quiet, hospital_hallway, school_hallway |
| Weather | 5 | wind_strong, thunder_distant, rain_heavy |

### SFX Catalog (53 tracks)

| Category | Count | Examples |
|----------|-------|----------|
| Doors | 8 | door_slam, door_creak, door_knock |
| Impact | 10 | punch, crash, glass_break |
| Vehicle | 8 | car_start, car_skid, car_horn |
| Nature | 7 | water_splash, thunder_crack, wind_gust |
| Human | 10 | scream, gasp, footsteps_running |
| Misc | 10 | phone_ring, gunshot, explosion |

---

## API Requirements

### Endpoints

| Endpoint | Method | Auth | Rate Limit |
|----------|--------|------|------------|
| /health | GET | None | 100/min |
| /generate-scenes | POST | API Key | 10/min |
| /orchestrate | POST | API Key | 5/min |
| /download/:id/:file | GET | API Key | 50/min |

### Request/Response Formats

All endpoints accept and return JSON with the following headers:
- `Content-Type: application/json`
- `Authorization: Bearer <api_key>`

### Error Codes

| Code | Meaning | Retry |
|------|---------|-------|
| 400 | Bad Request (validation error) | No |
| 401 | Unauthorized | No |
| 429 | Rate Limited | Yes (after delay) |
| 500 | Internal Server Error | Yes (3 attempts) |
| 503 | Service Unavailable | Yes (with backoff) |

---

## Environment Requirements

### Production Environment

| Resource | Specification |
|----------|---------------|
| Node.js | 20 LTS |
| Memory | 4GB minimum |
| CPU | 2 vCPU minimum |
| Storage | 100GB SSD |
| Network | 100 Mbps |

### External Dependencies

| Service | Required | Fallback |
|---------|----------|----------|
| OpenAI API | Yes | Groq, Anthropic |
| ElevenLabs API | Yes | None |
| Whisper | Optional | Duration-based alignment |
| Supabase | Yes | Local PostgreSQL |
| FFmpeg | Yes (bundled) | None |

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...

# Optional
GROQ_API_KEY=gsk_...
ANTHROPIC_API_KEY=sk-ant-...
WHISPER_CPP_PATH=/path/to/whisper
WHISPER_MODEL_PATH=/path/to/model.bin
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Configuration
PORT=22002
NODE_ENV=production
LOG_LEVEL=info
```

---

## Acceptance Criteria

### Phase 8 Completion

- [ ] All workers compile with TypeScript strict mode
- [ ] No `any` types in public interfaces
- [ ] Existing functionality preserved (regression tests pass)
- [ ] API responses unchanged (backward compatible)
- [ ] Performance within 10% of JavaScript baseline

### Phase 9 Completion

- [ ] Legacy JavaScript files removed
- [ ] Python Director package removed
- [ ] Single docker-compose service
- [ ] All documentation updated
- [ ] Migration guide complete

### MVP Launch

- [ ] 100 beta users onboarded
- [ ] <1% error rate in production
- [ ] <30s average generation time
- [ ] Payment processing functional
- [ ] Support channel operational
