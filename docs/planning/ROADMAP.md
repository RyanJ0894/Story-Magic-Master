# Roadmap

> **ARCHIVED** (2026-02-07) — Phases 1-9 complete. Phase 10 partial. All active items consolidated into [`docs/ROADMAP-2026-02-07.md`](../ROADMAP-2026-02-07.md).

> Development timeline and milestones for Story Magic

## Overview

Story Magic development is organized into three parallel tracks:

1. **MVP SaaS** - Public self-service product
2. **Enterprise** - Major studio deployments (TPN/MPAA compliant)
3. **AutoScore/AutoEdit** - Script analysis intelligence features

This roadmap focuses on the core platform consolidation and MVP SaaS launch.

---

## Current Status

**Phase:** TypeScript Consolidation Complete - Ready for Production (Phase 9 of 10)

| Component | Status | Progress |
|-----------|--------|----------|
| Director Agent (TS) | ✅ Complete | 100% |
| Audio Director Agent (TS) | ✅ Complete | 100% |
| Validation Pipeline (TS) | ✅ Complete | 100% |
| Semantic Search Tools (TS) | ✅ Complete | 100% |
| TTS Worker (TS) | ✅ Complete | 100% |
| Alignment Worker (TS) | ✅ Complete | 100% |
| Timeline Worker (TS) | ✅ Complete | 100% |
| Export Worker (TS) | ✅ Complete | 100% |
| Mixer Worker (TS) | ✅ Complete | 100% |
| Orchestrator Pipeline (TS) | ✅ Complete | 100% |
| Documentation | ✅ Complete | 100% |
| Legacy Cleanup | ✅ Complete | 100% |

---

## Phase 1-7: Foundation (COMPLETE)

### Phase 1: TypeScript Setup
- [x] Add tsconfig.json to orchestrator package
- [x] Install TypeScript dependencies
- [x] Configure build pipeline
- [x] Set up path aliases

### Phase 2: Embedding Conversion
- [x] Convert .npy embeddings to JSON format
- [x] Copy knowledge bases to orchestrator package
- [x] Implement EmbeddingStore class
- [x] Test cosine similarity search

### Phase 3: LLM Integration
- [x] Install Vercel AI SDK
- [x] Create llm-client.ts abstraction
- [x] Implement tool definitions
- [x] Create BaseAgent class

### Phase 4: Director Agent Port
- [x] Port system prompt from Python
- [x] Implement search_voices tool
- [x] Create DirectorAgent class
- [x] Add Zod validation at LLM boundary

### Phase 5: Audio Director Agent Port
- [x] Port audio director prompt
- [x] Implement search_music, search_ambience, search_sfx tools
- [x] Create AudioDirectorAgent class
- [x] Add Zod validation

### Phase 6: Validation Port
- [x] Port DirectorJSONValidator with auto-correction
- [x] Port SceneAudioValidator with auto-correction
- [x] Extend Zod schemas
- [x] Integration testing

### Phase 7: Route Integration
- [x] Add /generate-scenes route
- [x] Modify /orchestrate for internal Director
- [x] Update API responses
- [x] End-to-end testing

---

## Phase 8: Worker Conversion (COMPLETE)

### Objective
Convert remaining JavaScript workers to TypeScript for full type safety.

### Tasks
- [x] Convert lib/idempotency.ts
- [x] Convert lib/storage.ts
- [x] Convert lib/db.ts
- [x] Convert lib/retry.ts
- [x] Convert lib/audio.ts
- [x] Convert lib/catalog-loader.ts
- [x] Convert workers/tts.ts
- [x] Convert workers/cues.ts
- [x] Convert workers/whisper-align.ts
- [x] Convert workers/align.ts
- [x] Convert workers/timeline-validator.ts
- [x] Convert workers/timeline.ts
- [x] Convert workers/export.ts
- [x] Convert workers/mixer.ts
- [x] Convert lib/ffmpeg-validator.ts
- [x] Convert workers/orchestrator.ts (main pipeline)

### Acceptance Criteria
- [x] All workers compile with strict TypeScript
- [x] No `any` types in public interfaces
- [x] Zod validation at all external boundaries
- [x] Existing functionality preserved

---

## Phase 9: Cleanup & Finalization (COMPLETE)

### Objective
Remove legacy code and prepare for production.

### Tasks
- [x] Remove legacy JavaScript workers
- [x] Remove Python Director package (deprecated - consolidated into TypeScript)
- [x] Update package.json scripts
- [x] Update environment variable documentation
- [x] Update README files
- [ ] Performance benchmarking (optional)
- [ ] Memory usage optimization (optional)

### Acceptance Criteria
- [x] Single TypeScript service running
- [x] TypeScript compilation passing
- [x] Documentation complete
- [x] No deprecated code remaining

---

## Phase 10: Production Deployment

### Objective
Deploy consolidated service to production.

### Tasks
- [x] Set up CI/CD pipeline
- [ ] Configure production environment
- [x] Set up monitoring and alerting
- [ ] Configure auto-scaling (documented, not yet enabled)
- [ ] Deploy to Render.com
- [ ] DNS and SSL configuration
- [ ] Load testing

### Acceptance Criteria
- [ ] Service available at production URL
- [ ] Health checks passing
- [x] Monitoring dashboards operational
- [ ] <2s API response time (p95)

---

## MVP SaaS Launch (Weeks 1-10)

### Week 1-2: Core Platform
- [ ] User authentication (Supabase Auth)
- [ ] Project management CRUD
- [ ] Script upload and parsing
- [ ] Basic audio generation

### Week 3-4: Audio Quality
- [ ] Voice preview and selection
- [ ] Music preview and override
- [ ] Manual timing adjustments
- [ ] Quality presets (draft/standard/premium)

### Week 5-6: User Experience
- [ ] Audio player with waveform
- [ ] Scene-by-scene playback
- [ ] Download options (MP3, WAV, M4A)
- [ ] Project sharing

### Week 7-8: Billing & Monetization
- [ ] Stripe integration
- [ ] Usage-based pricing
- [ ] Subscription tiers
- [ ] Invoice generation

### Week 9-10: Launch Preparation
- [ ] Marketing website
- [ ] Documentation site
- [ ] Onboarding flow
- [ ] Beta user feedback
- [ ] Public launch

---

## Enterprise Readiness (Post-MVP)

### Security & Compliance
- [ ] SOC 2 Type II certification
- [ ] TPN/MPAA compliance assessment
- [ ] Penetration testing
- [ ] Security audit

### Multi-tenancy
- [ ] Tenant isolation
- [ ] Custom voice catalogs
- [ ] White-label options
- [ ] SSO integration (SAML/OIDC)

### SLA & Operations
- [ ] 99.9% uptime SLA
- [ ] 24/7 incident response
- [ ] Dedicated support
- [ ] Custom SLAs

---

## AutoScore/AutoEdit (Future)

### Script Analysis
- [ ] Dialogue quality scoring
- [ ] Character development metrics
- [ ] Pacing analysis
- [ ] Genre classification

### Improvement Suggestions
- [ ] Dialogue rewrite suggestions
- [ ] Scene restructuring
- [ ] Character arc analysis
- [ ] Conflict identification

### Industry Integration
- [ ] Final Draft import
- [ ] Fountain format support
- [ ] PDF screenplay parsing
- [ ] Export to industry formats

---

## Success Metrics

### Technical KPIs
| Metric | Target | Current |
|--------|--------|---------|
| API Response Time (p95) | <2s | TBD |
| Audio Generation Time | <30s/scene | TBD |
| LLM Success Rate | >95% | TBD |
| Validation Pass Rate | >90% | TBD |

### Business KPIs
| Metric | Target | Timeline |
|--------|--------|----------|
| Beta Users | 100 | Week 8 |
| Paid Users | 500 | Month 3 |
| Monthly Revenue | $10k | Month 6 |
| Enterprise Clients | 3 | Month 12 |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM API outages | High | Multi-provider fallback |
| ElevenLabs rate limits | Medium | Caching, queue management |
| Long script processing | Medium | Chunking, progress tracking |
| Audio quality issues | Medium | Manual override options |
| Cost overruns | Medium | Usage limits, tiered pricing |

---

## February 2026 Update — Revised Roadmap

> Based on [code-review/2026-02-01/FEATURE_PLANNING.md](../../code-review/2026-02-01/FEATURE_PLANNING.md)

### Current State (Feb 1, 2026)

The TypeScript consolidation (Phases 1-9) is **complete**. The MVP is **~75% done** with 3 critical blockers preventing launch.

### Revised Path to 1.0

| Phase | Focus | Hours | When |
|-------|-------|-------|------|
| **Phase 0: Launch Blockers** | Share page, security fixes, voice override, MP3 export, prototype deprecation | 32h | Week 1 |
| **Phase 1: MVP Polish** | Share management, scene regeneration, voice preview, project duplication, QR sharing | 40h | Weeks 2-3 |
| **Phase 2: Intelligence** | StoryScore (12-dim), Story-Adviser, revision tracking, comparable scripts | 80h | Weeks 4-6 |
| **Phase 3: Capability** | Long scripts (90-120 pages), stem export, enterprise security, custom voices | 100h | Weeks 7-10 |
| **Phase 4: Platform** | Public API, reader marketplace, team workspaces, enterprise SSO | 120h | Weeks 11+ |

### Phase 0 Detail (Critical Path)

- [x] Implement `/share/[code]/page.tsx` (public share page)
- [x] Replace SHA-256 with bcrypt for share passwords
- [x] Wire voice-chooser.tsx to API
- [x] Add MP3 export format option
- [x] Add Zod validation to all POST endpoints
- [x] Deprecate standalone Director/ and Orchestrator/
- [x] Full pipeline smoke test (upload → generate → download)
- [ ] Deploy to Render (staging)

### Requirements Sync

See [code-review/2026-02-01/REQUIREMENTS_SYNC.md](../../code-review/2026-02-01/REQUIREMENTS_SYNC.md) for full matrix of P0-P6 requirements vs. implementation status.

**Key decision:** Long-script support (P0 requirement) is deferred to Phase 3 / Pro tier. MVP launches with ≤15 page limit.

---

## February 7, 2026 Update — Production Launch TODO Complete

### Summary

Phases 0-6 of the revised roadmap are **COMPLETE**: 88 tickets closed, 236 story points delivered across 8 phases. Phase 7 (MVP Polish & Launch Readiness) is **IN PROGRESS**.

### Test Suite

| Package | Tests | Status |
|---------|-------|--------|
| Orchestrator | 364 | ✅ All passing |
| Web | 278 | ✅ All passing |
| **Total** | **642** | **✅ All passing** |

### Security Hardening (Phase 0 — Complete)

All Phase 0 security items have been delivered:

- CORS configuration locked to allowed origins
- CSRF token validation on state-changing requests
- Auth guards on all protected API routes
- Path traversal prevention on file operations
- Error response sanitization (no stack traces in production)

### Infrastructure

- Render Standard plan provisioned
- Staging environment ready for deployment
- Cleanup cron job configured for temporary assets
- Monorepo tooling upgraded to pnpm@9.1.0

### Features Delivered (Phases 1-6)

- Admin APIs for project and user management
- MP3 export format alongside M4A
- Team sharing with role-based permissions
- Audit log capture for compliance-sensitive actions
- WCAG 2.1 AA compliance on audio player components

### Phase 10 Partial Completion

The following Phase 10 items are now done:

- [x] CI/CD pipeline operational (GitHub Actions)
- [x] Monitoring and alerting dashboards live (Sentry + uptime checks)
- Auto-scaling configuration documented but not yet enabled (deferred to post-launch traffic validation)

### What Remains

- Phase 7: MVP Polish & Launch Readiness (in progress)
- Render production deploy + DNS/SSL
- Load testing under realistic traffic
- Beta user onboarding

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-01-18 | Initial TypeScript consolidation |
| 0.2.0 | 2026-01-21 | Complete worker conversion |
| 0.3.0 | 2026-01-28 | Production tooling (Sentry, auth, rate limiting, logging) |
| 0.4.0 | 2026-02-01 | Full code review; doc reorganization; revised roadmap |
| 0.5.0 | 2026-02-07 | Phase 0-6 complete; 642 tests; production hardening |
| 1.0.0 | TBD | MVP SaaS launch (target: after Phase 0 + Phase 1) |
