# Story Magic: Full Capability Implementation Plan

> **ARCHIVED** (2026-02-07) — Superseded by [`docs/ROADMAP-2026-02-07.md`](ROADMAP-2026-02-07.md). Week 1 items done; remaining phases mapped to consolidated roadmap Phases A-D.

**Created:** 2026-01-23
**Status:** ARCHIVED
**Current State:** Advanced Prototype (75% Complete)

---

## Executive Summary

Story Magic is a well-architected SaaS foundation with core audio generation working. This document outlines the systematic path to full production capability, organized by priority and dependencies.

**Estimated Timeline:**
- Phase 1 (Critical Fixes): 1-2 weeks
- Phase 2 (Feature Completion): 2-3 weeks
- Phase 3 (Performance): 1-2 weeks
- Phase 4 (Marketplace): 2-3 weeks
- Phase 5 (Enterprise): 4-6 weeks
- Phase 6 (Scale): Ongoing

---

## Phase 1: Critical Security & Stability Fixes

**Priority:** MUST COMPLETE BEFORE PUBLIC USERS
**Timeline:** 1-2 weeks

### 1.1 Job Queue Migration
- [ ] **Status:** Not Started
- **Problem:** `setImmediate()` in `/api/generate` loses jobs on restart
- **Solution:** Implement Inngest or Trigger.dev for durable job processing
- **Files:**
  - `packages/web/app/api/generate/route.ts`
  - New: `packages/web/lib/jobs/queue.ts`
- **Effort:** 2-3 days

### 1.2 CSRF Protection
- [ ] **Status:** Not Started
- **Problem:** All POST endpoints vulnerable to cross-site request forgery
- **Solution:** Add CSRF tokens via middleware
- **Files:**
  - New: `packages/web/lib/csrf.ts`
  - Update: All POST API routes
- **Effort:** 2-3 hours

### 1.3 Content Security Policy (CSP)
- [ ] **Status:** Not Started
- **Problem:** No XSS protection headers
- **Solution:** Add CSP headers in Next.js config
- **Files:**
  - `packages/web/next.config.js`
- **Effort:** 1-2 hours

### 1.4 Input Validation Framework
- [ ] **Status:** Partial
- **Problem:** Script text passed to LLM without comprehensive sanitization
- **Solution:** Zod schemas + dangerous pattern detection
- **Files:**
  - `packages/web/lib/validation/script.ts`
  - `packages/web/app/api/generate/route.ts`
- **Effort:** 4-6 hours

### 1.5 Health Check Enhancement
- [ ] **Status:** Partial
- **Problem:** Health endpoint doesn't verify external dependencies
- **Solution:** Check DB, ElevenLabs, OpenAI connectivity
- **Files:**
  - `packages/orchestrator/src/routes/health.ts`
  - `packages/web/app/api/health/route.ts`
- **Effort:** 2-3 hours

### 1.6 Request Size Limits
- [ ] **Status:** Not Started
- **Problem:** No limits on upload sizes (DoS vector)
- **Solution:** Add body-parser limits + file size validation
- **Files:**
  - `packages/web/next.config.js`
  - Upload handling routes
- **Effort:** 1 hour

---

## Phase 2: Feature Completion

**Priority:** Enable features already built but flagged
**Timeline:** 2-3 weeks
**Dependencies:** Phase 1 security fixes

### 2.1 StoryScore System
- [ ] **Status:** Schema complete, UI flagged
- **Tasks:**
  - [ ] Enable `NEXT_PUBLIC_FF_STORY_SCORE=true`
  - [ ] Test 12-dimension scoring end-to-end
  - [ ] Add score visualization component (radar chart)
  - [ ] Historical score tracking per project
  - [ ] Score comparison between revisions
- **Files:**
  - `packages/web/lib/features.ts`
  - `packages/web/app/projects/[id]/score-display.tsx` (new)
  - `packages/web/app/api/projects/[id]/score/route.ts`
- **Effort:** 3-4 days

### 2.2 Story-Adviser (Suggestions)
- [ ] **Status:** Schema complete, partially integrated
- **Tasks:**
  - [ ] Enable `NEXT_PUBLIC_FF_STORY_ADVISER=true`
  - [ ] Complete suggestion generation pipeline
  - [ ] Wire up rewrite acceptance/rejection flow
  - [ ] Apply accepted rewrites to script text
  - [ ] Suggestion categorization by dimension
- **Files:**
  - `packages/web/app/api/projects/[id]/suggestions/route.ts`
  - `packages/web/app/projects/[id]/suggestions-panel.tsx` (new)
- **Effort:** 4-5 days

### 2.3 Voice Chooser API Integration
- [ ] **Status:** UI complete, API call TODO
- **Tasks:**
  - [ ] Replace TODO at `voice-chooser.tsx:391` with API call
  - [ ] Save voice assignments to `director_json`
  - [ ] Add voice preview/audition feature
  - [ ] Persist assignments across sessions
- **Files:**
  - `packages/web/app/projects/[id]/voice-chooser.tsx`
  - `packages/web/app/api/projects/[id]/voices/route.ts` (new)
- **Effort:** 1-2 days

### 2.4 Revision Tracking
- [ ] **Status:** Schema complete, UI flagged
- **Tasks:**
  - [ ] Enable `NEXT_PUBLIC_FF_REVISION_TRACKING=true`
  - [ ] Version diff visualization (side-by-side)
  - [ ] Score trajectory chart (score over versions)
  - [ ] Restore previous version feature
- **Files:**
  - `packages/web/app/projects/[id]/revisions/page.tsx`
  - `packages/web/app/api/projects/[id]/revisions/route.ts`
- **Effort:** 2-3 days

### 2.5 Comparable Scripts
- [ ] **Status:** pgvector ready, UI not built
- **Tasks:**
  - [ ] Enable `NEXT_PUBLIC_FF_COMPARABLE_SCRIPTS=true`
  - [ ] Seed corpus with 50+ genre examples
  - [ ] "Scripts like yours" recommendation UI
  - [ ] Similarity score display
- **Files:**
  - `packages/web/app/projects/[id]/comparables.tsx` (new)
  - `packages/web/app/api/admin/corpus/populate/route.ts`
- **Effort:** 2-3 days

---

## Phase 3: Performance & Reliability

**Priority:** Improve generation speed and reliability
**Timeline:** 1-2 weeks
**Dependencies:** Phase 1 complete

### 3.1 TTS Concurrency Optimization
- [ ] **Status:** Limited to 3 concurrent
- **Current:** 3 parallel ElevenLabs calls
- **Target:** 8-10 parallel calls
- **Files:**
  - `packages/orchestrator/src/orchestrator/workers/tts.ts`
- **Effort:** 1 hour

### 3.2 Parallel Scene Processing
- [ ] **Status:** Sequential processing
- **Tasks:**
  - [ ] Identify parallelizable operations
  - [ ] Implement Promise.all for independent scenes
  - [ ] Add progress tracking per scene
- **Files:**
  - `packages/orchestrator/src/orchestrator/pipeline.ts`
- **Effort:** 1-2 days

### 3.3 Batch Database Operations
- [ ] **Status:** N+1 queries for audio outputs
- **Tasks:**
  - [ ] Batch audio_outputs inserts
  - [ ] Optimize job status updates
  - [ ] Add database connection pooling
- **Files:**
  - `packages/web/app/api/generate/route.ts`
  - `packages/orchestrator/src/lib/db.ts`
- **Effort:** 4-6 hours

### 3.4 Error Recovery & Retry Logic
- [ ] **Status:** No automatic retry
- **Tasks:**
  - [ ] Exponential backoff for API calls
  - [ ] Partial generation recovery
  - [ ] Failed job restart capability
- **Files:**
  - `packages/orchestrator/src/lib/retry.ts`
  - `packages/web/app/api/jobs/[id]/retry/route.ts` (new)
- **Effort:** 1 day

### 3.5 Memory Optimization
- [ ] **Status:** Large files loaded into memory
- **Tasks:**
  - [ ] Stream audio processing where possible
  - [ ] Implement chunked uploads
  - [ ] Add memory usage monitoring
- **Files:**
  - `packages/orchestrator/src/orchestrator/workers/mixer.ts`
- **Effort:** 2-3 days

---

## Phase 4: Marketplace & Monetization

**Priority:** Enable reader/writer economy
**Timeline:** 2-3 weeks
**Dependencies:** Phase 2 features working

### 4.1 Reader Upload Flow
- [ ] **Status:** Endpoint exists, flow incomplete
- **Tasks:**
  - [ ] PDF upload UI for readers
  - [ ] OCR text extraction
  - [ ] Per-upload pricing ($X per page)
  - [ ] Payment confirmation before processing
- **Files:**
  - `packages/web/app/reader/upload/page.tsx`
  - `packages/web/app/api/reader/upload/process/route.ts`
- **Effort:** 3-4 days

### 4.2 Playback Enhancements
- [ ] **Status:** Basic player working
- **Tasks:**
  - [ ] Playback position sync across devices
  - [ ] Offline download support (PWA)
  - [ ] Playback speed controls
  - [ ] Chapter/scene navigation
- **Files:**
  - `packages/web/app/projects/[id]/audio-player.tsx`
  - `packages/web/app/api/reader/library/[entryId]/position/route.ts`
- **Effort:** 2-3 days

### 4.3 Script Marketplace
- [ ] **Status:** Not started
- **Tasks:**
  - [ ] Writer listing UI
  - [ ] Pricing tier options
  - [ ] Purchase flow integration
  - [ ] Revenue tracking dashboard
- **Files:**
  - New: `packages/web/app/marketplace/` directory
- **Effort:** 1 week

### 4.4 Payout System
- [ ] **Status:** Not started
- **Tasks:**
  - [ ] Stripe Connect integration
  - [ ] Writer payout scheduling
  - [ ] Revenue reports
  - [ ] Tax document generation
- **Files:**
  - New: `packages/web/app/api/payouts/` directory
- **Effort:** 1 week

---

## Phase 5: Enterprise Features

**Priority:** Support studio/enterprise clients
**Timeline:** 4-6 weeks
**Dependencies:** Phases 1-4 complete

### 5.1 Enterprise SSO
- [ ] **Status:** Not started
- **Tasks:**
  - [ ] SAML integration (Auth0/Okta)
  - [ ] OAuth 2.0 support
  - [ ] JIT user provisioning
  - [ ] SSO configuration UI
- **Effort:** 1-2 weeks

### 5.2 API Key Management
- [ ] **Status:** Not started
- **Tasks:**
  - [ ] API key generation/revocation
  - [ ] Rate limiting per key
  - [ ] Usage tracking per key
  - [ ] Scoped permissions
- **Effort:** 3-4 days

### 5.3 Compliance Features
- [ ] **Status:** Audit log framework exists
- **Tasks:**
  - [ ] TPN/MPAA compliance checklist
  - [ ] SOC 2 audit log retention (7 years)
  - [ ] Data residency options (US/EU)
  - [ ] DLP controls
- **Effort:** 2 weeks

### 5.4 Advanced Team Management
- [ ] **Status:** Basic teams working
- **Tasks:**
  - [ ] Workspace hierarchy (org → teams → projects)
  - [ ] Custom role definitions
  - [ ] Bulk user import (CSV)
  - [ ] Activity audit per team
- **Effort:** 1 week

### 5.5 White-Label Support
- [ ] **Status:** Not started
- **Tasks:**
  - [ ] Custom branding options
  - [ ] Custom domain support
  - [ ] Embedded player widget
- **Effort:** 1-2 weeks

---

## Phase 6: Scale & Operations

**Priority:** Production reliability at scale
**Timeline:** Ongoing
**Dependencies:** Phases 1-5 complete

### 6.1 Infrastructure
- [ ] Auto-scaling policies
- [ ] Multi-region deployment
- [ ] CDN for audio delivery
- [ ] Database read replicas
- [ ] Redis cluster for caching

### 6.2 Monitoring
- [ ] Sentry error tracking
- [ ] Application metrics (Datadog/Grafana)
- [ ] SLA monitoring dashboard
- [ ] Automated alerting
- [ ] Performance profiling

### 6.3 Developer Platform
- [ ] Public API documentation (OpenAPI)
- [ ] Webhook system for events
- [ ] JavaScript/Python SDKs
- [ ] Sandbox environment
- [ ] API changelog

---

## Implementation Tracking

### Week 1 Progress
| Task | Status | Notes |
|------|--------|-------|
| 1.2 CSRF Protection | ✅ Complete | Already implemented via origin validation |
| 1.3 CSP Headers | ✅ Complete | Added to next.config.js |
| 1.5 Health Checks | ✅ Complete | Comprehensive endpoint at /api/health |
| 1.6 Request Limits | ✅ Complete | lib/validation/request-limits.ts |
| 3.1 TTS Concurrency | ✅ Complete | Already at 8 concurrent |
| 2.1 StoryScore Enable | ✅ Complete | Feature flag enabled |
| 2.3 Voice Chooser API | ✅ Complete | /api/voices with custom voice priority |

### Week 2 Progress
| Task | Status | Notes |
|------|--------|-------|
| 1.1 Job Queue | | |
| 1.4 Input Validation | | |
| 2.2 Story-Adviser | | |

### Week 3 Progress
| Task | Status | Notes |
|------|--------|-------|
| 2.4 Revision Tracking | | |
| 2.5 Comparable Scripts | | |

---

## Quick Reference: Feature Flags

| Flag | Default | Enable With |
|------|---------|-------------|
| `STORY_SCORE` | false | `NEXT_PUBLIC_FF_STORY_SCORE=true` |
| `STORY_ADVISER` | false | `NEXT_PUBLIC_FF_STORY_ADVISER=true` |
| `REVISION_TRACKING` | false | `NEXT_PUBLIC_FF_REVISION_TRACKING=true` |
| `SCRIPT_EDITOR` | false | `NEXT_PUBLIC_FF_SCRIPT_EDITOR=true` |
| `COMPARABLE_SCRIPTS` | false | `NEXT_PUBLIC_FF_COMPARABLE_SCRIPTS=true` |
| `EXPORT_REPORTS` | false | `NEXT_PUBLIC_FF_EXPORT_REPORTS=true` |

---

## Definition of Done

Each task is complete when:
1. Code implemented and TypeScript passes
2. Manual testing completed
3. Edge cases handled
4. Error states have user-friendly messages
5. Committed with descriptive message
6. This document updated with status

---

## Notes & Decisions

*Record important decisions and blockers here*

- 2026-01-23: Plan created. Starting with Phase 1 security fixes.
- 2026-01-23: Completed Phase 1 security fixes (CSP headers, request limits, health checks, CSRF was already done).
- 2026-01-23: TTS concurrency already at 8 (no change needed).
- 2026-01-23: Enabled StoryScore feature flag in .env.local.
- 2026-01-23: Created /api/voices endpoint with custom voice prioritization (voices native to API key appear first).

