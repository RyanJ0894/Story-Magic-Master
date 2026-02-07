# Director Agent Code Review
**Date:** February 1, 2026
**Location:** `/Director/` (Python/FastAPI prototype)
**LOC:** 7,196 across 16 files
**Status:** Prototype — partially superseded by `story-magic/packages/orchestrator/src/director/`

---

## File Inventory

| File | Lines | Purpose |
|------|-------|---------|
| `main.py` | 500 | FastAPI server, endpoint handlers, pipeline orchestration |
| `agent.py` | 1,350 | DirectorAgent, AudioDirectorAgent, SequentialAgent |
| `validators.py` | 863 | Two-stage validation with auto-correction |
| `tools/voice_search.py` | 570 | Semantic voice search (384-dim all-MiniLM-L6-v2) |
| `tools/audio_search.py` | 811 | Music/ambience/SFX search with filters |
| `tools/audio_search_tool.py` | 244 | Wrapper for audio search |
| `tools/voice_search_tool.py` | 173 | Wrapper for voice search |
| `tools/supabase_tool.py` | 212 | Async HTTP calls to Supabase |
| `tools/search_tools.py` | 1,007 | Legacy search implementations (likely unused) |
| `tools/file_upload_handler.py` | 297 | File upload handling |
| `audio_director_agent.py` | 620 | Standalone AudioDirectorAgent module |
| `orchestrator.py` | 57 | Minimal Google ADK stub (unused) |
| `setup_file_stores.py` | 302 | Embedding initialization |
| `file_search_tool.py` | 166 | File search utilities |
| `requirements.txt` | 4 | Dependencies (critically incomplete) |

---

## Architecture

```
Script (PDF) → FastAPI /generate-scenes
    ↓
DirectorAgent (Phase 1)
    ├── Parses script with character reveals
    ├── search_voices() for voice assignments
    └── Outputs Director JSON
    ↓
AudioDirectorAgent (Phase 2)
    ├── Analyzes Director JSON
    ├── search_music(), search_ambience(), search_sfx()
    └── Outputs Scene Audio JSON
    ↓
Validation (Two-stage)
    ├── DirectorJSONValidator (voice consistency, auto-correct)
    └── SceneAudioValidator (audio rules, auto-correct)
    ↓
Save to Supabase → Return Response
```

**Key innovation:** Two-stage validation with auto-correction prevents pipeline failure from LLM drift.

---

## LLM Integration Analysis

### Prompt Engineering: 9/10
- DIRECTOR_SYSTEM_PROMPT is 549 lines of detailed instructions
- Character reveal handling, voice uniqueness, parenthetical removal
- Detailed examples and checklists of common mistakes
- Audio director includes knowledge base injection

### Token Management: 3/10 (Critical)
- **No script chunking**: 120 pages = ~60,000 tokens, exceeds most context windows
- `max_completion_tokens: 16384` hardcoded with no input budget accounting
- Tool calls add tokens not tracked in budget
- No streaming for long outputs

### Determinism: 5/10
- Temperature 1.0 on Director (maximum randomness)
- Temperature 0.7 on AudioDirector (inconsistent)
- Voice selection explicitly randomized (hurts reproducibility)
- No seed setting, no constraint enforcement
- Same script will produce different outputs on re-runs

### Model Configuration: 7/10
- Uses LiteLLM for provider abstraction (good)
- Default model `openai/gpt-4.1` (may be typo for gpt-4-turbo or gpt-4o)
- Environment variable overrides available
- No model fallback chain, no startup validation

---

## Code Quality: 7/10

### Strengths
- Type hints on ~95% of functions
- Comprehensive docstrings
- Proper async/await implementation
- Structured error handling with try/except

### Weaknesses
- **Code duplication (6/10):** voice_search.py duplicated in voice_search_tool.py; audio_search.py duplicated in audio_search_tool.py; agent.py tools redefined in audio_director_agent.py
- **Magic numbers scattered:** Temperature, max_iterations, max_retries, embedding dimensions all hardcoded
- **Generic exception catches:** Lines 268, 294, 466 catch all exceptions
- **No timeout on LLM calls:** completion() can hang indefinitely

---

## Security: 1/10 (Critical)

| Issue | Severity | Detail |
|-------|----------|--------|
| No authentication | Critical | All endpoints open to world |
| Wildcard CORS + credentials | Critical | `allow_origins=["*"]` with `allow_credentials=True` |
| No rate limiting | Critical | Unlimited requests accepted |
| Path traversal | High | `file_upload_handler.py` doesn't sanitize filenames |
| SSRF risk | High | Supabase callback URL unvalidated |
| API keys in logs | Medium | Environment variables logged in error context |
| No input size limits | Medium | Script text can be unlimited (DoS vector) |

---

## Testing: 0/10

**Zero test files exist.** No unit tests, integration tests, mock LLM tests, or regression tests.

---

## Dependencies (Critical Gap)

**requirements.txt lists only 4 packages:**
```
google-adk==1.18.0    # Appears unused
litellm==1.80.7
nest_asyncio==1.6.0
sentence_transformers==5.1.2
```

**Missing (imported but not listed):**
- fastapi, uvicorn, pydantic, httpx, numpy, python-dotenv

---

## Technical Debt Summary

| ID | Issue | Severity | Effort |
|----|-------|----------|--------|
| DIR-01 | No script chunking for long contexts | Critical | 20h |
| DIR-02 | Zero authentication | Critical | 4h |
| DIR-03 | Incomplete requirements.txt | High | 1h |
| DIR-04 | Code duplication (3 pairs of files) | High | 8h |
| DIR-05 | No tests | High | 16h |
| DIR-06 | LLM timeout missing | High | 2h |
| DIR-07 | Inconsistent temperature settings | Medium | 1h |
| DIR-08 | Hardcoded configuration (10+ values) | Medium | 4h |
| DIR-09 | Legacy/unused files (orchestrator.py, search_tools.py) | Low | 2h |
| DIR-10 | CORS misconfiguration | High | 1h |

---

## Recommendation

**This prototype is superseded by `story-magic/packages/orchestrator/src/director/`.** The consolidated TypeScript version has:
- Proper authentication
- Rate limiting
- Zod schema validation
- Structured logging
- Better error handling

**Action:** Deprecate the standalone `Director/` service. Keep as reference only. All future development on the monorepo.
