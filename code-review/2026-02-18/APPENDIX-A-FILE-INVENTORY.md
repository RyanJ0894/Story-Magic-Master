# Appendix A: File Inventory

**Story Magic Code Review -- 18 February 2026**

---

## Summary Metrics

| Metric | Count |
|--------|-------|
| TypeScript source files (`.ts`) | 242 |
| React component files (`.tsx`) | 126 |
| Total source files (TS + TSX) | 368 |
| Lines of code (TS + TSX, excl. node_modules) | 69,663 |
| Web package LOC | 49,716 |
| Orchestrator package LOC | 19,947 |
| API routes (`route.ts`) | 58 |
| Pages (`page.tsx`) | 26 |
| Components (`.tsx` under `components/`) | 60 |
| Web lib modules (`lib/*.ts`) | 51 |
| Orchestrator source files (`src/*.ts`) | 79 |
| Test files (`.test.*` + `.spec.*`) | 76 |
| Web test files | 33 |
| Orchestrator test files | 43 |
| E2E test files | 5 |
| CSS files | 3 |
| JSON config files | 28 |
| Markdown docs | 18 |
| Prisma models | 23 |
| Prisma relations (`@relation`) | 47 |
| Prisma indexes (`@@index` + `@@unique`) | 65 |
| Prisma migration files (SQL) | 2 |
| `as any` occurrences | 2 |
| Zod schema files | 35 |
| Error boundary files (`error.tsx`) | 4 |

---

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend framework | Next.js | ^14.1.0 |
| UI library | React | ^18.2.0 |
| Styling | Tailwind CSS | ^3.4.0 |
| Component primitives | Radix UI | Multiple (^1.x - ^2.x) |
| Icons | Lucide React | ^0.309.0 |
| Authentication | Clerk (`@clerk/nextjs`) | ^6.37.3 |
| ORM | Prisma (`@prisma/client`) | ^6.19.2 |
| Database | PostgreSQL 16 | pgvector, pgcrypto extensions |
| Payments | Stripe (`stripe` SDK) | ^20.2.0 |
| Stripe client | `@stripe/stripe-js` | ^8.6.1 |
| Error monitoring | Sentry (`@sentry/nextjs`) | ^10.34.0 |
| Sentry (orchestrator) | `@sentry/node` | ^10.34.0 |
| TTS engine | ElevenLabs | via REST API |
| LLM (web) | OpenAI (`openai` SDK) | ^6.16.0 |
| LLM (orchestrator) | Vercel AI SDK (`ai`) | ^4.0.0 |
| LLM providers | `@ai-sdk/openai`, `@ai-sdk/groq`, `@ai-sdk/anthropic`, `@ai-sdk/google` | ^1.x - ^3.x |
| Rate limiting | Upstash (`@upstash/ratelimit`, `@upstash/redis`) | ^2.0.8, ^1.36.1 |
| Validation | Zod | ^3.25.76 (web), ^3.22.4 (orch) |
| Backend framework | Express | ^4.18.2 |
| Security middleware | Helmet | ^7.1.0 |
| Audio processing | FFmpeg (`ffmpeg-static`) | ^5.2.0 |
| Audio probing | `ffprobe-static` | ^3.1.0 |
| Process execution | `execa` | ^8.0.1 |
| Logging (orchestrator) | Pino | ^10.2.0 |
| Concurrency control | `p-limit` | ^5.0.0 |
| Forms | React Hook Form | ^7.71.1 |
| Form validation | `@hookform/resolvers` | ^5.2.2 |
| Charts | Recharts | ^3.7.0 |
| Code editor | CodeMirror 6 | ^6.0.2 |
| PDF generation | `@react-pdf/renderer` | ^4.3.2 |
| Email | Resend | ^6.8.0 |
| Email templates | `@react-email/components` | ^1.0.6 |
| Webhook verification | Svix | ^1.84.1 |
| Theme management | `next-themes` | ^0.4.6 |
| Toast notifications | Sonner | ^1.3.1 |
| Password hashing | bcrypt | ^6.0.0 |
| ID generation | nanoid | ^5.1.6 |
| API docs | swagger-ui-react | ^5.31.0 |
| Package manager | pnpm | 9.1.0 |
| Node.js | Node.js | >=20.0.0 |
| TypeScript | TypeScript | ^5.3.3 |
| Test framework | Vitest | ^4.0.17 |
| Test coverage | `@vitest/coverage-v8` | ^4.0.17 |
| Component testing | Testing Library (React) | ^16.3.2 |
| E2E testing | Playwright | ^1.40.0 |
| Mocking | MSW | ^2.12.7 |
| DOM simulation | happy-dom | ^20.6.0 |
| Build tool | Vite (via `@vitejs/plugin-react`) | ^5.1.2 |
| Deployment | Render.com | IaC via render.yaml |
| CI/CD | GitHub Actions | Custom workflow |

---

## Port Assignments

| Service | Port |
|---------|------|
| Web (Next.js) | 22000 |
| Orchestrator (Express) | 22002 (local), 10000 (Render) |
| PostgreSQL (Docker) | 5432 |
| Redis (Docker) | 6381 (host) -> 6379 (container) |

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
  audio-preview/[...path]/route.ts
  auth/signout/route.ts
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
  page.tsx                           (Landing)
  login/page.tsx                     (Sign In)
  login/sso-callback/page.tsx        (SSO Callback)
  signup/page.tsx                    (Sign Up)
  signup/sso-callback/page.tsx       (SSO Callback)
  dashboard/page.tsx                 (User Dashboard)
  projects/new/page.tsx              (New Project)
  projects/[id]/page.tsx             (Project Detail)
  billing/page.tsx                   (Billing Management)
  pricing/page.tsx                   (Pricing Page)
  guide/page.tsx                     (User Guide)
  docs/page.tsx                      (API Docs)
  privacy/page.tsx                   (Privacy Policy)
  terms/page.tsx                     (Terms of Service)
  share/[code]/page.tsx              (Share Access)
  s/[code]/page.tsx                  (Short Share Link)
  invite/[token]/page.tsx            (Team Invite)
  writer/dashboard/page.tsx          (Writer Dashboard)
  reader/dashboard/page.tsx          (Reader Dashboard)
  reader/upload/page.tsx             (Reader Upload)
  admin/page.tsx                     (Admin Dashboard)
  admin/users/page.tsx               (User Management)
  admin/subscriptions/page.tsx       (Subscription Management)
  admin/analytics/page.tsx           (Analytics Dashboard)
  admin/audit-log/page.tsx           (Audit Log Viewer)
  admin/settings/page.tsx            (Platform Settings)
```

### Authentication & Authorization

```
packages/web/middleware.ts                    (Clerk middleware, route protection, security headers)
packages/web/lib/api/middleware.ts            (withAuth, withProjectAuth wrappers)
packages/web/lib/csrf.ts                     (CSRF validation)
packages/web/lib/api/rate-limit.ts           (Tiered rate limiting)
packages/web/app/api/webhooks/clerk/route.ts (Clerk webhook handler)
packages/web/app/api/auth/signout/route.ts   (Sign out)
packages/web/components/auth/                (Auth UI components)
packages/orchestrator/src/middleware/auth.ts  (Orchestrator auth middleware)
```

### Database & ORM

```
packages/web/prisma/schema.prisma            (23 models, 696 lines)
packages/web/prisma/migrations/              (2 migration files)
packages/web/lib/db.ts                       (Prisma client singleton)
packages/web/lib/api/audit.ts               (Audit logging utility)
packages/web/lib/api/dto/index.ts           (Data transfer objects)
```

### Job Queue

```
packages/web/lib/queue/worker.ts             (Queue worker with lock renewal)
packages/web/lib/queue/service.ts            (Dequeue, lock, complete, fail operations)
packages/web/lib/queue/types.ts              (Queue type definitions)
packages/web/instrumentation.ts              (Worker startup in Next.js)
```

### Monitoring & Observability

```
packages/web/sentry.client.config.ts         (Client-side Sentry)
packages/web/sentry.server.config.ts         (Server-side Sentry)
packages/web/sentry.edge.config.ts           (Edge runtime Sentry)
packages/web/app/api/health/route.ts         (Web health endpoint)
packages/orchestrator/src/lib/sentry.ts      (Orchestrator Sentry)
packages/orchestrator/src/lib/monitoring.ts  (Checkly heartbeat, health data)
packages/orchestrator/src/lib/logger.ts      (Pino structured logging)
packages/web/lib/logger.ts                   (Web structured logging)
```

### Orchestrator Pipeline

```
packages/orchestrator/src/
  index.ts                                   (Express server entry)
  director/                                  (Script parsing, voice assignment, audio direction)
  orchestrator/                              (Audio generation pipeline)
  orchestrator/workers/                      (TTS, alignment, timeline, mixer workers)
  middleware/                                (Auth, rate limiting, CORS)
  lib/                                       (Env, logger, sentry, monitoring, cleanup)
```

### Deployment & Infrastructure

```
render.yaml                                  (Production IaC blueprint)
render-staging.yaml                          (Staging IaC blueprint)
docker-compose.yml                           (Local development stack)
.github/workflows/ci.yml                     (CI/CD pipeline)
scripts/smoke-test.sh                        (Pipeline smoke test)
scripts/deploy-runbook.md                    (Deployment runbook)
scripts/stripe-test-checklist.md             (Stripe verification)
scripts/load-test.sh                         (Load testing)
scripts/seed-corpus-embeddings.ts            (Corpus data seeding)
```

### Testing

```
packages/web/tests/unit/                     (28 unit test files)
packages/web/tests/                          (5 additional test files)
packages/web/e2e/                            (5 E2E test files)
packages/orchestrator/src/**/*.test.ts       (43 test files)
```

---

## Prisma Schema Summary

### Models (23)

| Model | Fields | Relations | Indexes | Purpose |
|-------|-------:|----------:|--------:|---------|
| Profile | 18 | 17 | 3 | User profiles (Clerk IDs) |
| Project | 14 | 13 | 3 | User projects/scripts |
| Job | 20 | 4 | 6 | Generation job queue |
| JobLog | 10 | 2 | 4 | Job execution logs |
| AudioOutput | 9 | 2 | 1 | Generated audio files |
| Usage | 7 | 1 | 2 | Billing period usage |
| Subscription | 14 | 1 | 1 | Stripe subscriptions |
| Purchase | 9 | 2 | 3 | One-time purchases |
| ScriptShare | 17 | 4 | 5 | Script sharing |
| ReaderLibrary | 14 | 3 | 4 | Reader's saved scripts |
| ContentAccessLog | 11 | 3 | 2 | Access tracking |
| StoryScore | 29 | 3 | 4 | AI story analysis scores |
| Suggestion | 17 | 3 | 6 | Script improvement suggestions |
| Rewrite | 7 | 1 | 1 | Suggested rewrites |
| Revision | 11 | 3 | 4 | Script revision tracking |
| ScriptCorpus | 14 | 1 | 2 | Comparable scripts (pgvector) |
| Team | 7 | 3 | 1 | Team/org groups |
| TeamMember | 12 | 3 | 4 | Team membership |
| TeamShare | 6 | 3 | 2 | Team-level sharing |
| Alert | 12 | 4 | 1 | User notifications |
| AlertPreference | 11 | 1 | 0 | Notification settings |
| AuditLog | 8 | 1 | 4 | Audit trail |
| PlatformSetting | 4 | 0 | 0 | Admin settings (KV) |

### Extensions

- `pgvector` -- Vector similarity search for comparable scripts
- `pgcrypto` -- UUID generation via `gen_random_uuid()`

---

## Dependency Security Overrides

From `package.json` `pnpm.overrides`:

| Package | Vulnerability Range | Fixed To |
|---------|-------------------|----------|
| `glob` | >=10.2.0 <10.5.0 | >=10.5.0 |
| `axios` | <=1.13.4 | >=1.13.5 |
| `jsondiffpatch` | <0.7.2 | >=0.7.2 |
| `qs` | >=6.7.0 <=6.14.1 | >=6.14.2 |
