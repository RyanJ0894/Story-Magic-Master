# Feature Planning: Road to Product 1.0
**Date:** February 1, 2026
**Goal:** Define the path from current state to a shippable, revenue-generating product

---

## Current State: 75% to MVP

**What works:** Script upload, parsing, voice assignment, TTS, mixing, project management, auth, payments
**What's broken:** Share links, voice override UI
**What's missing:** Long scripts, scene regeneration, stem export, intelligence features

---

## Phase 0: Launch Blockers (Week 1, ~32h)

Fix the critical issues that prevent launching to any users.

### 0.1 Public Share Page (4h)
Implement `/share/[code]/page.tsx`:
- Fetch share metadata (public access, no auth required)
- Render password form if protected
- Stream audio player on success
- Handle expired/revoked shares

### 0.2 Security Fixes (8h)
- Replace SHA-256 share passwords with bcrypt
- Remove `as any` casts in share code paths
- Add Zod validation to all POST endpoints
- Verify path traversal protection on download

### 0.3 Voice Override Wiring (3h)
- Wire `voice-chooser.tsx` to `/api/projects/[id]/voice-assignments`
- Persist selections to database
- Pass overrides to Director pipeline

### 0.4 MP3 Export (2h)
- Add MP3 codec option to export worker
- Default to MP3 for web downloads
- Keep M4A as high-quality option

### 0.5 Prototype Deprecation (2h)
- Document that `Director/` and `Orchestrator/` are deprecated
- Update CLAUDE.md to point to monorepo exclusively
- Add deprecation notices to prototype README files

### 0.6 Smoke Tests (5h)
- Full pipeline E2E: upload → generate → download
- Share flow: create → access → play
- Auth flow: register → login → create project

### 0.7 Pre-Launch Checklist (8h)
- Run Supabase migrations
- Configure Render secrets
- Deploy and smoke test
- Monitor for errors (Sentry)
- Verify Stripe webhooks

**Exit Criteria:** Users can upload scripts, generate audio, download, and share.

---

## Phase 1: MVP Polish (Weeks 2-3, ~40h)

Complete the features needed to charge money confidently.

### 1.1 Share Management Dashboard (6h)
- List user's active shares
- Edit settings (expiry, max plays, password)
- Revoke access
- View access analytics (who played, when)

### 1.2 Scene-by-Scene Regeneration (6h)
- New endpoint: `POST /api/projects/[id]/scenes/[sceneId]/regenerate`
- Keep other scenes unchanged
- Show per-scene status in UI
- Allow regeneration after voice override

### 1.3 Voice Preview Audio (2h)
- Integrate ElevenLabs preview sample URLs
- Play sample on hover/click in voice chooser
- Cache samples locally

### 1.4 Project Duplication (3h)
- Clone project with new name
- Copy voice selections and audio overrides
- Fresh generation required

### 1.5 Audio Player Improvements (4h)
- Playback speed control (0.5x, 1x, 1.5x, 2x)
- Chapter/scene navigation
- Waveform visualization
- Keyboard shortcuts

### 1.6 Usage Dashboard (4h)
- Pages used vs limit (visual bar)
- Forecast when limit reached
- Upgrade prompt at 80% usage
- Show per-project usage breakdown

### 1.7 QR Code Sharing (2h)
- Generate QR code for share links
- Copy link to clipboard
- Download QR as image

### 1.8 Testing Expansion (8h)
- Auth bypass tests
- Stripe webhook tests
- Rate limit tests
- Component tests for key UI elements

### 1.9 Documentation (5h)
- API reference (OpenAPI/Swagger)
- User guide (how to use the product)
- Troubleshooting guide

**Exit Criteria:** All planned MVP features working. Documentation complete. Ready for marketing.

---

## Phase 2: Intelligence Features (Weeks 4-6, ~80h)

Differentiate from competitors with AI-powered script analysis.

### 2.1 StoryScore MVP (26h)
**12-dimension script scoring:**
1. Dialogue authenticity
2. Visual storytelling
3. Pacing and structure
4. Character development
5. Emotional range
6. Conflict and tension
7. Theme coherence
8. World-building
9. Subtext
10. Opening hook
11. Stakes escalation
12. Resolution satisfaction

**Implementation:**
- LLM scoring pipeline with chain-of-thought reasoning
- Confidence scoring per dimension
- Calibration against human evaluators
- Radar chart visualization (Victory.js or Recharts)
- Score card (collapsed/expanded)
- Strengths/weaknesses summary
- Score history view

### 2.2 Story-Adviser Core (22h)
- Identify weak sections from StoryScore
- Generate improvement suggestions per dimension
- Estimate impact on score
- Inline editor highlighting (CodeMirror 6)
- Side-by-side comparison view
- Accept/reject workflow
- Multiple rewrite options with impact prediction
- Track acceptance rate

### 2.3 Revision Tracking (13h)
- Auto-save on script changes
- Version history timeline
- Diff view (before/after)
- Score trajectory chart (how scores improve over revisions)
- Restore previous version
- Compare any two versions

### 2.4 Comparable Scripts (10h)
- Database of scored reference scripts (by genre)
- Show where user's script sits relative to genre norms
- Identify specific areas where script under/over-performs
- "Scripts like yours that scored well" recommendations

### 2.5 Testing (9h)
- StoryScore determinism tests
- Suggestion quality tests
- Revision diff tests
- Performance tests (scoring latency)

**Exit Criteria:** Users can score scripts, get AI suggestions, accept rewrites, and track improvement over time.

---

## Phase 3: Capability Expansion (Weeks 7-10, ~100h)

Handle the primary enterprise use case and add premium features.

### 3.1 Long Script Support (40h)
**Scene-based chunking:**
- Split scripts into 5-scene chunks at INT/EXT boundaries
- Process each chunk independently via Director pipeline
- Maintain global character → voice registry across all chunks
- Persist partial Director JSON to Supabase after each chunk
- Resume from last successful chunk on failure
- Merge all chunk outputs into unified Director JSON
- Progress indication: "Processing chunk 3 of 12..."

**State persistence:**
- Save character registry after each scene
- Save voice assignment map as checkpoint
- Save partial timeline for incremental mixing
- Enable "resume from checkpoint" on pipeline restart

**Memory management:**
- Stream processing (don't hold full script in memory)
- Garbage collection between chunks
- Memory monitoring with alerts

### 3.2 Stem Export (8h)
- Export separate tracks: dialogue, music, ambience, SFX
- WAV format (uncompressed) for professional use
- ZIP download with all stems + mix
- Pro tier feature

### 3.3 Enterprise Security (18h)
- Audit logging (content access, generation, download)
- Immutable log storage (S3)
- 7-year retention policy
- Encryption at rest for Supabase storage
- Per-project encryption keys (KMS integration)
- MFA support (TOTP + backup codes)

### 3.4 Advanced Voice Features (20h)
- Custom voice upload (sample submission)
- Training process with quality validation
- Per-project custom voices
- Voice cloning via ElevenLabs Voice Design API
- Privacy/consent flow + license management

### 3.5 Download Format Options (4h)
- MP3 (default web)
- M4A/AAC (high quality)
- WAV (uncompressed)
- FLAC (lossless)
- Stem bundle (ZIP)

### 3.6 Testing (10h)
- Long script E2E with 120-page fixture
- Chunking boundary tests
- Memory profiling
- Stem export quality tests
- Encryption validation

**Exit Criteria:** Handle 120-page scripts reliably. Premium features justify Pro/Studio tiers.

---

## Phase 4: Platform (Weeks 11+, ~120h)

Transform from tool to platform.

### 4.1 Public API (30h)
- REST API with OpenAPI documentation
- API key management (per-user)
- Rate limiting by tier
- Webhook callbacks for async operations
- SDK generation (TypeScript, Python)

### 4.2 Reader Marketplace (40h)
- Writers publish finished audio productions
- Readers browse and purchase
- Revenue sharing (writer/platform split)
- Stripe Connect for payouts
- Content moderation pipeline

### 4.3 Team Workspaces (25h)
- Multi-user projects
- Role-based access (writer, reviewer, admin)
- Comment/annotation system
- Activity feed
- Shared voice libraries

### 4.4 Enterprise SSO (20h)
- SAML 2.0 integration
- OIDC support
- Just-in-time provisioning
- Custom role mapping
- Admin console for tenant management

### 4.5 Advanced Analytics (15h)
- User behavior tracking
- Funnel analysis (upload → generate → share)
- Feature usage heatmap
- Churn prediction
- A/B testing framework

---

## Feature Priority Matrix

| Feature | Revenue Impact | User Value | Effort | Priority |
|---------|---------------|------------|--------|----------|
| Share page fix | High (core feature) | Critical | 4h | **P0** |
| Voice override | High (core UX) | Critical | 3h | **P0** |
| Security fixes | High (trust) | Critical | 8h | **P0** |
| Scene regeneration | Medium | High | 6h | **P1** |
| StoryScore | High (differentiator) | High | 26h | **P1** |
| Story-Adviser | High (retention) | High | 22h | **P1** |
| Long scripts | High (Pro tier) | High | 40h | **P2** |
| Stem export | Medium (Pro tier) | Medium | 8h | **P2** |
| Public API | Medium (developer) | Medium | 30h | **P3** |
| Marketplace | High (platform) | Medium | 40h | **P3** |
| Enterprise SSO | High (enterprise) | Low (few users) | 20h | **P3** |

---

## Revenue Model Alignment

### Free Tier
- 3 projects, ≤5 pages each
- Watermarked audio
- Standard voices only

### Creator Tier ($29/mo)
- Unlimited projects, ≤15 pages
- No watermark
- Voice override
- Share links
- StoryScore

### Pro Tier ($79/mo)
- ≤120 pages (long scripts)
- Stem export
- Story-Adviser
- Custom voices
- Priority processing

### Studio Tier ($299/mo)
- Everything in Pro
- Team workspaces
- API access
- SSO
- Audit logging
- Dedicated support

---

## Success Metrics

| Metric | Phase 0 | Phase 1 | Phase 2 | Phase 3 |
|--------|---------|---------|---------|---------|
| Active Users | 10+ | 100+ | 500+ | 2,000+ |
| Paying Users | 0 | 20+ | 100+ | 500+ |
| MRR | $0 | $500+ | $3,000+ | $15,000+ |
| Scripts/Day | 5+ | 50+ | 200+ | 1,000+ |
| Share Links/Week | 10+ | 100+ | 500+ | 2,000+ |
| Test Coverage | 40% | 55% | 70% | 80% |
