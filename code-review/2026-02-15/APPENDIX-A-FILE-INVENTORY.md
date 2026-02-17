# Appendix A: File Inventory

**Story Magic Code Review -- 15 February 2026**

---

## Summary Metrics

| Metric | Count |
|--------|-------|
| Source files (app + lib + components + orchestrator/src) | 312 |
| Lines of code | 61,078 |
| API routes (`route.ts`) | 58 |
| Pages (`page.tsx`) | 26 |
| Components (`.tsx` under `components/`) | 60 |
| Web test files | 25 |
| Orchestrator test files | 19 |
| Prisma models | 23 |
| Prisma fields | 297 |
| Stored functions (SQL) | 36 |
| Schema lines (Prisma) | 694 |
| Migration SQL lines | 1,813 |
| `as any` occurrences | 3 |
| Supabase references in production code | 0 |

---

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend framework | Next.js | 14.2.35 |
| UI library | React | 18.x |
| Styling | Tailwind CSS | 3.x |
| Component library | shadcn/ui | (vendored) |
| Authentication | Clerk (`@clerk/nextjs`) | 6.37.3 |
| ORM | Prisma | latest |
| Database | PostgreSQL | 15+ (pgvector, pgcrypto) |
| Payments | Stripe | via `stripe` SDK |
| Error monitoring | Sentry (`@sentry/nextjs`) | 10.34.0 |
| TTS engine | ElevenLabs | via REST API |
| LLM | OpenAI GPT-4o / Groq | via Vercel AI SDK 4.3.19 |
| Rate limiting | Upstash Redis (`@upstash/ratelimit`) | + in-memory fallback |
| Validation | Zod | latest |
| Backend framework | Express | 4.22.1 |
| Audio processing | FFmpeg | system binary |
| Package manager | pnpm | 9.1.0 |
| Deployment | Render.com | IaC via `render.yaml` |

---

## File Organization by Category

### API Routes (58 files)

```
packages/web/app/api/
  admin/
    audit-logs/route.ts
    corpus/populate/route.ts
    settings/route.ts
    stats/route.ts
    subscriptions/route.ts
    subscriptions/[subscriptionId]/route.ts
    users/route.ts
    users/[userId]/route.ts
  alerts/route.ts
  auth/signout/route.ts
  audio-preview/[...path]/route.ts
  docs/route.ts
  generate/route.ts
  generate-demo-script/route.ts
  health/route.ts
  invite/[token]/route.ts
  jobs/[id]/route.ts
  jobs/[id]/cancel/route.ts
  jobs/[id]/position/route.ts
  preview/route.ts
  projects/route.ts
  projects/[id]/route.ts
  projects/[id]/audio-overrides/route.ts
  projects/[id]/comparables/route.ts
  projects/[id]/delete/route.ts
  projects/[id]/export/route.ts
  projects/[id]/feedback/route.ts
  projects/[id]/regenerate-scene/route.ts
  projects/[id]/revisions/route.ts
  projects/[id]/revisions/compare/route.ts
  projects/[id]/score/route.ts
  projects/[id]/suggestions/route.ts
  projects/[id]/suggestions/[suggestionId]/route.ts
  projects/[id]/suggestions/[suggestionId]/rewrite/route.ts
  projects/[id]/voice-assignments/route.ts
  projects/[id]/workflow-mode/route.ts
  queue/status/route.ts
  reader/library/route.ts
  reader/library/[entryId]/route.ts
  reader/library/[entryId]/favorite/route.ts
  reader/library/[entryId]/position/route.ts
  reader/upload/create-payment/route.ts
  reader/upload/process/route.ts
  revisions/[id]/route.ts
  revisions/[id]/compare/[toId]/route.ts
  shares/route.ts
  shares/[shareId]/route.ts
  shares/access/[code]/route.ts
  stripe/checkout/route.ts
  stripe/portal/route.ts
  stripe/webhook/route.ts
  suggestions/[id]/route.ts
  suggestions/[id]/rewrite/route.ts
  teams/route.ts
  teams/[teamId]/members/route.ts
  teams/share/route.ts
  voices/route.ts
  webhooks/clerk/route.ts
```

### Pages (26 files)

```
packages/web/app/
  page.tsx                          # Landing / home
  login/page.tsx                    # Login
  login/sso-callback/page.tsx       # SSO callback
  signup/page.tsx                   # Signup
  signup/sso-callback/page.tsx      # SSO callback
  dashboard/page.tsx                # Main dashboard
  writer/dashboard/page.tsx         # Writer dashboard
  reader/dashboard/page.tsx         # Reader dashboard
  reader/upload/page.tsx            # Reader upload
  projects/new/page.tsx             # New project
  projects/[id]/page.tsx            # Project detail + workflow
  billing/page.tsx                  # Billing / subscription
  pricing/page.tsx                  # Pricing page
  docs/page.tsx                     # API documentation
  guide/page.tsx                    # User guide
  privacy/page.tsx                  # Privacy policy
  terms/page.tsx                    # Terms of service
  share/[code]/page.tsx             # Public share view
  s/[code]/page.tsx                 # Short share link
  invite/[token]/page.tsx           # Team invite acceptance
  admin/page.tsx                    # Admin dashboard
  admin/analytics/page.tsx          # Admin analytics
  admin/audit-log/page.tsx          # Admin audit log
  admin/settings/page.tsx           # Admin settings
  admin/subscriptions/page.tsx      # Admin subscriptions
  admin/users/page.tsx              # Admin user management
```

### Components (60 files)

```
packages/web/components/
  ui/                               # 22 shadcn/ui primitives
    accordion.tsx, badge.tsx, button.tsx, card.tsx, checkbox.tsx,
    collapsible.tsx, dialog.tsx, dropdown-menu.tsx, form.tsx,
    input.tsx, label.tsx, progress.tsx, radio-group.tsx,
    scroll-area.tsx, select.tsx, separator.tsx, skeleton.tsx,
    slider.tsx, switch.tsx, table.tsx, tabs.tsx, textarea.tsx,
    toast.tsx, toaster.tsx, tooltip.tsx
  auth/
    sign-out-button.tsx
  alerts/
    AlertsDropdown.tsx
  comparable/
    ComparableCard.tsx
    ComparableSection.tsx
  dashboard/
    reader-dashboard-client.tsx
    reader-script-card.tsx
    share-modal.tsx
    subscription-card.tsx
    writer-dashboard-client.tsx
    writer-script-card.tsx
  docs/
    swagger-ui.tsx
  feedback/
    FeedbackModal.tsx
  player/
    protected-player.tsx
    ScriptSyncPlayer.tsx
  reader/
    ScriptReadStatus.tsx
    upload-client.tsx
  revisions/
    DiffView.tsx
    RevisionSection.tsx
    RevisionTimeline.tsx
    ScoreTrajectoryChart.tsx
  script-editor/
    ScriptEditor.tsx
    ScriptEditorSection.tsx
  story-adviser/
    ScriptAnnotator.tsx
    StoryAdviser.tsx
    StoryAdviserSection.tsx
    SuggestionCard.tsx
    SuggestionPanel.tsx
    RewriteModal.tsx
  storyscore/
    ExportButton.tsx
    StoryScore.tsx
    StoryScoreSection.tsx
  wizard/
    ScriptImprovementWizard.tsx
    Wizard.tsx
  theme-provider.tsx
  theme-toggle.tsx
```

### Library / Shared Code (packages/web/lib/)

```
packages/web/lib/
  utils.ts                          # Utility functions (cn, etc.)
  constants.ts                      # App-wide constants
  csrf.ts                           # CSRF validation
  db.ts                             # Prisma client singleton
  ensure-profile.ts                 # Profile creation on first auth
  logger.ts                         # Structured logging
  password.ts                       # Password hashing utilities
  voice-scoring.ts                  # Voice matching algorithms
  audio-scoring.ts                  # Audio cue scoring
  api/
    audit.ts                        # Audit log helper
    dto/index.ts                    # Data transfer objects
    mappers/index.ts                # DB-to-API mappers
    middleware.ts                   # withAuth, withProjectAuth, parseBody
    openapi.ts                      # OpenAPI spec generation
    rate-limit.ts                   # Dual-mode rate limiter
  adviser/
    index.ts, prompts.ts, service.ts, types.ts
  audio-catalog/
    index.ts                        # Audio asset catalog
  comparable/
    embeddings.ts, index.ts, service.ts, types.ts
  email/
    index.ts, resend.ts
  export/
    index.ts                        # Report export
  features/
    index.ts                        # Feature flag definitions
  feedback/
    index.ts, types.ts
  generation/
    processor.ts                    # Generation pipeline orchestration
  queue/
    index.ts, service.ts, types.ts, worker.ts
  revisions/
    index.ts, service.ts, types.ts
  scoring/
    index.ts, prompts.ts, service.ts, types.ts
  stripe/
    client.ts, config.ts, server.ts
  types/
    audio.ts, marketplace.ts, script-score.ts, voice.ts
  validation/
    request-limits.ts               # Request size/count limits
```

### Orchestrator (packages/orchestrator/src/)

```
packages/orchestrator/src/
  index.ts                          # Express app entrypoint
  analysis/
    script-score-service.ts
    prompts/script-score-prompts.ts
  director/
    agents/
      director-agent.ts, audio-director-agent.ts, index.ts
    embeddings/
      embedding-store.ts, query-embedding.ts
    pipeline.ts
    prompts/
      audio-director-prompt.ts, director-prompt.ts
    tools/
      audio-search.ts, hybrid-voice-search.ts, voice-search.ts, index.ts
    validation/
      audio-validator.ts, director-validator.ts, index.ts, validation-error.ts
  lib/
    api-response.ts, audio.ts, catalog-loader.ts, cleanup.ts,
    constants.ts, db.ts, env.ts, ffmpeg-validator.ts,
    idempotency.ts, json-repair.ts, llm-client.ts, logger.ts,
    monitoring.ts, prisma.ts, retry.ts, sentry.ts, storage.ts
  middleware/
    auth.ts, rate-limit.ts
  orchestrator/
    pipeline.ts, preview-pipeline.ts
    shared/
      concat-stems.ts, resolve-cues.ts
    workers/
      align.ts, cues.ts, export.ts, mixer.ts,
      parallel-tts.ts, progressive-stitch.ts,
      timeline.ts, timeline-validator.ts, tts.ts, whisper-align.ts
  routes/
    analyze.ts, generate-scenes.ts, health.ts, orchestrate.ts, preview.ts
  schemas/
    director-json.ts, timeline.ts
  types/
    external.d.ts
```

### Test Files (44 total)

**Web tests (25 files):**
```
packages/web/tests/
  unit/api/
    generate-route.test.ts
    projects-route.test.ts
    reader-library.test.ts
    regenerate-scene.test.ts
    shares.test.ts
    stripe-webhook.test.ts
  unit/lib/
    audio-scoring.test.ts
    comparable.test.ts
    csrf.test.ts
    dto.test.ts
    feedback.test.ts
    logger.test.ts
    password.test.ts
    queue.test.ts
    rate-limit.test.ts
    request-limits.test.ts
    revisions.test.ts
    scoring.test.ts
    suggestions.test.ts
    voice-scoring.test.ts
  component/
    audio-player.test.tsx
    login-form.test.tsx
    mobile-nav.test.tsx
    theme-toggle.test.tsx
    writer-script-card.test.tsx
```

**Orchestrator tests (19 files):**
```
packages/orchestrator/src/
  __tests__/integration/
    pipeline-integration.test.ts
  director/
    embeddings/embedding-store.test.ts
    pipeline.test.ts
    tools/hybrid-voice-search.test.ts
    validation/audio-validator.test.ts
    validation/director-validator.test.ts
  lib/
    catalog-loader.test.ts
    ffmpeg-validator.test.ts
    idempotency.test.ts
    retry.test.ts
  orchestrator/
    pipeline.test.ts
    workers/
      align.test.ts
      cues.test.ts
      mixer.test.ts
      timeline.test.ts
      timeline-validator.test.ts
      tts.test.ts
  routes/
    health.test.ts
  schemas/
    director-json.test.ts
```

### Database Schema

**Prisma schema:** `packages/web/prisma/schema.prisma` (694 lines)

**Migration SQL:**
```
packages/web/prisma/migrations/
  0001_init/migration.sql
  0002_add_missing_columns/migration.sql
```
Total: 1,813 lines of SQL

**23 Prisma Models:**

| # | Model | Fields | Key Relations |
|---|-------|--------|---------------|
| 1 | Profile | 18 | Projects, Jobs, Usage, Subscriptions, Teams |
| 2 | Project | 14 | Profile, Jobs, AudioOutputs, Shares, Scores |
| 3 | Job | 19 | Project, Profile, JobLogs, AudioOutputs |
| 4 | JobLog | 10 | Job, Project |
| 5 | AudioOutput | 9 | Project, Job |
| 6 | Usage | 7 | Profile |
| 7 | Subscription | 14 | Profile |
| 8 | Purchase | 9 | Profile, Project |
| 9 | ScriptShare | 17 | Project, Profile (x2), ReaderLibrary |
| 10 | ReaderLibrary | 13 | Profile, Project, ScriptShare |
| 11 | ContentAccessLog | 11 | Profile, Project, ScriptShare |
| 12 | StoryScore | 29 | Project, Suggestions, Revisions |
| 13 | Suggestion | 17 | Project, StoryScore, Rewrites |
| 14 | Rewrite | 7 | Suggestion |
| 15 | Revision | 11 | Project, StoryScore, Profile |
| 16 | ScriptCorpus | 15 | Profile (uploader) |
| 17 | Team | 7 | Profile (owner), TeamMembers, TeamShares |
| 18 | TeamMember | 11 | Team, Profile (x2) |
| 19 | TeamShare | 6 | Project, Team, Profile |
| 20 | Alert | 11 | Profile (x2), Project, Team |
| 21 | AlertPreference | 11 | Profile |
| 22 | AuditLog | 8 | Profile |
| 23 | PlatformSetting | 4 | (standalone) |

**36 Stored Functions** (deployed via migration SQL):
Queue operations, lock management, statistics views, cleanup routines, and data migration helpers.

### Infrastructure Files

```
render.yaml                         # Render.com IaC blueprint
docker-compose.yml                  # Local dev (PostgreSQL, Redis)
pnpm-workspace.yaml                 # Monorepo workspace config
packages/web/prisma/schema.prisma   # Database schema
packages/web/middleware.ts           # Security headers + auth
```

---

## Port Assignments

| Service | Port | Environment |
|---------|------|-------------|
| Web (Next.js) | 22000 | Development |
| Director (deprecated) | 22001 | Development |
| Orchestrator (Express) | 22002 | Development |
| Orchestrator (Render) | 10000 | Production |

---

## External Service Integrations

| Service | Purpose | Package |
|---------|---------|---------|
| Clerk | Authentication + user management | `@clerk/nextjs` |
| Stripe | Payments + subscriptions | `stripe` |
| OpenAI | Script analysis, scoring, suggestions | `openai` via AI SDK |
| Groq | Fast LLM inference (fallback) | `@ai-sdk/groq` |
| ElevenLabs | Text-to-speech generation | REST API |
| Upstash Redis | Distributed rate limiting | `@upstash/ratelimit` |
| Sentry | Error monitoring + performance | `@sentry/nextjs` |
| Render.com | Hosting + managed PostgreSQL | IaC via `render.yaml` |
| Resend | Transactional email | `resend` |
