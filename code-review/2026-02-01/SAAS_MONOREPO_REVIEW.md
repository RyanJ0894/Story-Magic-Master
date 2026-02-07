# SaaS Monorepo Code Review
**Date:** February 1, 2026
**Location:** `/story-magic/` (pnpm workspace)
**LOC:** ~27,000+ across 150+ files
**Status:** Production-ready with minor adjustments

---

## Monorepo Structure

```
story-magic/
├── packages/
│   ├── orchestrator/     # Consolidated Director + Orchestrator (TypeScript)
│   └── web/              # Next.js 14 frontend
├── docker-compose.yml    # Local dev: PostgreSQL, Redis, Orchestrator
├── render.yaml           # Render.com IaC deployment
├── pnpm-workspace.yaml   # Workspace config
└── package.json          # Root scripts
```

- **Runtime:** Node 20+, pnpm 9.1.0
- **Orchestrator port:** 22002
- **Web port:** 22000

---

## packages/orchestrator (Consolidated Service)

### Architecture: 9/10

Single Express service consolidating both Director and Orchestrator pipelines:

```
POST /generate-scenes  →  Director Pipeline (script → director JSON)
POST /orchestrate      →  Full Pipeline (script → mixed audio)
POST /preview          →  Preview Pipeline (lightweight preview)
POST /analyze          →  Script Analysis (scoring)
```

### Key Improvements Over Prototypes

| Feature | Prototype | Monorepo |
|---------|-----------|----------|
| Language | Python + JavaScript | TypeScript (strict) |
| Auth | None | Supabase JWT + service keys |
| Rate Limiting | None | Upstash Redis (dual-tier: 10/min standard, 3/min expensive) |
| Validation | Manual | Zod schemas at all boundaries |
| Logging | console.log | Pino (structured JSON) |
| Monitoring | None | Sentry + Checkly heartbeat |
| Error Handling | Basic try/catch | Sanitized responses, error context |
| Config | Hardcoded | Zod-validated env (24 variables) |

### Auth Implementation
- Supabase JWT verification via `authMiddleware`
- `optionalAuthMiddleware` for public endpoints
- Service-to-service auth via `X-Service-Key` header
- Feature flag `AUTH_DISABLED=true` for testing

### Rate Limiting
- **Standard tier:** 10 requests/minute (analysis, preview)
- **Strict tier:** 3 requests/minute (generate, orchestrate)
- Redis-backed (Upstash) with in-memory fallback
- Proper `X-RateLimit-*` and `Retry-After` headers

### Code Quality Issues
1. **Diagnostic logs in production:** `tts.ts` has "DIAGNOSTIC" console.log markers
2. **`noUnusedLocals: false`** in tsconfig allows dead code
3. **Error response shapes inconsistent** across routes

### Test Coverage
- 13 test files covering: embedding store, voice search, FFmpeg validation, idempotency, retry, timeline, alignment, cues, mixer, schemas, health
- **Missing:** Full pipeline integration tests, E2E tests

---

## packages/web (Next.js 14 Frontend)

### Architecture: 8/10

Full-featured React application with App Router:

```
app/
├── (public)/         # /guide, /pricing, /docs
├── auth/             # /auth/callback
├── dashboard/        # Protected: project list, stats
├── projects/[id]/    # Project workspace
├── admin/            # Admin panel
└── api/              # 30+ API routes
```

### Features Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| Script Upload (PDF, TXT, FDX) | Done | All formats working |
| Scene Parsing | Done | Automatic extraction |
| Voice Assignment (AI) | Done | Semantic search |
| Audio Generation | Done | ElevenLabs via orchestrator |
| Project Dashboard | Done | Full CRUD |
| User Authentication | Done | Supabase Auth + SSR |
| Stripe Payments | Done | Subscriptions + usage tracking |
| Sharing (API) | Done | Share links with codes |
| Revision History | Partial | Compare view, DiffView component |
| StoryScore | Partial | Endpoints exist, UI incomplete |
| Story-Adviser | Partial | Schema exists, generation missing |
| Voice Override | Partial | UI exists, API not wired |

### 30+ API Routes

Key endpoints:
- `/api/generate` — Trigger audio generation job
- `/api/preview` — Quick audio preview
- `/api/projects/[id]/score` — Run script analysis
- `/api/projects/[id]/voice-assignments` — Set character voices
- `/api/projects/[id]/audio-overrides` — Override music/SFX
- `/api/jobs/[id]` — Job status and cancellation
- `/api/revisions/[id]` — Version management
- `/api/shares/[code]` — Share link access
- `/api/stripe/webhook` — Subscription events
- `/api/suggestions/[id]` — AI improvement suggestions

### Security: 7/10

**Strengths:**
- Supabase JWT + SSR cookies
- CSRF token validation on POST endpoints
- Prompt injection sanitization (filters "ignore previous instructions", system tags)
- Script size limits (500KB, 150 pages)
- CSP headers with nonce support
- HSTS, X-Frame-Options, Referrer-Policy
- Permissions policy (camera, mic, geolocation disabled)

**Weaknesses:**
- CSP includes `unsafe-inline` + `unsafe-eval` (needed for Next.js dev)
- No explicit file type validation on upload
- Some error messages may leak system details
- Service keys in `.env` could leak via source maps

### Database Schema (Supabase)

10+ migrations covering:
- `profiles`, `projects`, `jobs`, `usage` (core)
- `shares`, `subscriptions` (monetization)
- `story_scores`, `suggestions` (intelligence)
- `audio_overrides`, `preview_usage` (features)
- `job_logs`, `job_queue` (operations)

### Components

**UI (Radix UI wrappers):** Button, Card, Dialog, Dropdown, Input, Label, Radio, Select, Separator, Tabs, Toast

**Domain:**
- ScriptEditor (Monaco/CodeMirror with validation)
- ScriptSyncPlayer (audio player with timeline sync)
- StoryScore (analysis visualization)
- StoryAdviser (AI suggestions panel)
- DiffView (revision comparison)
- ComparableCard (analysis comparables)
- FeedbackModal, RewriteModal, AlertsDropdown

### Testing
- 14 test files (Vitest + Playwright)
- Unit tests with MSW for API mocking
- **Missing:** Critical path E2E (generate → progress → download)

---

## Infrastructure

### Docker Compose (Local Dev)
```yaml
postgres:16    # Database
redis:7        # Rate limiting, caching
orchestrator   # Consolidated service
```

### Render.com (Production)
```yaml
Web Service:        Next.js on starter plan ($7/mo)
Orchestrator:       Node.js on starter plan ($7/mo) + 1GB disk
```

**Risk:** Starter plan (512MB RAM) may be tight for FFmpeg + parallel TTS. Monitor and upgrade to standard (2GB) if OOM occurs.

### Environment Variables (24 total)
**Required:** Supabase credentials, OpenAI/Groq key, ElevenLabs key
**Optional:** Upstash Redis, Sentry DSN, Checkly URL, feature flags

---

## Deployment Readiness: 8/10

**Ready:**
- Build scripts defined
- Health checks configured
- Secrets management (not in code)
- Docker for local validation
- Render.yaml IaC complete

**At Risk:**
1. Memory constraints (512MB starter plan)
2. Disk cleanup not automated (1GB allocation)
3. Supabase RLS policies need verification
4. No load testing performed

---

## Technical Debt

| ID | Issue | Severity | Effort |
|----|-------|----------|--------|
| SM-01 | Diagnostic logs in tts.ts | Medium | 1h |
| SM-02 | Missing E2E pipeline tests | High | 16h |
| SM-03 | Voice override API not wired | High | 3h |
| SM-04 | Public share page missing | Critical | 4h |
| SM-05 | Inconsistent error response shapes | Medium | 4h |
| SM-06 | No automated file cleanup | High | 4h |
| SM-07 | CSP unsafe-inline in production | Medium | 4h |
| SM-08 | API documentation (OpenAPI/Swagger) | Medium | 8h |
| SM-09 | StoryScore UI incomplete | Medium | 10h |
| SM-10 | Story-Adviser generation missing | Medium | 10h |
