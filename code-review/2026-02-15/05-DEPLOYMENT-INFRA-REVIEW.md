# Deployment & Infrastructure Review

**Project:** Story Magic
**Date:** February 15, 2026
**Reviewer:** Chris Therriault
**Branch Under Review:** `feat/clerk-prisma-migration` (not yet merged; production deploys from `main`)

---

## Executive Summary

Story Magic deploys on Render.com as a two-service architecture (Next.js web + Express orchestrator) backed by Render PostgreSQL and Upstash Redis. The deployment configuration is well-structured with proper secret management (`sync: false`), health checks, and a comprehensive IaC blueprint. However, the review identified **17 findings** across database, monitoring, CI/CD, and resilience concerns. The most critical items are the hardcoded Sentry DSN in source files, the absence of connection pooling for the database, the 1GB disk limitation for audio storage, and missing `prisma migrate deploy` in the staging blueprint.

### Severity Distribution

| Severity | Count |
|----------|-------|
| Critical | 2 |
| High | 5 |
| Medium | 7 |
| Low | 3 |

### Total Estimated Effort: ~34 SP

---

## Findings

### INFRA-001: Sentry DSN Hardcoded as Fallback in Source Files

**Severity:** Critical
**Location:**
- `/packages/web/sentry.client.config.ts` line 4: `dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || 'https://b06f55eedd1ad8fdedc4cabc42c48c12@o4510606462550016.ingest.us.sentry.io/4510733770948608'`
- `/packages/web/sentry.server.config.ts` line 4: same pattern with `SENTRY_DSN`
- `/packages/web/sentry.edge.config.ts` line 4: same pattern
- `/packages/orchestrator/src/lib/sentry.ts` line 3: `const SENTRY_DSN = process.env.SENTRY_DSN || 'https://b06f55eedd1ad8fdedc4cabc42c48c12@...'`
**Effort:** 1 SP
**Risk:** The full Sentry DSN (including the project key `b06f55eedd1ad8fdedc4cabc42c48c12`) is committed to source control in 4 files. While Sentry DSNs are semi-public by design (client-side), this specific DSN appears in the orchestrator server code as well, and anyone with access to the repo can send arbitrary error events to the project, polluting monitoring data.

**Recommendation:** Remove the hardcoded fallback DSN from all four files. If the environment variable is not set, Sentry should be disabled (which the `enabled` flag already handles). Replace the fallback with an empty string or `undefined`:

```typescript
// Before
dsn: process.env.SENTRY_DSN || 'https://b06f55eedd...',

// After
dsn: process.env.SENTRY_DSN,
```

---

### INFRA-002: No Database Connection Pooling Configured

**Severity:** Critical
**Location:**
- `/packages/web/prisma/schema.prisma` lines 10-13: `datasource db` uses raw `DATABASE_URL` with no `directUrl` or connection limit
- `/render.yaml` lines 54-56 and 149-151: `DATABASE_URL` injected from Render DB reference
**Effort:** 3 SP
**Risk:** Both the web service and orchestrator share the same `DATABASE_URL` pointing directly to the Render PostgreSQL instance (basic-256mb plan, which supports approximately 20 concurrent connections). With two services connecting simultaneously, and Next.js potentially opening multiple connections per serverless function invocation, the connection pool can be exhausted under moderate load, causing `FATAL: too many connections` errors.

**Recommendation:**
1. Add a `directUrl` to the Prisma schema for migrations, and use a pooled connection string for runtime:
   ```prisma
   datasource db {
     provider   = "postgresql"
     url        = env("DATABASE_URL")
     directUrl  = env("DIRECT_URL")
     extensions = [pgvector(map: "vector"), pgcrypto]
   }
   ```
2. Consider Render's built-in connection pooler or use PgBouncer. Alternatively, add `?connection_limit=5` to the `DATABASE_URL` for each service to prevent one service from monopolizing connections.
3. The Supabase local config already defines a pooler (`packages/web/supabase/config.toml` line 38, `pool_mode = "transaction"`, `default_pool_size = 20`) but this is only for local dev. Ensure production uses equivalent pooling.

---

### INFRA-003: Staging Blueprint Missing `prisma migrate deploy`

**Severity:** High
**Location:**
- `/render-staging.yaml` lines 21-25: Build command does not include `prisma generate` or `prisma migrate deploy`
- Compare with `/render.yaml` lines 33-38: Production build command correctly includes both
**Effort:** 1 SP
**Risk:** Deploying to staging will fail or use stale database schema because `prisma generate` (needed for the Prisma client) and `prisma migrate deploy` (needed to apply pending migrations) are missing from the staging build command.

**Recommendation:** Update `/render-staging.yaml` build command to match production:

```yaml
buildCommand: |
  corepack enable &&
  corepack prepare pnpm@9.1.0 --activate &&
  pnpm install --frozen-lockfile &&
  cd packages/web && npx prisma generate && npx prisma migrate deploy && cd ../.. &&
  pnpm --filter @story-magic/web build
```

---

### INFRA-004: 1GB Persistent Disk May Be Insufficient for Audio

**Severity:** High
**Location:** `/render.yaml` lines 134-137:
```yaml
disk:
  name: audio-storage
  mountPath: /var/data/audio
  sizeGB: 1
```
**Effort:** 2 SP
**Risk:** A single 90-120 page screenplay produces roughly 60-90 minutes of audio. At 192kbps AAC (M4A), that is approximately 85-130 MB per final output, plus intermediate files (TTS segments, aligned tracks, mixed audio). With 1GB total disk, only 5-8 complete projects can be stored simultaneously before disk exhaustion. The orchestrator's `/health` endpoint reports disk stats (see `packages/orchestrator/src/lib/monitoring.ts` line 96), but there is no automated cleanup triggered on disk pressure.

**Recommendation:**
1. Increase disk to at least 5GB (`basic` disk pricing is $0.25/GB/month, so 5GB = ~$1.25/mo).
2. Implement an automated cleanup job that purges audio files older than N days or moves them to R2/S3 object storage.
3. Add a disk usage threshold alert (e.g., alert when >80% full) to the Checkly monitoring.

---

### INFRA-005: CI Pipeline Does Not Gate Render Deployments

**Severity:** High
**Location:**
- `/.github/workflows/ci.yml`: Runs lint, typecheck, unit tests, build, and E2E on push/PR
- `/render.yaml` line 29: `autoDeploy: true` on `main` branch
**Effort:** 3 SP
**Risk:** Render auto-deploys from `main` independently of GitHub Actions. If a developer pushes directly to `main` (bypassing PR), or if CI is still running when Render triggers, a broken build can reach production before tests complete. The CI pipeline and Render deployment are not synchronized.

**Recommendation:**
1. Disable `autoDeploy` in `render.yaml` and use Render's Deploy Hook triggered by a GitHub Actions step that runs only after all CI jobs pass:
   ```yaml
   deploy:
     name: Deploy to Render
     runs-on: ubuntu-latest
     needs: [lint-and-typecheck, unit-tests, build, e2e-tests]
     if: github.ref == 'refs/heads/main'
     steps:
       - run: curl -X POST "${{ secrets.RENDER_DEPLOY_HOOK_URL }}"
   ```
2. Alternatively, require PR merges to `main` (protect the branch) and rely on Render's auto-deploy, accepting the race window as low-risk for a small team.

---

### INFRA-006: No Database Backup Strategy for Render PostgreSQL

**Severity:** High
**Location:** `/render.yaml` lines 9-17: `plan: basic-256mb`
**Effort:** 2 SP
**Risk:** Render's `basic-256mb` PostgreSQL plan includes only **daily automatic backups with 7-day retention**. There is no point-in-time recovery (PITR) on basic plans. The deploy runbook (`/scripts/deploy-runbook.md` lines 190-194) references "Supabase point-in-time recovery" but the production database is now on Render PostgreSQL (per the Clerk/Prisma migration), not Supabase. The runbook is stale.

**Recommendation:**
1. Update `/scripts/deploy-runbook.md` to reflect Render PostgreSQL backup capabilities and limitations.
2. Add a scheduled `pg_dump` job (e.g., GitHub Actions cron or a Render cron job) that exports the database to R2/S3 daily for an independent backup.
3. For enterprise readiness, upgrade to `basic-1gb` ($20/mo) or higher which includes more storage headroom, or set up WAL-based streaming replication.

---

### INFRA-007: Orchestrator Dockerfile HEALTHCHECK Uses Hardcoded Port

**Severity:** Medium
**Location:** `/packages/orchestrator/Dockerfile` line 57:
```dockerfile
CMD curl -f http://localhost:22002/health || exit 1
```
But line 52-53 sets `ENV PORT=22002` while Render overrides PORT at runtime (line 146 of `render.yaml` sets `PORT=10000`).
**Effort:** 1 SP
**Risk:** The Dockerfile HEALTHCHECK will fail on Render because the orchestrator listens on port 10000 (Render's assigned port), but the HEALTHCHECK still curls port 22002. This only matters if the Docker image is used directly (not Render's native Node runtime), but creates confusion for local Docker usage vs. production.

**Recommendation:** Use the `$PORT` environment variable in the HEALTHCHECK:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1
```

---

### INFRA-008: Web Health Check Path Is Root `/` Instead of Dedicated Endpoint

**Severity:** Medium
**Location:** `/render.yaml` line 42: `healthCheckPath: /`
**Effort:** 2 SP
**Risk:** Using the root path `/` as the health check means Render considers the service healthy as long as the Next.js frontend renders the landing page. This does not verify database connectivity, Clerk auth service availability, or Stripe integration. A "healthy" service could have a broken database connection. The orchestrator, by contrast, has a proper `/health` endpoint that reports memory, disk, and monitoring status (`/packages/orchestrator/src/routes/health.ts` and `/packages/orchestrator/src/lib/monitoring.ts`).

**Recommendation:** Create a dedicated `/api/health` route in the Next.js app that checks:
- Database connection (Prisma `$queryRaw`SELECT 1``)
- Clerk service availability (optional, with timeout)
- Returns structured JSON similar to the orchestrator's health endpoint

Then update `render.yaml` line 42 to `healthCheckPath: /api/health`.

---

### INFRA-009: No `render-staging.yaml` Database Definition

**Severity:** Medium
**Location:** `/render-staging.yaml` (read first 30 lines): No `databases:` section defined
**Effort:** 1 SP
**Risk:** The staging blueprint does not provision its own database. The deploy runbook mentions "staging uses same DB" as production (`/scripts/deploy-runbook.md` line 24). Sharing a database between staging and production is dangerous -- a migration run on staging could corrupt production data or cause schema drift.

**Recommendation:** Add a `databases:` section to `render-staging.yaml` with a separate `story-magic-db-staging` instance. Use the `basic-256mb` plan ($7/mo) for cost efficiency.

---

### INFRA-010: Feature Flags Hardcoded as Environment Variables

**Severity:** Medium
**Location:** `/render.yaml` lines 96-105:
```yaml
- key: NEXT_PUBLIC_FF_STORY_SCORE
  value: "true"
- key: NEXT_PUBLIC_FF_STORY_ADVISER
  value: "true"
# ... 3 more flags
```
**Effort:** 3 SP
**Risk:** All five intelligence feature flags are hardcoded to `"true"` in the production blueprint. Changing a feature flag requires a code change to `render.yaml`, a commit, and a full redeploy. There is no way to toggle features without a deployment cycle.

**Recommendation:** For MVP this is acceptable. Post-launch, migrate to a feature flag service (LaunchDarkly, Flagsmith, or even a simple Upstash Redis key lookup) that allows runtime toggling without redeployment. The `platform_settings` table in the database (defined in migration `0001_init`, line 445) could serve as a simple database-backed feature flag store.

---

### INFRA-011: Smoke Test Script References Supabase Auth (Stale)

**Severity:** Medium
**Location:** `/scripts/smoke-test.sh` lines 438-486: Step 3 tests Supabase GoTrue signup endpoint
**Effort:** 2 SP
**Risk:** The project has migrated from Supabase Auth to Clerk (per the `feat/clerk-prisma-migration` branch). Once that branch merges, Step 3 of the smoke test will be testing a deprecated auth provider. The middleware at `/packages/web/middleware.ts` already uses `@clerk/nextjs/server` (line 1).

**Recommendation:** Update the smoke test to verify Clerk's auth flow instead. At minimum, test that the `/login` and `/signup` routes redirect to Clerk's hosted sign-in page (which the smoke test already partially covers in Step 7 by checking these routes return 200). Remove or replace the Supabase-specific auth test.

---

### INFRA-012: No `robots.txt` or Rate Limiting on Public Web Routes

**Severity:** Medium
**Location:**
- No `robots.txt` found in the web package
- Upstash Redis rate limiting configured for orchestrator but not verified for web API routes
**Effort:** 2 SP
**Risk:** Without `robots.txt`, search engines will crawl all public routes including dynamic ones. Without rate limiting on the web's API routes, the Next.js service is exposed to abuse (automated signups, project enumeration, etc.). The orchestrator has rate limiting via Upstash (configured in `render.yaml` lines 89-93 and 170-174), but there is no evidence of corresponding rate limiting on web API routes.

**Recommendation:**
1. Add a `public/robots.txt` to the Next.js app with appropriate directives.
2. Implement rate limiting middleware on `/api/*` routes using Upstash Redis (the credentials are already available to the web service).

---

### INFRA-013: CSP `unsafe-eval` in Production

**Severity:** Medium
**Location:** `/packages/web/middleware.ts` line 23:
```typescript
"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.accounts.dev https://*.clerk.com",
```
**Effort:** 3 SP
**Risk:** The Content Security Policy includes `'unsafe-eval'` which significantly weakens XSS protection. This is a common concession for development but should be tightened for production, especially given the enterprise/TPN compliance targets.

**Recommendation:** Investigate which dependency requires `unsafe-eval` (often it is a dev-mode React feature or a third-party library). In production builds, Next.js should not need `unsafe-eval`. Consider using a nonce-based CSP strategy for inline scripts and remove `unsafe-eval`.

---

### INFRA-014: Orchestrator Build Command Runs `prisma generate` from Web Package

**Severity:** Low
**Location:** `/render.yaml` lines 122-127:
```yaml
buildCommand: |
  ...
  cd packages/web && npx prisma generate && cd ../.. &&
  pnpm --filter @story-magic/orchestrator build
```
**Effort:** 1 SP
**Risk:** The orchestrator's build step generates the Prisma client from `packages/web/prisma/schema.prisma`. This works but creates a fragile cross-package dependency. If the web package's prisma schema changes location, the orchestrator build breaks. It also means the orchestrator ships with the full Prisma client even if it accesses the database through a different mechanism.

**Recommendation:** If the orchestrator needs direct database access via Prisma, consider extracting the Prisma schema into a shared `packages/db` package. If the orchestrator only needs the database for job queue operations, document this dependency explicitly.

---

### INFRA-015: No Automated Database Migration Rollback

**Severity:** Low
**Location:**
- `/packages/web/prisma/migrations/0001_init/migration.sql` (1814 lines)
- `/packages/web/prisma/migrations/0002_add_missing_columns/migration.sql` (20 lines)
**Effort:** 3 SP
**Risk:** Prisma migrations are forward-only by default. The `0001_init` migration is a massive 1814-line file that creates all tables, functions, triggers, views, and seed data in a single migration. If this migration partially fails in production, there is no automated rollback path. The deploy runbook (`/scripts/deploy-runbook.md` lines 190-194) acknowledges this limitation but references Supabase PITR which is no longer applicable.

**Recommendation:**
1. For future migrations, keep them small and incremental (the `0002` migration at 20 lines is a good example).
2. Create a `down.sql` companion for each critical migration to enable manual rollback.
3. Update the deploy runbook's database rollback section to reference Render PostgreSQL backup restoration instead of Supabase PITR.

---

### INFRA-016: No Staging-Specific Sentry Environment

**Severity:** Low
**Location:**
- `/packages/web/sentry.client.config.ts` line 14: `environment: process.env.NODE_ENV || 'development'`
- `/packages/orchestrator/src/lib/sentry.ts` line 8: same pattern
**Effort:** 1 SP
**Risk:** Sentry environment is set to `NODE_ENV` which will be `production` on both staging and production Render deployments. Staging errors will be mixed with production errors in Sentry, making it difficult to distinguish real production issues from staging test noise.

**Recommendation:** Add a `SENTRY_ENVIRONMENT` env var to both `render.yaml` and `render-staging.yaml`:
```yaml
# render.yaml
- key: SENTRY_ENVIRONMENT
  value: production

# render-staging.yaml
- key: SENTRY_ENVIRONMENT
  value: staging
```
Then use it in Sentry config: `environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development'`.

---

### INFRA-017: Docker Compose Orchestrator References Supabase Environment Variables

**Severity:** Low
**Location:** `/docker-compose.yml` lines 54-56:
```yaml
- SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
- SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
- SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
```
**Effort:** 1 SP
**Risk:** The docker-compose file still references Supabase environment variables for the orchestrator, but the Clerk/Prisma migration replaces Supabase auth with Clerk and database access with direct PostgreSQL via Prisma. These variables may no longer be needed or may cause confusion.

**Recommendation:** After the `feat/clerk-prisma-migration` branch merges, audit and update `docker-compose.yml` to replace Supabase references with `DATABASE_URL` pointing to the local PostgreSQL container and `CLERK_SECRET_KEY` for auth.

---

## Infrastructure Topology Summary

```
                    Internet
                       |
              +--------+--------+
              |                 |
     Render Web Service   Render Orchestrator
     (Next.js, $7/mo)    (Express, $25/mo)
     Port: 10000          Port: 10000
     Plan: starter        Plan: standard
     512MB / 0.5 CPU      2GB / 1 CPU
              |                 |
              +--------+--------+
                       |
              Render PostgreSQL
              (basic-256mb, $7/mo)
              256MB RAM / 1GB storage
                       |
              +--------+--------+
              |                 |
         Upstash Redis     Persistent Disk
         (Rate Limiting)   (1GB Audio Storage)
              |
           Sentry
         (Error Tracking)
              |
          Checkly
        (Heartbeat Monitoring)
```

**Monthly Infrastructure Cost:** ~$39/mo base (Web $7 + Orchestrator $25 + DB $7) + Upstash free tier + Sentry free tier + persistent disk included with standard plan.

---

## Prioritized Action Items

| Priority | Finding | Effort | Impact |
|----------|---------|--------|--------|
| 1 | INFRA-001: Remove hardcoded Sentry DSN | 1 SP | Prevents monitoring pollution |
| 2 | INFRA-002: Add connection pooling | 3 SP | Prevents production connection exhaustion |
| 3 | INFRA-003: Fix staging build command | 1 SP | Unblocks staging deployments |
| 4 | INFRA-005: Gate deploys on CI | 3 SP | Prevents broken builds reaching production |
| 5 | INFRA-006: Update backup strategy docs | 2 SP | Corrects stale runbook for Render DB |
| 6 | INFRA-008: Add web /api/health endpoint | 2 SP | Catches silent backend failures |
| 7 | INFRA-009: Add staging database | 1 SP | Prevents staging/production data collision |
| 8 | INFRA-004: Increase disk to 5GB | 2 SP | Prevents audio storage exhaustion |
| 9 | INFRA-011: Update smoke test for Clerk | 2 SP | Keeps integration tests current |
| 10 | INFRA-016: Add Sentry environment separation | 1 SP | Improves error triage |

---

## What Is Working Well

1. **Secret management:** All sensitive values use `sync: false` in `render.yaml` with clear documentation of what must be set in the Render dashboard (lines 197-227). No secrets are committed to source control (aside from the Sentry DSN noted in INFRA-001).

2. **Health endpoint design:** The orchestrator's `/health` endpoint (`/packages/orchestrator/src/lib/monitoring.ts`) returns comprehensive system status including memory usage, disk stats, uptime, and capability flags. This is production-grade observability.

3. **CI pipeline coverage:** The GitHub Actions workflow (`/.github/workflows/ci.yml`) runs lint, typecheck, unit tests (642 total), build verification, and Playwright E2E tests. The pipeline is well-structured with proper job dependencies.

4. **Deployment scripts:** The smoke test (`/scripts/smoke-test.sh`) and load test (`/scripts/load-test.sh`) are thorough, portable (minimal dependencies), and support multiple environments via CLI flags. The deploy runbook (`/scripts/deploy-runbook.md`) covers staging, production, rollback, and incident response.

5. **Security headers:** The Next.js middleware (`/packages/web/middleware.ts`) implements a comprehensive set of security headers including CSP, HSTS, X-Content-Type-Options, X-Frame-Options, and Permissions-Policy.

6. **Database schema quality:** The initial migration is comprehensive with proper indexing, foreign keys, stored functions for business logic (queue management, usage tracking), and triggers for automated workflows.
