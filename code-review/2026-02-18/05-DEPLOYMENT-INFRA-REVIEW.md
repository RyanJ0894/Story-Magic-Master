# Deployment & Infrastructure Review

**Project:** Story Magic
**Date:** February 18, 2026
**Reviewer:** Chris Therriault
**Branch Under Review:** `main` (production deployment branch)

---

## Executive Summary

Story Magic deploys on Render.com as a two-service architecture (Next.js web + Express orchestrator) backed by Render PostgreSQL and Upstash Redis. GitHub Actions CI runs lint, typecheck, unit tests, build, E2E, and then triggers Render deploys via webhook. The infrastructure configuration is mature: secrets are properly segregated (`sync: false`), builds use `--frozen-lockfile`, health checks are configured on both services, and Sentry monitoring covers client, server, and edge runtimes.

This review identified **14 findings**. The most significant concerns are: the deploy job does not gate on E2E tests passing, the web service lacks a `global-error.tsx` boundary, the CI pipeline has a hardcoded feature branch in its trigger list, and the Prisma schema includes `directUrl` but the production `render.yaml` does not supply the corresponding `DIRECT_DATABASE_URL` env var.

### Severity Distribution

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 4 |
| Medium | 6 |
| Low | 3 |

### Total Estimated Effort: ~28 SP

---

## Findings

### INFRA-001: Deploy Job Does Not Gate on E2E Tests

**Severity:** Critical
**Location:** `.github/workflows/ci.yml` lines 147-151
**Effort:** 1 SP

The `deploy` job depends only on `[build]`, not on `[build, e2e-tests]`. This means a commit to `main` can be deployed to Render even if E2E tests are failing. The E2E job runs in parallel but its outcome is not a prerequisite for deployment.

```yaml
deploy:
  name: Deploy to Render
  needs: [build]                    # <-- should include e2e-tests
  if: github.ref == 'refs/heads/main' ...
```

**Recommendation:** Change the deploy job dependency to `needs: [build, e2e-tests]`. If you want to allow deployment when E2E is skipped (e.g., on non-PR pushes), use `if: always() && needs.build.result == 'success' && (needs.e2e-tests.result == 'success' || needs.e2e-tests.result == 'skipped')`.

---

### INFRA-002: Hardcoded Feature Branch in CI Triggers

**Severity:** High
**Location:** `.github/workflows/ci.yml` lines 5, 151
**Effort:** 1 SP

The CI workflow triggers on both `main` and `feat/clerk-prisma-migration`. The deploy job also deploys when `github.ref == 'refs/heads/feat/clerk-prisma-migration'`. This appears to be leftover from the Clerk/Prisma migration work and should be removed to prevent accidental production deployments from stale branches.

```yaml
on:
  push:
    branches: [main, feat/clerk-prisma-migration]  # <-- remove feature branch
```

**Recommendation:** Remove `feat/clerk-prisma-migration` from both the `on.push.branches` trigger and the deploy job `if` condition. Feature branch deployments should use the staging pipeline (`render-staging.yaml`) instead.

---

### INFRA-003: Missing `DIRECT_DATABASE_URL` in Production render.yaml

**Severity:** High
**Location:** `packages/web/prisma/schema.prisma` line 13, `render.yaml`
**Effort:** 2 SP

The Prisma schema defines `directUrl = env("DIRECT_DATABASE_URL")` for direct (non-pooled) connections used during migrations, but the production `render.yaml` only provides `DATABASE_URL` (from the database reference). The staging blueprint correctly includes `DIRECT_DATABASE_URL` as a `sync: false` env var, but production does not.

Without `DIRECT_DATABASE_URL`, Prisma falls back to the pooled `DATABASE_URL` for migrations. This works today because there is no external pooler in front of Render's PostgreSQL, but will break if PgBouncer or Supavisor is added.

**Recommendation:** Add `DIRECT_DATABASE_URL` as a `sync: false` env var in `render.yaml` for the web service. Set it in the Render dashboard to the non-pooled connection string.

---

### INFRA-004: No `global-error.tsx` Boundary

**Severity:** High
**Location:** `packages/web/app/` (missing file)
**Effort:** 2 SP

Next.js provides a `global-error.tsx` file in the root app directory to catch errors that escape segment-level `error.tsx` boundaries, including errors in the root layout. The codebase has segment-level error boundaries at `/app/error.tsx`, `/app/dashboard/error.tsx`, `/app/projects/[id]/error.tsx`, and `/app/admin/error.tsx`, but the global error boundary is absent.

If the root layout (`layout.tsx`) itself throws, no error boundary will catch it and the user will see the default Next.js error page with no Sentry reporting.

**Recommendation:** Create `packages/web/app/global-error.tsx` that renders a minimal error UI and calls `Sentry.captureException(error)`. This is the last line of defense for the React error boundary chain.

---

### INFRA-005: Web Health Check Uses Root Path `/`

**Severity:** High
**Location:** `render.yaml` line 42
**Effort:** 2 SP

The web service's Render health check is configured as `healthCheckPath: /`, which serves the full Next.js landing page (HTML, SSR, data fetching). This is heavyweight for a health probe. A comprehensive `/api/health` endpoint already exists that checks database, auth, storage, OpenAI, ElevenLabs, and orchestrator connectivity, but Render is not using it.

Additionally, external API health checks (OpenAI, ElevenLabs) in `/api/health` could cause the health check to time out if those services are slow, which would cause Render to mark the instance as unhealthy.

**Recommendation:**
1. Change `healthCheckPath` to `/api/health` in `render.yaml`.
2. Split `/api/health` into a lightweight liveness probe (database-only, used by Render) and a detailed readiness probe (all services, used by operators). Alternatively, separate critical vs. non-critical checks in the response and only fail the HTTP status on critical checks (database, auth).

---

### INFRA-006: Queue Worker Runs Inside Next.js Process

**Severity:** Medium
**Location:** `packages/web/instrumentation.ts` lines 7-12
**Effort:** 5 SP

The job queue worker starts inside the Next.js server process via the `register()` instrumentation hook. This means background job processing shares memory and CPU with the web server. A long-running audio generation job (which calls the orchestrator, processes results, writes to the database) could impact web server responsiveness.

```typescript
if (process.env.DATABASE_URL) {
  const { startWorker } = await import('./lib/queue/worker');
  startWorker({ pollIntervalMs: 5000, lockDurationSeconds: 600 });
}
```

The worker uses lock-based dequeuing and graceful shutdown, which is well-implemented. However, the `QUEUE_CONCURRENCY` default of 3 means up to 3 jobs can run simultaneously inside the web process.

**Recommendation:** For MVP this is acceptable. For production scale, extract the worker into a separate Render background worker service (`type: worker` in `render.yaml`). This isolates job processing from web request handling and allows independent scaling.

---

### INFRA-007: No Build Cache in CI Pipeline

**Severity:** Medium
**Location:** `.github/workflows/ci.yml`
**Effort:** 2 SP

While the CI pipeline caches pnpm dependencies via `actions/setup-node@v4` with `cache: 'pnpm'`, it does not cache the Next.js build output or Prisma generated client. Each CI run rebuilds from scratch. For a project of this size (~70k LOC), the build step takes meaningful time.

**Recommendation:** Add Next.js build cache:
```yaml
- uses: actions/cache@v4
  with:
    path: packages/web/.next/cache
    key: nextjs-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-${{ hashFiles('packages/web/**/*.ts', 'packages/web/**/*.tsx') }}
    restore-keys: nextjs-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-
```

---

### INFRA-008: Orchestrator Build Generates Prisma Client from Web Package

**Severity:** Medium
**Location:** `render.yaml` lines 142-147
**Effort:** 2 SP

The orchestrator build command includes `cd packages/web && npx prisma generate && cd ../..`. This means the orchestrator depends on the web package's Prisma schema. While this works (both services share the same database), it creates a coupling where changes to the web package's schema require the orchestrator to rebuild.

The orchestrator currently imports `@prisma/client` for some operations, sharing the web package's generated client. This is a reasonable pattern for a monorepo, but should be documented.

**Recommendation:** Add a comment in `render.yaml` documenting this cross-package dependency. Consider moving the Prisma schema to a shared `packages/database` package if more services are added in the future.

---

### INFRA-009: Docker Compose Orchestrator Uses Different Port Than Render

**Severity:** Medium
**Location:** `docker-compose.yml` line 48 vs. `render.yaml` line 166
**Effort:** 1 SP

The Docker Compose configuration sets the orchestrator port to `22002`, while the Render configuration uses `PORT=10000`. While Render always overrides the port, the discrepancy between local and production port configuration could cause confusion.

The orchestrator uses `getEnv().PORT` which defaults to `22002`, so Render's `PORT=10000` override works correctly. However, developers debugging production issues may assume port 22002 when the actual port is 10000.

**Recommendation:** Document the port difference in the README or add a comment in `render.yaml`.

---

### INFRA-010: Sentry Replay Unmasked in Client Config

**Severity:** Medium
**Location:** `packages/web/sentry.client.config.ts` lines 20-23
**Effort:** 1 SP

Session Replay is configured with `maskAllText: false` and `blockAllMedia: false`. For an enterprise product handling screenplay content (potentially unpublished scripts), replaying user sessions with full text visibility could expose sensitive intellectual property.

```typescript
integrations: [
  Sentry.replayIntegration({
    maskAllText: false,    // Exposes screenplay content in replays
    blockAllMedia: false,
  }),
],
```

**Recommendation:** Set `maskAllText: true` and `blockAllMedia: true`, then selectively unmask non-sensitive elements using Sentry's `data-sentry-unmask` attribute. For TPN/MPAA compliance, session replays containing script content are a significant concern.

---

### INFRA-011: No Staging Database Defined in render-staging.yaml

**Severity:** Medium
**Location:** `render-staging.yaml`
**Effort:** 1 SP

The staging blueprint does not include a `databases:` section. The `DATABASE_URL` is set via `sync: false` (manual dashboard entry). While this works, it means the staging database must be provisioned manually outside of the IaC blueprint.

The production `render.yaml` defines the database as part of the blueprint, which is more reproducible.

**Recommendation:** Add a `databases:` section to `render-staging.yaml` for full IaC consistency, or add a comment explaining that the staging database is provisioned separately.

---

### INFRA-012: No Orchestrator Build Verification in CI

**Severity:** Low
**Location:** `.github/workflows/ci.yml` lines 74-101
**Effort:** 2 SP

The CI `build` job only builds the web package (`pnpm --filter @story-magic/web build`). The orchestrator's TypeScript is type-checked, linted, and tested, but the actual `tsc` build output is never verified in CI.

**Recommendation:** Add `pnpm --filter @story-magic/orchestrator build` to the CI build job.

---

### INFRA-013: Deploy Hooks Have No Verification Step

**Severity:** Low
**Location:** `.github/workflows/ci.yml` lines 153-163
**Effort:** 3 SP

The deploy step fires Render deploy hooks via `curl -s` but does not verify whether the deployment succeeded. If the hook URL is invalid, expired, or the deployment fails on Render, the CI pipeline still reports success.

```yaml
- name: Deploy Web
  run: curl -s "${{ secrets.RENDER_DEPLOY_HOOK_WEB }}"
```

**Recommendation:** After triggering the deploy hook, add a step that polls the Render API (or uses `gh` to check deployment status) to verify the deployment completed successfully. Alternatively, use the Render GitHub integration for deploy status checks.

---

### INFRA-014: Audio Storage Disk Size May Be Insufficient

**Severity:** Low
**Location:** `render.yaml` lines 154-157
**Effort:** 1 SP

The orchestrator's persistent disk is 5GB. Audio files for a 90-120 page screenplay can be 500MB-1GB per project (WAV intermediates, final M4A/MP3). With concurrent users, this disk can fill up quickly.

The orchestrator has a cleanup mechanism (`getDiskUsage` in monitoring), but the threshold and behavior should be verified.

**Recommendation:** Monitor disk usage via the health endpoint and set up an alert when usage exceeds 80%. Consider a cleanup cron that removes intermediate WAV files after final export, or increase disk size to 10GB.

---

## Summary Table

| ID | Severity | SP | Description | File:Line |
|----|----------|---:|-------------|-----------|
| INFRA-001 | Critical | 1 | Deploy job does not gate on E2E tests | `.github/workflows/ci.yml:147` |
| INFRA-002 | High | 1 | Hardcoded feature branch in CI triggers | `.github/workflows/ci.yml:5` |
| INFRA-003 | High | 2 | Missing DIRECT_DATABASE_URL in production render.yaml | `render.yaml` |
| INFRA-004 | High | 2 | No global-error.tsx boundary | `packages/web/app/` |
| INFRA-005 | High | 2 | Web health check uses root path instead of /api/health | `render.yaml:42` |
| INFRA-006 | Medium | 5 | Queue worker runs inside Next.js process | `packages/web/instrumentation.ts:7` |
| INFRA-007 | Medium | 2 | No build cache in CI pipeline | `.github/workflows/ci.yml` |
| INFRA-008 | Medium | 2 | Orchestrator build depends on web Prisma schema | `render.yaml:145` |
| INFRA-009 | Medium | 1 | Docker Compose and Render use different ports | `docker-compose.yml:48` |
| INFRA-010 | Medium | 1 | Sentry Replay exposes screenplay text | `packages/web/sentry.client.config.ts:21` |
| INFRA-011 | Medium | 1 | No staging database in IaC blueprint | `render-staging.yaml` |
| INFRA-012 | Low | 2 | No orchestrator build verification in CI | `.github/workflows/ci.yml:99` |
| INFRA-013 | Low | 3 | Deploy hooks have no verification step | `.github/workflows/ci.yml:153` |
| INFRA-014 | Low | 1 | Audio storage disk size may be insufficient | `render.yaml:157` |
