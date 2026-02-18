# 09 - Feature Completeness Audit

**Date:** 2026-02-18
**Reviewer:** Chris Therriault / Claude Opus 4.6
**Scope:** `packages/web/` (Next.js 14) + `packages/orchestrator/` (Express)
**Prisma Schema:** 695 lines, 20 models | **API Routes:** 58 | **Pages:** 26

---

## Table of Contents

1. [TODO/FIXME/HACK Comments](#1-todofixmehack-comments)
2. [Stub Implementations](#2-stub-implementations)
3. [Incomplete CRUD Operations](#3-incomplete-crud-operations)
4. [Orphan API Endpoints](#4-orphan-api-endpoints)
5. [Orphan Frontend Calls](#5-orphan-frontend-calls)
6. [Unused Prisma Models](#6-unused-prisma-models)
7. [Feature Flags](#7-feature-flags)
8. [Dead Routes / Pages](#8-dead-routes--pages)
9. [Summary](#9-summary)

---

## 1. TODO/FIXME/HACK Comments

Only three source hits for TODO/FIXME/HACK markers across both packages. All three are in the orchestrator's director-validator module and relate to detecting placeholder voice IDs -- they are intentional validation logic, not incomplete work.

### FC-001 | LOW | Director validator TODO regex

**File:** `packages/orchestrator/src/director/validation/director-validator.ts:30`
```ts
/^TODO/i,
```
**Context:** This is a regex pattern used to *detect* placeholder voice IDs prefixed with "TODO". It is part of the validation pipeline, not a to-do item itself. The corresponding test at `director-validator.test.ts:172-182` confirms this is working as designed.

**SP Estimate:** 0 SP
**Recommendation:** No action needed. The code is functioning correctly as a validation rule.

---

## 2. Stub Implementations

### FC-002 | HIGH | Score generation queue processor not implemented

**File:** `packages/web/lib/queue/worker.ts:380-382`
```ts
registerProcessor('score_generation', async (job, context) => {
  throw new Error('Score generation processor not implemented');
});
```
**Context:** The `score_generation` job type is registered in the worker but immediately throws. The StoryScore feature has a working synchronous API endpoint (`/api/projects/[id]/score` POST) that calls `ScoringService.generateScore()` directly, but the async queue path is not wired up. This means StoryScore generation cannot be offloaded to background workers.

**SP Estimate:** 3 SP
**Recommendation:** Implement the processor to call `ScoringService.generateScore()` with proper error handling and progress reporting, or remove the registration if async scoring is not planned for MVP.

---

### FC-003 | HIGH | Suggestion generation queue processor not implemented

**File:** `packages/web/lib/queue/worker.ts:384-387`
```ts
registerProcessor('suggestion_generation', async (job, context) => {
  throw new Error('Suggestion generation processor not implemented');
});
```
**Context:** Same pattern as FC-002. The Story-Adviser feature has synchronous API endpoints but the async queue processor is a stub. If a user queues a suggestion_generation job, it will fail immediately.

**SP Estimate:** 3 SP
**Recommendation:** Implement the processor to call `AdviserService.generateSuggestions()`, or remove the registration to prevent false job acceptance.

---

### FC-004 | MEDIUM | Stripe subscription sync is a stub

**File:** `packages/web/app/api/admin/subscriptions/[subscriptionId]/route.ts:158-165`
```ts
note: 'Stripe sync stub - actual Stripe API integration pending',
// ...
message: 'Sync attempted (stub). Stripe integration pending.',
```
**Context:** The admin POST endpoint for syncing a subscription with Stripe does not actually call the Stripe API. It creates an audit log entry and returns a success message with a stub disclaimer. The core Stripe checkout and webhook flows work, but manual admin sync is non-functional.

**SP Estimate:** 3 SP
**Recommendation:** Implement Stripe API call using `stripe.subscriptions.retrieve()` to pull current status and update the local record. This is needed for admin troubleshooting.

---

### FC-005 | MEDIUM | Admin settings page is non-functional UI

**File:** `packages/web/app/admin/settings/page.tsx:58`
```tsx
<Button disabled title="Settings management coming in a future release">Save Changes</Button>
```
**Context:** The entire admin settings page renders forms for General, Security, Email, Notifications, Billing, and API settings, but every "Save Changes" button is disabled with a tooltip "Settings management coming in a future release." The `PlatformSetting` model and `/api/admin/settings` route (GET + PUT) exist but are not wired to this UI.

**SP Estimate:** 5 SP
**Recommendation:** Wire the settings form to the existing `/api/admin/settings` API route using client-side state and form submission, or add a clear "Coming Soon" banner and remove the misleading form fields.

---

## 3. Incomplete CRUD Operations

Analysis of each major entity's Create, Read, Update, Delete coverage:

### FC-006 | LOW | Teams: No Update or Delete for team itself

**Routes:**
- `GET /api/teams` -- List teams
- `POST /api/teams` -- Create team
- `GET /api/teams/[teamId]/members` -- List members
- `POST /api/teams/[teamId]/members` -- Invite member
- `DELETE /api/teams/[teamId]/members` -- Remove member

**Missing:** No `PATCH /api/teams/[teamId]` (update team name/settings) and no `DELETE /api/teams/[teamId]` (delete team). No `/api/teams/[teamId]/route.ts` file exists.

**SP Estimate:** 3 SP
**Recommendation:** Add `PATCH` and `DELETE` handlers in a new `packages/web/app/api/teams/[teamId]/route.ts` file. Team owners need the ability to rename teams and delete them.

---

### FC-007 | LOW | Audio Outputs: No dedicated CRUD API

**Current state:** AudioOutput records are created internally by the generation pipeline and read via project/library endpoints. There is no dedicated `/api/audio-outputs` endpoint for listing, updating metadata, or deleting individual outputs.

**Missing:** No standalone Read (list by project), Update (rename), or Delete endpoint for audio outputs.

**SP Estimate:** 2 SP
**Recommendation:** For MVP, the implicit CRUD via project deletion (cascade) is adequate. Post-launch, add a `DELETE /api/projects/[id]/audio/[outputId]` for selective cleanup.

---

### FC-008 | LOW | Subscriptions: No user-facing Delete

**Current state:** Subscriptions are managed via Stripe portal redirect (`/api/stripe/portal`). Admin has list + individual GET + sync stub. No direct cancellation endpoint exists outside Stripe's hosted portal.

**Missing:** No `DELETE /api/subscriptions/[id]` or cancel endpoint.

**SP Estimate:** 1 SP
**Recommendation:** Acceptable for MVP -- Stripe portal handles cancellation. Document this in admin runbook.

---

### FC-009 | LOW | Alerts: No Delete endpoint

**Routes:**
- `GET /api/alerts` -- List alerts
- `PATCH /api/alerts` -- Mark as read / mark all as read

**Missing:** No `DELETE /api/alerts` or `DELETE /api/alerts/[id]` for clearing old alerts.

**SP Estimate:** 1 SP
**Recommendation:** Add a `DELETE` handler to `/api/alerts/route.ts` that supports deleting individual alerts or clearing all read alerts. Low priority for MVP.

---

### Projects, Jobs, Shares, Reader Library, Revisions, Suggestions -- CRUD is complete or adequate for current use cases. No findings.

---

## 4. Orphan API Endpoints

API routes that exist but are not called from any frontend component or page.

### FC-010 | MEDIUM | Admin API routes bypassed by server components

The following API routes exist but are never called from the frontend. Admin pages use server-side Prisma queries directly instead:

| Route | Methods | Admin Page Uses |
|-------|---------|----------------|
| `/api/admin/audit-logs` | GET | `admin/audit-log/page.tsx` calls `prisma.auditLog.findMany()` directly |
| `/api/admin/stats` | GET | `admin/page.tsx` calls `prisma.profile.count()` etc. directly |
| `/api/admin/subscriptions` | GET, PATCH | `admin/subscriptions/page.tsx` calls `prisma.subscription.findMany()` directly |
| `/api/admin/subscriptions/[id]` | GET, POST | Not referenced from any page |
| `/api/admin/users` | GET, PATCH | `admin/users/page.tsx` calls `prisma.profile.findMany()` directly |
| `/api/admin/users/[userId]` | GET, PATCH | Not referenced from any page |
| `/api/admin/corpus/populate` | POST | Not referenced from any page |

**SP Estimate:** 2 SP
**Recommendation:** These routes may be intended for a future client-side admin experience or external API consumers. For now, either (a) document them as internal/future endpoints, or (b) remove them to reduce attack surface. The `admin/corpus/populate` route is particularly notable -- it has no UI trigger at all.

---

### FC-011 | LOW | Queue status endpoint has no frontend consumer

**Route:** `GET /api/queue/status`
**Context:** Exposes worker queue metrics. Not referenced from any page or component. Likely intended for monitoring/ops dashboards.

**SP Estimate:** 0 SP
**Recommendation:** Keep for operational monitoring. Document in ops runbook.

---

### FC-012 | LOW | Health endpoint not called from frontend

**Route:** `GET /api/health`
**Context:** Standard health check endpoint for load balancer / uptime monitoring. Not expected to be called from frontend.

**SP Estimate:** 0 SP
**Recommendation:** No action needed. This is an infrastructure endpoint.

---

### FC-013 | LOW | Auth signout route unused

**Route:** `POST /api/auth/signout`
**Context:** The frontend uses Clerk's `useClerk().signOut()` method directly (see `components/auth/sign-out-button.tsx`), bypassing this API route entirely.

**SP Estimate:** 1 SP
**Recommendation:** Remove the route if Clerk handles signout client-side, or keep if server-side session cleanup is needed.

---

## 5. Orphan Frontend Calls

Frontend `apiFetch()` or `fetch()` calls that target non-existent API routes.

### FC-014 | HIGH | `/api/jobs/[id]/status` route does not exist

**File:** `packages/web/components/reader/upload-client.tsx:190`
```ts
const statusResponse = await apiFetch(`/api/jobs/${jobId}/status`);
const { status, progress, message } = await statusResponse.json();
```
**Context:** The reader upload flow polls `/api/jobs/${jobId}/status` to check job progress after initiating upload processing. However, no `/api/jobs/[id]/status/route.ts` file exists. The existing `/api/jobs/[id]/route.ts` (GET) returns job details including status, but the frontend is calling a `/status` sub-path that will return a 404.

**SP Estimate:** 2 SP
**Recommendation:** Either (a) create `/api/jobs/[id]/status/route.ts` that returns a lightweight `{ status, progress, message }` response, or (b) update the frontend to call `/api/jobs/${jobId}` and extract status from the full response.

---

### FC-015 | HIGH | `/api/shares/access/[code]/play` route does not exist

**File:** `packages/web/app/s/[code]/page.tsx:169`
```ts
await apiFetch(`/api/shares/access/${code}/play`, {
  method: 'POST',
});
```
**Context:** The share playback page attempts to POST to `/api/shares/access/${code}/play` to increment the play counter. No `/api/shares/access/[code]/play/route.ts` exists. The play count tracking (referenced in the share access route's `maxPlays` check) will never increment, meaning `maxPlays` limits are non-functional.

**SP Estimate:** 2 SP
**Recommendation:** Create `/api/shares/access/[code]/play/route.ts` with a POST handler that increments `playCount` on the ScriptShare record and creates a ContentAccessLog entry.

---

## 6. Unused Prisma Models

Models defined in `packages/web/prisma/schema.prisma` with zero or near-zero references in application source code.

### FC-016 | MEDIUM | `PlatformSetting` model referenced only in admin settings API

**Model:** `PlatformSetting` (schema.prisma:688-695)
**References:** Only in `/api/admin/settings/route.ts` (GET + PUT). The admin settings page UI is non-functional (FC-005). No other code reads from `PlatformSetting`.

**SP Estimate:** 0 SP (addressed by FC-005)
**Recommendation:** Wire the admin settings UI to the API, or document as planned for post-MVP.

---

### FC-017 | MEDIUM | `AlertPreference` model has zero application references

**Model:** `AlertPreference` (schema.prisma:643-661)
**References:** Zero references in any `.ts` or `.tsx` file outside the schema. No API route reads or writes alert preferences. No UI for managing notification settings exists.

**SP Estimate:** 3 SP
**Recommendation:** Create `/api/alerts/preferences/route.ts` (GET + PUT) and a notification preferences UI in the user settings area. Without this, the `emailTeamInvites`, `emailScriptShared`, etc. columns serve no purpose.

---

### FC-018 | LOW | `ContentAccessLog` model has minimal references

**Model:** `ContentAccessLog` (schema.prisma:338-360)
**References:** 1 reference in application code. The model exists for content access auditing but is lightly used. Access logs are not being written on most content access events.

**SP Estimate:** 2 SP
**Recommendation:** Ensure ContentAccessLog entries are created on share access, audio playback, and download events. This is important for the enterprise audit trail requirement.

---

## 7. Feature Flags

Six feature flags defined in `packages/web/lib/features/flags.tsx`. All default to `false` (disabled).

### FC-019 | MEDIUM | STORY_SCORE feature flag -- backend complete, gated by flag

**Flag:** `NEXT_PUBLIC_FF_STORY_SCORE`
**Default:** `false`
**Status:** Backend fully implemented (`lib/scoring/service.ts`, `/api/projects/[id]/score` route, `StoryScore` Prisma model). Frontend component exists (`components/storyscore/StoryScore.tsx`). Feature is complete but hidden behind feature flag.

**SP Estimate:** 0 SP to enable
**Recommendation:** Enable for staging testing. Add to `.env.staging` as `NEXT_PUBLIC_FF_STORY_SCORE=true`.

---

### FC-020 | MEDIUM | STORY_ADVISER feature flag -- backend complete, gated by flag

**Flag:** `NEXT_PUBLIC_FF_STORY_ADVISER`
**Default:** `false` (also depends on `STORY_SCORE`)
**Status:** Backend implemented (`lib/adviser/service.ts`, suggestion + rewrite API routes). Frontend component exists (`components/story-adviser/StoryAdviser.tsx`, `RewriteModal.tsx`). Queue processor is a stub (FC-003), but synchronous path works.

**SP Estimate:** 0 SP to enable (3 SP for queue processor)
**Recommendation:** Enable for staging after STORY_SCORE. Async queue processor (FC-003) is optional for MVP.

---

### FC-021 | MEDIUM | REVISION_TRACKING feature flag -- backend complete, gated by flag

**Flag:** `NEXT_PUBLIC_FF_REVISION_TRACKING`
**Default:** `false` (depends on `STORY_SCORE`)
**Status:** Backend implemented (`lib/revisions/service.ts`, revision API routes). Frontend components exist (`RevisionTimeline.tsx`, `DiffView.tsx`).

**SP Estimate:** 0 SP to enable
**Recommendation:** Enable for staging after STORY_SCORE.

---

### FC-022 | MEDIUM | SCRIPT_EDITOR feature flag -- backend exists, gated by flag

**Flag:** `NEXT_PUBLIC_FF_SCRIPT_EDITOR`
**Default:** `false` (depends on `STORY_ADVISER`)
**Status:** Frontend component exists (`ScriptEditorSection.tsx`). Depends on STORY_ADVISER chain.

**SP Estimate:** 0 SP to enable
**Recommendation:** Enable for staging after STORY_ADVISER. Phase 2 feature.

---

### FC-023 | LOW | COMPARABLE_SCRIPTS feature flag -- backend exists, corpus empty

**Flag:** `NEXT_PUBLIC_FF_COMPARABLE_SCRIPTS`
**Default:** `false` (depends on `STORY_SCORE`)
**Status:** Backend implemented (`lib/comparable/service.ts`, `embeddings.ts`, `/api/projects/[id]/comparables`). The `ScriptCorpus` table requires populated data for meaningful results. Admin corpus populate endpoint exists (`/api/admin/corpus/populate`) but has no UI trigger.

**SP Estimate:** 3 SP (corpus population workflow)
**Recommendation:** Phase 3 feature. Requires corpus seeding strategy before enabling.

---

### FC-024 | LOW | EXPORT_REPORTS feature flag -- frontend exists, needs validation

**Flag:** `NEXT_PUBLIC_FF_EXPORT_REPORTS`
**Default:** `false` (depends on `STORY_SCORE`)
**Status:** Frontend button exists (`ExportButton.tsx`), API route exists (`/api/projects/[id]/export`). Not tested in production.

**SP Estimate:** 1 SP (testing + validation)
**Recommendation:** Phase 3 feature. Enable after STORY_SCORE for testing.

---

## 8. Dead Routes / Pages

Pages that exist but are not linked from any navigation or other page.

### FC-025 | MEDIUM | `/alerts` page does not exist (dead link)

**Reference:** `components/alerts/AlertsDropdown.tsx:258`
```tsx
<Link href="/alerts" onClick={() => setOpen(false)}>
```
**Context:** The AlertsDropdown "View All Alerts" link points to `/alerts`, but no `app/alerts/page.tsx` exists. Users clicking this link will get a 404.

**SP Estimate:** 3 SP
**Recommendation:** Create `app/alerts/page.tsx` with a full alerts list view, filtering, and mark-as-read capabilities.

---

### FC-026 | HIGH | `/upload` page does not exist (dead link)

**Reference:** `components/dashboard/writer-dashboard-client.tsx:210,226`
```tsx
<Link href="/upload">
```
**Context:** The writer dashboard links to `/upload` for the script upload flow. No `app/upload/page.tsx` exists. The actual upload flow is at `/projects/new`. Users clicking "Upload" on an empty dashboard will get a 404.

**SP Estimate:** 1 SP
**Recommendation:** Either (a) create `app/upload/page.tsx` that redirects to `/projects/new`, or (b) update the writer dashboard links to point to `/projects/new`.

---

### FC-027 | LOW | `/settings` route protected but page missing

**Reference:** `packages/web/middleware.ts:10`
```ts
'/settings(.*)',
```
**Context:** The Clerk middleware protects `/settings(.*)` routes, but no `app/settings/page.tsx` exists. The admin settings page is at `/admin/settings`. There is no user-facing settings page.

**SP Estimate:** 3 SP
**Recommendation:** For MVP, remove `/settings(.*)` from the middleware matcher or create a basic settings page with profile editing and notification preferences (wiring in the `AlertPreference` model from FC-017).

---

### FC-028 | LOW | `/terms` and `/privacy` pages exist but are not linked

**Files:**
- `packages/web/app/terms/page.tsx`
- `packages/web/app/privacy/page.tsx`

**Context:** Both pages exist but are not linked from any navigation, footer, or signup flow. Legal pages should be discoverable.

**SP Estimate:** 1 SP
**Recommendation:** Add links to Terms and Privacy in the landing page footer and signup page.

---

### FC-029 | LOW | `/docs` page linked only from itself

**File:** `packages/web/app/docs/page.tsx:33`
```tsx
<Link href="/api/docs" target="_blank">
```
**Context:** The docs page exists and links to the API documentation endpoint, but the docs page itself is not linked from any navigation. It is only discoverable by direct URL.

**SP Estimate:** 0 SP
**Recommendation:** Add to admin navigation or developer section if intended for API consumers.

---

### FC-030 | LOW | `/writer/dashboard` and `/reader/dashboard` coexist with `/dashboard`

**Files:**
- `app/dashboard/page.tsx` -- Main dashboard (lists projects)
- `app/writer/dashboard/page.tsx` -- Writer-specific dashboard
- `app/reader/dashboard/page.tsx` -- Reader-specific dashboard

**Context:** Three dashboard pages exist. The main `/dashboard` page is linked from navigation. The writer and reader dashboards are accessible via direct URL but the routing between them depends on user type. No dead link issue, but potential confusion.

**SP Estimate:** 0 SP
**Recommendation:** Document the routing logic. Verify that `/dashboard` correctly redirects writers to `/writer/dashboard` and readers to `/reader/dashboard` if that is the intended flow.

---

## 9. Summary

### Critical Issues (Must Fix Before Launch)

| ID | Severity | SP | Description |
|----|----------|----|----|
| FC-014 | HIGH | 2 | `/api/jobs/[id]/status` route missing -- reader upload polling broken |
| FC-015 | HIGH | 2 | `/api/shares/access/[code]/play` route missing -- play count tracking broken |
| FC-026 | HIGH | 1 | `/upload` page missing -- writer dashboard dead link |
| FC-002 | HIGH | 3 | `score_generation` queue processor throws NotImplemented |
| FC-003 | HIGH | 3 | `suggestion_generation` queue processor throws NotImplemented |

### Important Issues (Should Fix Before Launch)

| ID | Severity | SP | Description |
|----|----------|----|----|
| FC-004 | MEDIUM | 3 | Stripe subscription sync is a stub in admin |
| FC-005 | MEDIUM | 5 | Admin settings page is non-functional UI shell |
| FC-010 | MEDIUM | 2 | 7 admin API routes are orphaned (server components bypass them) |
| FC-017 | MEDIUM | 3 | `AlertPreference` model has zero application references |
| FC-025 | MEDIUM | 3 | `/alerts` page does not exist (dead link from dropdown) |
| FC-019 | MEDIUM | 0 | STORY_SCORE feature complete but disabled by default |
| FC-020 | MEDIUM | 0 | STORY_ADVISER feature complete but disabled by default |
| FC-021 | MEDIUM | 0 | REVISION_TRACKING feature complete but disabled by default |
| FC-022 | MEDIUM | 0 | SCRIPT_EDITOR feature complete but disabled by default |

### Low Priority (Post-Launch Backlog)

| ID | Severity | SP | Description |
|----|----------|----|----|
| FC-006 | LOW | 3 | Teams: No Update/Delete for team entity |
| FC-007 | LOW | 2 | Audio Outputs: No dedicated CRUD API |
| FC-008 | LOW | 1 | Subscriptions: No user-facing delete/cancel endpoint |
| FC-009 | LOW | 1 | Alerts: No delete endpoint |
| FC-011 | LOW | 0 | Queue status endpoint has no frontend consumer |
| FC-013 | LOW | 1 | Auth signout route unused (Clerk handles client-side) |
| FC-016 | LOW | 0 | `PlatformSetting` only in admin settings API (addressed by FC-005) |
| FC-018 | LOW | 2 | `ContentAccessLog` model lightly used |
| FC-023 | LOW | 3 | Comparable Scripts flag needs corpus seeding |
| FC-024 | LOW | 1 | Export Reports flag needs testing |
| FC-027 | LOW | 3 | `/settings` protected in middleware but page missing |
| FC-028 | LOW | 1 | `/terms` and `/privacy` pages not linked from navigation |
| FC-029 | LOW | 0 | `/docs` page not linked from navigation |
| FC-030 | LOW | 0 | Three dashboard pages may cause routing confusion |
| FC-001 | LOW | 0 | Director validator TODO regex (intentional, no action needed) |
| FC-012 | LOW | 0 | Health endpoint not called from frontend (infrastructure) |

### Totals

- **HIGH findings:** 5 (11 SP)
- **MEDIUM findings:** 9 (16 SP)
- **LOW findings:** 16 (18 SP)
- **Total findings:** 30
- **Total estimated effort:** 45 SP
- **Critical path (must-fix):** 11 SP
