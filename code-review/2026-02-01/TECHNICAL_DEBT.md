# Technical Debt Inventory
**Date:** February 1, 2026
**Total Items:** 30 (across all components)

---

## Severity Distribution

| Severity | Count | Components |
|----------|-------|------------|
| Critical | 5 | Prototype (3), Monorepo (2) |
| High | 12 | Prototype (6), Monorepo (6) |
| Medium | 10 | Prototype (4), Monorepo (6) |
| Low | 3 | Prototype (1), Monorepo (2) |

---

## Critical

### TD-01: No Long-Script Support (P0 Requirement)
**Component:** All
**Impact:** Primary use case (90-120 page scripts) cannot be served
**Root Cause:** No chunking strategy, no state persistence across chunks
**Effort:** 40h (chunking + state persistence + character registry + testing)
**Fix:** Scene-based chunking with Supabase state persistence

### TD-02: Prototype Services Unsecured
**Component:** Director/, Orchestrator/
**Impact:** Open endpoints consume API credits, security exposure
**Effort:** 1h (shut down) or 8h (add auth)
**Fix:** Deprecate prototypes; use monorepo exclusively

### TD-03: Public Share Page Missing
**Component:** story-magic/packages/web
**Impact:** Core feature broken — share links 404
**Effort:** 4h
**Fix:** Implement `/share/[code]/page.tsx`

### TD-04: Voice Override Not Wired
**Component:** story-magic/packages/web
**Impact:** Users cannot control character voices (core UX)
**Effort:** 3h
**Fix:** Wire `voice-chooser.tsx` to API, persist to database

### TD-05: Dual Codebase Maintenance
**Component:** Director/ + Orchestrator/ vs story-magic/
**Impact:** Bugs fixed in one location not fixed in other
**Effort:** 4h (deprecation + documentation)
**Fix:** Officially deprecate prototypes, update all references

---

## High

### TD-06: Zero Tests in Director Prototype
**Component:** Director/
**Impact:** No regression protection, no validation of acceptance criteria
**Effort:** 16h (if prototype kept; 0h if deprecated)

### TD-07: Triple Mixer Implementation
**Component:** Orchestrator/
**Impact:** Unclear which mixer is active; conflicting gain values (-4dB vs -22dB)
**Files:** `workers/mixer.js`, `workers/mix.js`, `lib/mixer.js`
**Effort:** 4h (consolidate to one, delete others)

### TD-08: 831 Lines of Commented Code
**Component:** Orchestrator/workers/mix.js
**Impact:** Maintenance confusion, git blame noise
**Effort:** 1h (delete file)

### TD-09: Missing E2E Pipeline Tests
**Component:** story-magic/
**Impact:** Cannot verify full flow: upload → generate → download
**Effort:** 16h

### TD-10: LLM Determinism Unverified
**Component:** All
**Impact:** Same script produces different outputs; no reproducibility guarantee
**Effort:** 8h (determinism test suite)

### TD-11: Token Budget Not Managed
**Component:** Director pipeline
**Impact:** Long scripts silently truncated or fail
**Effort:** 8h (input estimation + chunking integration)

### TD-12: Incomplete requirements.txt
**Component:** Director/
**Impact:** Missing packages (fastapi, uvicorn, pydantic, httpx, numpy)
**Effort:** 1h (if prototype kept)

### TD-13: Code Duplication in Director
**Component:** Director/
**Files:** voice_search vs voice_search_tool, audio_search vs audio_search_tool, agent.py vs audio_director_agent.py
**Impact:** Bugs require fixing in 2-3 places
**Effort:** 8h (if prototype kept)

### TD-14: Automated File Cleanup Missing
**Component:** story-magic/packages/orchestrator
**Impact:** 1GB disk will fill over time
**Effort:** 4h

### TD-15: Share Password Hashing Weak
**Component:** story-magic/packages/web
**Impact:** Using SHA-256 instead of bcrypt for share passwords
**Effort:** 2h

### TD-16: Type Safety Gaps (40+ `as any`)
**Component:** story-magic/packages/web
**Impact:** Runtime errors, difficult debugging
**Effort:** 8h

### TD-17: No Input Validation on Prototype Endpoints
**Component:** Director/, Orchestrator/
**Impact:** DoS vector, injection risk
**Effort:** 0h (if deprecated)

---

## Medium

### TD-18: Inconsistent Temperature Settings
**Component:** Director/
**Detail:** Director uses 1.0, AudioDirector uses 0.7
**Effort:** 1h

### TD-19: Hardcoded Configuration
**Component:** Director/ (10+ values), Orchestrator/ (10+ values)
**Detail:** Models, retry counts, gains, crossfade durations, etc.
**Effort:** 4h per component

### TD-20: Console.log Logging (Prototype)
**Component:** Orchestrator/
**Detail:** Emoji-filled console.log; not parseable by log aggregators
**Effort:** 4h (if prototype kept)

### TD-21: Diagnostic Logs in Production
**Component:** story-magic/packages/orchestrator/src/orchestrator/workers/tts.ts
**Detail:** "DIAGNOSTIC" markers left in production code
**Effort:** 1h

### TD-22: CSP unsafe-inline
**Component:** story-magic/packages/web
**Detail:** Required for dev; needs nonce-based CSP for production
**Effort:** 4h

### TD-23: Inconsistent Error Response Shapes
**Component:** story-magic/ API routes
**Detail:** Some return `{message}`, others `{error}`
**Effort:** 4h

### TD-24: Audio Catalog Has No Metadata
**Component:** Orchestrator/catalog/
**Detail:** 131 assets with no duration, tags, genre, BPM
**Effort:** 8h

### TD-25: SFX Timing Type Inconsistency
**Component:** Orchestrator/
**Detail:** Mixes line_id strings with numeric timestamps
**Effort:** 2h

### TD-26: Whisper JSON Parsing Fragility
**Component:** Orchestrator/workers/whisper-align.js
**Detail:** Output format varies by whisper.cpp version
**Effort:** 4h

### TD-27: No API Documentation
**Component:** story-magic/
**Detail:** No OpenAPI/Swagger spec for 30+ endpoints
**Effort:** 8h

---

## Low

### TD-28: Legacy/Unused Files in Director
**Component:** Director/
**Files:** orchestrator.py (57 lines, unused), search_tools.py (1007 lines, legacy)
**Effort:** 1h

### TD-29: Default ElevenLabs Voice Hardcoded
**Component:** Orchestrator/lib/db.js:54
**Effort:** 1h

### TD-30: Embedding Model Not Configurable
**Component:** Director/
**Detail:** all-MiniLM-L6-v2 hardcoded; no A/B testing capability
**Effort:** 4h

---

## Debt Reduction Roadmap

| Phase | Items | Total Effort |
|-------|-------|-------------|
| **Week 1: Blockers** | TD-02, TD-03, TD-04, TD-05, TD-15, TD-16 | 22h |
| **Week 2: Pipeline** | TD-07, TD-08, TD-09, TD-14, TD-21 | 26h |
| **Week 3: Quality** | TD-10, TD-11, TD-22, TD-23, TD-27 | 32h |
| **Weeks 4-6: Capability** | TD-01, TD-24, TD-26 | 52h |
| **Deferred (prototype)** | TD-06, TD-12, TD-13, TD-17-20, TD-25, TD-28-30 | 0h (deprecated) |
