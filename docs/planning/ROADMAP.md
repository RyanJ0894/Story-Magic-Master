# Roadmap

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
- [ ] Set up CI/CD pipeline
- [ ] Configure production environment
- [ ] Set up monitoring and alerting
- [ ] Configure auto-scaling
- [ ] Deploy to Render.com
- [ ] DNS and SSL configuration
- [ ] Load testing

### Acceptance Criteria
- [ ] Service available at production URL
- [ ] Health checks passing
- [ ] Monitoring dashboards operational
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

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-01 | Initial TypeScript consolidation |
| 0.2.0 | TBD | Complete worker conversion |
| 0.3.0 | TBD | Production deployment |
| 1.0.0 | TBD | MVP SaaS launch |
