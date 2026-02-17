# 09 - Feature Completeness Review

**Date:** 2026-02-15
**Reviewer:** Chris Therriault <chris@servicevision.net>
**Scope:** Full-stack feature audit across 58 API routes, 23 Prisma models, and all page/component implementations
**State:** MVP declared ~95% complete (Phases 0-7 done, 642 tests passing)

---

## Executive Summary

The codebase has strong end-to-end feature coverage for the core writer workflow (create project, generate audio, share). However, a cross-referencing audit reveals **significant incompleteness in the admin panel, reader upload payment flow, and several API routes that exist without client-side callers**. The admin settings page is entirely non-functional (UI only, no persistence). Admin action dropdown menus (user management, subscription management) render buttons with no handlers. The `AlertPreference` model has zero usage anywhere in the codebase. Twenty-two findings are documented below.

---

## 1. Unused / Uncalled API Routes

Cross-referencing all 58 `route.ts` files against client-side `fetch()` calls in `.tsx`/`.ts` files (excluding self-references and test files).

### FC-001 | HIGH | Admin API routes have zero client-side callers (8 routes)

The admin pages (`/admin/users`, `/admin/subscriptions`, `/admin/analytics`, `/admin/audit-log`, `/admin/settings`) are **server components** that query Prisma directly. The corresponding API routes exist but are never called from any page or component:

| Route | Methods | Client Callers |
|-------|---------|---------------|
| `/api/admin/users` | GET, PATCH | 0 -- admin/users/page.tsx uses Prisma directly |
| `/api/admin/users/[userId]` | GET, PATCH | 0 -- no user detail page exists |
| `/api/admin/subscriptions` | GET, PATCH | 0 -- admin/subscriptions/page.tsx uses Prisma directly |
| `/api/admin/subscriptions/[subscriptionId]` | GET, POST | 0 -- no subscription detail actions wired |
| `/api/admin/stats` | GET | 0 -- admin/page.tsx uses Prisma directly |
| `/api/admin/audit-logs` | GET | 0 -- admin/audit-log/page.tsx uses Prisma directly |
| `/api/admin/settings` | GET, PUT | 0 -- settings page has non-functional forms |
| `/api/admin/corpus/populate` | POST | 0 -- tooling/seeding route, no UI trigger |

**Category:** Admin-only infrastructure. These were likely built for a future client-side admin SPA or for external API consumption. The server components that replaced them query the DB directly, making these routes dead code.

**Impact:** 8 route files (16 HTTP handlers) that increase maintenance surface without serving traffic.

**Recommendation:** Either (a) delete the API routes and keep the server-component-direct-query pattern, or (b) convert admin pages to client components that call these APIs for consistency.

---

### FC-002 | MEDIUM | `/api/auth/signout` route is unused

**File:** `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/api/auth/signout/route.ts`

The sign-out button (`components/auth/sign-out-button.tsx`) uses Clerk's `useClerk().signOut()` directly (line 15). The `/api/auth/signout` route is never called.

**Category:** Dead code, superseded by Clerk SDK.

---

### FC-003 | MEDIUM | `/api/queue/status` route has no client caller

**File:** `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/api/queue/status/route.ts`

No page or component fetches from `/api/queue/status`. This appears to be an infrastructure/monitoring endpoint.

**Category:** Monitoring/ops endpoint. May be called by external health checks or Render.com. Confirm before removing.

---

### FC-004 | MEDIUM | `/api/reader/library` (GET list) has no direct client caller

**File:** `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/api/reader/library/route.ts`

The reader dashboard (`reader/dashboard/page.tsx`) queries Prisma directly (server component). The API route exists but is only referenced from tests and the OpenAPI spec.

**Category:** Dead code or test-only route.

---

### FC-005 | LOW | `/api/docs` route -- intentional

**File:** `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/api/docs/route.ts`

Called from the `/docs` page. This is functional. No action needed.

---

### FC-006 | MEDIUM | Duplicate route pattern: `/api/projects/[id]/suggestions/[suggestionId]/rewrite`

Both of these exist:
- `/api/projects/[id]/suggestions/[suggestionId]/rewrite/route.ts` (nested under projects)
- `/api/suggestions/[id]/rewrite/route.ts` (top-level)

Client code calls `/api/suggestions/${id}/rewrite` (the top-level version). The nested version under `/api/projects/[id]/` has zero client callers.

Similarly for `/api/projects/[id]/suggestions/[suggestionId]/route.ts` vs `/api/suggestions/[id]/route.ts` -- the nested versions are unused.

**Count:** 4 handlers (2 route files) are duplicates of the top-level suggestion routes.

---

### Summary: Uncalled API Routes

| Category | Count | Routes |
|----------|-------|--------|
| Admin-only (server components bypass API) | 8 files, 16 handlers | admin/users, users/[id], subscriptions, subscriptions/[id], stats, audit-logs, settings, corpus/populate |
| Dead code (superseded) | 2 files, 2 handlers | auth/signout, reader/library (list) |
| Duplicate routes | 2 files, 4 handlers | projects/[id]/suggestions/[suggestionId]/* |
| Monitoring/ops | 1 file, 1 handler | queue/status |
| **Total** | **13 files, 23 handlers** | |

---

## 2. Incomplete Features

### FC-007 | HIGH | Admin settings page is entirely non-functional

**File:** `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/admin/settings/page.tsx`
**Lines:** 1-305

The settings page renders 6 configuration cards (General, Security, Email, Notifications, Billing, API) with Input fields, Switch toggles, and "Save Changes" buttons. However:

1. **No `onClick` or `onSubmit` handlers exist.** The page is a server component -- buttons are inert.
2. **No form actions.** The `<Button>Save Changes</Button>` elements are not wrapped in `<form>` tags with actions.
3. **Default values are hardcoded** (e.g., `defaultValue="Story Magic"`, `defaultValue="24"`), not loaded from `PlatformSetting` model.
4. **The `/api/admin/settings` route exists** with GET and PUT handlers that DO use `prisma.platformSetting`, but the settings page never calls them.
5. **Switch components have no `name` or `onChange`** -- toggling them has no effect.

**Impact:** An admin clicking "Save Changes" sees no error, no success -- nothing happens. This creates a false sense of functionality.

**Recommendation:** Either (a) convert to a client component with `fetch('/api/admin/settings', ...)` calls, or (b) use Next.js Server Actions with `<form action={...}>`.

---

### FC-008 | HIGH | Admin user actions are UI-only stubs

**File:** `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/admin/users/page.tsx`
**Lines:** 217-234

The dropdown menu for each user in the users table renders four actions:
- "View Details" -- no `onClick`, no `href`. Clicking does nothing.
- "Send Email" -- no handler.
- "Change Role" -- no handler.
- "Suspend User" -- no handler.

These are `<DropdownMenuItem>` with no `onClick` and no `asChild` + `<Link>`. The API routes (`/api/admin/users/[userId]` PATCH) exist to support role changes and suspension, but they are never wired up.

**Similarly** in `/admin/subscriptions/page.tsx` (lines 232-244):
- "View in Stripe" -- no `href` to Stripe dashboard.
- "Sync with Stripe" -- no handler.
- "Cancel Subscription" -- no handler.

---

### FC-009 | HIGH | Admin dashboard shows fake growth metrics

**File:** `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/admin/page.tsx`
**Lines:** 57-114

All 8 stat cards show hardcoded growth percentages:
```tsx
{ label: 'Total Users', ..., change: '+12%' },
{ label: 'Writers', ..., change: '+8%' },
{ label: 'Readers', ..., change: '+15%' },
// ... all hardcoded
```

The actual metric values (`totalUsers`, `totalWriters`, etc.) are real Prisma queries, but the growth comparisons are static strings. An admin might rely on these for business decisions.

**Note:** The `/admin/analytics` page correctly computes real growth rates from period comparisons.

---

### FC-010 | MEDIUM | Reader upload payment form is a placeholder

**File:** `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/components/reader/upload-client.tsx`
**Lines:** 429-445

The payment step renders raw HTML inputs for card number, expiry, and CVC:
```tsx
{/* Payment form placeholder - would integrate Stripe Elements */}
<div className="p-4 border rounded-lg space-y-4">
  <Input placeholder="1234 5678 9012 3456" />
  <Input placeholder="MM/YY" />
  <Input placeholder="123" />
</div>
```

This is explicitly commented as a placeholder. The `/api/reader/upload/create-payment` route exists and creates a Stripe PaymentIntent, but the UI does not use Stripe Elements to collect card details. Submitting this form would attempt to process without actual payment credentials.

**Impact:** Reader upload-and-pay flow is broken for actual monetary transactions.

---

### FC-011 | MEDIUM | Reader QR code is a placeholder

**File:** `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/components/dashboard/reader-dashboard-client.tsx`
**Lines:** 479-484

```tsx
{/* QR Code placeholder - would use react-qr-code in production */}
<div className="w-full h-full flex items-center justify-center border-2 border-dashed border-border rounded">
  <QrCode className="w-16 h-16 text-muted-foreground" />
</div>
```

The QR code modal shows a static icon instead of a generated QR code. The reader code is displayed as text below, so functionality is partially preserved, but the QR feature is incomplete.

---

### FC-012 | MEDIUM | Client code fetches non-existent API routes

Two client-side fetch calls target routes that do not exist:

1. **`/api/shares/access/${code}/play`** -- called from `/app/s/[code]/page.tsx` line 168. No `/api/shares/access/[code]/play/route.ts` exists. This is a fire-and-forget POST (no error handling on failure), so it silently fails.

2. **`/api/jobs/${jobId}/status`** -- called from `/components/reader/upload-client.tsx` line 180. The actual route is `/api/jobs/[id]/route.ts` (GET), not `/api/jobs/[id]/status`. The client call will 404.

---

## 3. Missing Error Handling in API Routes

### FC-013 | MEDIUM | No centralized auth middleware -- auth is inline in each route

There is no `withAuth` or `withAdmin` middleware wrapper. Each route independently calls `auth()` from Clerk and checks `userId`:

```
// Typical pattern in every route:
const { userId } = await auth();
if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

This pattern is repeated in ~45 of 58 routes. The remaining routes are:
- **Public routes** (health, webhooks, share access) -- correctly unauthenticated
- **Admin routes** -- each checks `profile.userType === 'admin'` independently

**Risk:** A new route could easily forget the auth check. Admin role verification is particularly fragile since each route re-queries the profile.

**Recommendation:** Extract `withAuth(handler)` and `withAdmin(handler)` wrapper functions that return 401/403 early.

---

### FC-014 | LOW | Webhook routes correctly skip auth

**Files:**
- `/api/webhooks/clerk/route.ts` -- validates with Clerk webhook verification
- `/api/stripe/webhook/route.ts` -- validates with Stripe signature verification

These correctly bypass user auth and use service-to-service verification. No action needed.

---

## 4. Database Models Without UI

### FC-015 | HIGH | `AlertPreference` model (Prisma) has zero usage

**Model:** `AlertPreference` in `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/prisma/schema.prisma` (line 642)

No API route, no page, no component, and no server-side code references `prisma.alertPreference`. The model was defined but never implemented. Users have no way to configure notification preferences.

---

### FC-016 | MEDIUM | `PlatformSetting` model only used in the admin settings API route

**Model:** `PlatformSetting` in `schema.prisma` (line 687)

Only referenced in `/api/admin/settings/route.ts` (GET and PUT). Since the settings page never calls this API (FC-007), the model is effectively unused in production.

---

### FC-017 | LOW | `ContentAccessLog` model used in one route only

**Model:** `ContentAccessLog` in `schema.prisma` (line 337)

Only referenced in `/api/reader/library/[entryId]/position/route.ts`. This is functional but the access log data is never surfaced in any admin page or analytics view.

---

### FC-018 | LOW | `JobLog` model used only in the generation processor

**Model:** `JobLog` in `schema.prisma` (line 149)

Only referenced in `/lib/generation/processor.ts`. Logs are written during audio generation but never displayed in any UI. The admin panel has no job-level log viewer.

---

### Full Model Usage Matrix

| Model | API Routes | Pages/Components | Status |
|-------|-----------|-----------------|--------|
| Profile | 8+ | 6+ | Full |
| Project | 10+ | 5+ | Full |
| Job | 4 | 3 | Full |
| JobLog | 0 | 0 | Write-only (processor) |
| AudioOutput | 3 | 3 | Full |
| Usage | 2 | 2 | Full |
| Subscription | 4 | 4 | Full |
| Purchase | 1 | 0 | API-only (reader upload) |
| ScriptShare | 5 | 4 | Full |
| ReaderLibrary | 4 | 3 | Full |
| ContentAccessLog | 1 | 0 | Write-only |
| StoryScore | 2 | 2 | Full |
| Suggestion | 4 | 2 | Full |
| Rewrite | 0 (via service) | 1 | Full (service layer) |
| Revision | 3 | 2 | Full |
| ScriptCorpus | 0 (via service) | 0 | Service-only (comparable) |
| Team | 2 | 1 | Full |
| TeamMember | 1 | 1 | Full |
| TeamShare | 1 | 1 | Full |
| Alert | 1 | 1 | Full |
| **AlertPreference** | **0** | **0** | **Unused** |
| AuditLog | 1 | 1 | Full |
| **PlatformSetting** | **1** | **0** | **API exists, UI broken** |

---

## 5. Stub / Placeholder Code

### FC-019 | MEDIUM | Payment form explicitly marked as placeholder

**File:** `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/components/reader/upload-client.tsx`
**Line:** 429

Comment: `{/* Payment form placeholder - would integrate Stripe Elements */}`

See FC-010 for details.

---

### FC-020 | MEDIUM | QR code explicitly marked as placeholder

**File:** `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/components/dashboard/reader-dashboard-client.tsx`
**Line:** 480

Comment: `{/* QR Code placeholder - would use react-qr-code in production */}`

See FC-011 for details.

---

### FC-021 | LOW | Health route storage check is a placeholder

**File:** `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/api/health/route.ts`
**Line:** 230

Comment: `(Storage is now handled externally; this is a placeholder check)`

This is benign -- the health check returns OK without actually checking storage. Acceptable for current architecture.

---

### FC-022 | LOW | Share modal placeholder URL before creation

**File:** `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/components/dashboard/share-modal.tsx`
**Lines:** 66-67

```tsx
const placeholderUrl = 'Click "Create Share Link" to generate a URL';
```

This is a UX placeholder in an input field, not a stub implementation. Functional and appropriate.

---

## Summary Table

| ID | Severity | Category | Description |
|----|----------|----------|-------------|
| FC-001 | HIGH | Unused Routes | 8 admin API route files (16 handlers) have zero client callers |
| FC-002 | MEDIUM | Unused Routes | /api/auth/signout superseded by Clerk SDK |
| FC-003 | MEDIUM | Unused Routes | /api/queue/status has no client caller |
| FC-004 | MEDIUM | Unused Routes | /api/reader/library list route unused (server component) |
| FC-005 | LOW | Unused Routes | /api/docs is functional (no action) |
| FC-006 | MEDIUM | Unused Routes | Duplicate suggestion/rewrite routes under projects/ |
| FC-007 | HIGH | Incomplete | Admin settings page is entirely non-functional |
| FC-008 | HIGH | Incomplete | Admin user/subscription dropdown actions are inert stubs |
| FC-009 | HIGH | Incomplete | Admin dashboard shows hardcoded growth percentages |
| FC-010 | MEDIUM | Incomplete | Reader upload payment form is a Stripe placeholder |
| FC-011 | MEDIUM | Incomplete | Reader QR code is a visual placeholder |
| FC-012 | MEDIUM | Incomplete | Client fetches 2 non-existent API routes (silent 404s) |
| FC-013 | MEDIUM | Error Handling | No centralized auth middleware; 45+ routes repeat inline auth |
| FC-014 | LOW | Error Handling | Webhook routes correctly use service-level verification |
| FC-015 | HIGH | Dead Models | AlertPreference model has zero usage in codebase |
| FC-016 | MEDIUM | Dead Models | PlatformSetting model effectively unused (API route exists but UI broken) |
| FC-017 | LOW | Dead Models | ContentAccessLog written but never surfaced |
| FC-018 | LOW | Dead Models | JobLog written but never surfaced in UI |
| FC-019 | MEDIUM | Stubs | Payment form placeholder (explicit comment) |
| FC-020 | MEDIUM | Stubs | QR code placeholder (explicit comment) |
| FC-021 | LOW | Stubs | Health route storage check is placeholder |
| FC-022 | LOW | Stubs | Share modal placeholder URL is appropriate UX |

**High:** 5 | **Medium:** 10 | **Low:** 7

---

## Prioritized Remediation

### Before Staging Deploy (Blockers)

1. **FC-012** -- Fix client-side fetches to non-existent routes (`/api/shares/access/.../play`, `/api/jobs/.../status`). These cause silent 404 errors in production.
2. **FC-010** -- Either implement Stripe Elements in the reader upload flow or disable the payment step with a "Coming Soon" notice. Broken payment = broken trust.

### Before Production Deploy

3. **FC-007 + FC-008** -- Either complete the admin settings/actions or clearly label them as "Coming Soon." Non-functional buttons that appear functional are worse than missing features.
4. **FC-009** -- Remove hardcoded growth percentages or compute them from actual data.
5. **FC-015** -- Either implement `AlertPreference` or remove the model to avoid schema bloat.

### Post-Launch Backlog

6. **FC-001** -- Decide on admin API architecture (server components vs. API routes) and remove the dead path.
7. **FC-006** -- Remove duplicate suggestion routes under `/api/projects/[id]/`.
8. **FC-013** -- Extract auth middleware to reduce repetition and prevent auth-check omissions.
9. **FC-011** -- Integrate `react-qr-code` for the reader QR code feature.

---

*Review conducted against commit state as of 2026-02-15. All file paths are absolute within the monorepo.*
