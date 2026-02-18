# Security Review -- Story Magic

**Date:** 2026-02-18
**Reviewer:** Chris Therriault (chris@servicevision.net)
**Scope:** All 58 Next.js API routes (`packages/web/app/api/`) and Express orchestrator (`packages/orchestrator/src/`)
**Methodology:** Static analysis of every route.ts for auth, input validation, ownership checks, secrets, CSRF, rate limiting, and webhook verification.

---

## Executive Summary

The codebase demonstrates a mature security posture for an MVP. The `withAuth` / `withProjectAuth` middleware pattern eliminates most auth-bypass classes, CSRF validation is applied by default on mutations, and rate limiting is tiered. The Stripe and Clerk webhook routes both verify cryptographic signatures.

**Critical findings: 0**
**High findings: 4**
**Medium findings: 7**
**Low findings: 5**
**Informational: 3**

---

## 1. Authentication Bypass

### SEC-001 | HIGH | CWE-306: Missing Authentication for Critical Function
**File:** `packages/web/app/api/health/route.ts:822`
**Description:** The health check endpoint is intentionally unauthenticated, but it performs live calls to external services (ElevenLabs, OpenAI, Orchestrator) and returns their status and latency. This can be used for reconnaissance to enumerate configured services and observe when keys are invalid.
```typescript
export async function GET() {
  // No auth -- returns service status, latency, config presence
  const checks: HealthCheck[] = [];
  ...
}
```
**SP:** 1
**Recommendation:** Return only overall status (healthy/unhealthy) for unauthenticated callers. Move detailed checks behind `withAuth` with an optional `?details=true` query param.

---

### SEC-002 | MEDIUM | CWE-306: Missing Authentication
**File:** `packages/web/app/api/docs/route.ts:3`
**Description:** The OpenAPI spec endpoint is unauthenticated. While OpenAPI specs are commonly public, this exposes the full API surface, including admin endpoints and internal schemas, to unauthenticated users.
```typescript
export async function GET() {
  return NextResponse.json(openApiSpec, { ... });
}
```
**SP:** 1
**Recommendation:** Either gate behind authentication or strip admin/internal endpoints from the public spec.

---

### SEC-003 | MEDIUM | CWE-306: Missing Authentication
**File:** `packages/web/app/api/shares/access/[code]/route.ts:134`
**Description:** The `GET /api/shares/access/[code]` endpoint is intentionally public (share links are designed to be accessed without login), but it has **no rate limiting**. An attacker could enumerate valid share codes by brute-forcing the 10-character nanoid space.
```typescript
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { code } = await params;
  // No rate limit on GET
  const share = await prisma.scriptShare.findFirst({ ... });
}
```
**SP:** 2
**Recommendation:** Add `rateLimit('share-access:' + ip, 'normal')` to the GET handler. The POST handler already has strict rate limiting for password verification -- apply similar protection to the lookup itself.

---

### SEC-004 | LOW | CWE-306: Missing Auth on Invite GET
**File:** `packages/web/app/api/invite/[token]/route.ts:5`
**Description:** `GET /api/invite/[token]` is unauthenticated. It exposes invite details (team name, inviter name, email) to anyone with a valid token. The token is a UUID from the database, so entropy is high, but this still leaks PII if a token is shared or logged.
```typescript
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  // No auth check
  const { token } = await params;
  const invite = await prisma.teamMember.findFirst({ ... });
```
**SP:** 1
**Recommendation:** Consider rate limiting the GET endpoint similarly to the POST. This is acceptable design for invite flows, but add rate limiting to prevent enumeration.

---

## 2. Input Validation

### SEC-005 | HIGH | CWE-20: Improper Input Validation
**File:** `packages/web/app/api/projects/[id]/workflow-mode/route.ts:6`
**Description:** The workflow-mode POST handler calls `request.json()` directly and validates the result manually with an `includes()` check instead of using Zod. The JSON parse is also unguarded -- a malformed body will throw an unhandled exception (500 with stack trace in dev).
```typescript
export const POST = withProjectAuth(async (request, { prisma, projectId }) => {
  const { mode } = await request.json();  // No try/catch, no Zod
  if (!mode || !['automatic', 'fine_tuned'].includes(mode)) {
    return NextResponse.json({ error: 'Invalid workflow mode' }, { status: 400 });
  }
```
**SP:** 1
**Recommendation:** Wrap in try/catch and use a Zod schema, consistent with all other routes. Use `parseBody()` from middleware.ts.

---

### SEC-006 | HIGH | CWE-20: Improper Input Validation
**File:** `packages/web/app/api/reader/library/[entryId]/favorite/route.ts:19`
**File:** `packages/web/app/api/reader/library/[entryId]/position/route.ts:19`
**File:** `packages/web/app/api/reader/library/[entryId]/route.ts:65` (PATCH)
**File:** `packages/web/app/api/reader/upload/create-payment/route.ts:17`
**Description:** Four reader routes call `request.json()` without try/catch and without Zod schema validation. Body fields are destructured directly, trusting client input types.
```typescript
// favorite/route.ts
const body = await request.json();           // No try/catch
const isFavorited = body.is_favorited ?? !existingEntry.isFavorited;

// create-payment/route.ts
const body = await request.json();           // No try/catch
const { price, needsOCR, scriptName } = body;  // No Zod validation
```
**SP:** 3
**Recommendation:** Add Zod schemas to all four routes. The payment route is especially sensitive -- validate `price` is an integer, `needsOCR` is boolean, and `scriptName` is a bounded string.

---

### SEC-007 | MEDIUM | CWE-20: Improper Input Validation
**File:** `packages/web/app/api/stripe/checkout/route.ts:8`
**Description:** The checkout route validates `tier` and `interval` with inline `includes()` checks rather than Zod. The JSON parse is inside a try/catch that catches the entire handler (not just the parse), so a parse error returns 500 with a generic message rather than 400.
```typescript
const { tier, interval } = await request.json();
if (!['creator', 'pro', 'studio'].includes(tier)) {
  return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
}
```
**SP:** 1
**Recommendation:** Use Zod schema validation consistent with other routes.

---

### SEC-008 | MEDIUM | CWE-20: Alerts PATCH Missing Zod
**File:** `packages/web/app/api/alerts/route.ts:122`
**Description:** The alerts PATCH handler destructures `alertIds` and `markAllRead` from `request.json()` without Zod validation. `alertIds` could contain non-string values; `markAllRead` could be a non-boolean truthy value.
```typescript
let body: { alertIds?: string[]; markAllRead?: boolean };
try {
  body = await request.json();
} catch { ... }
const { alertIds, markAllRead } = body;
```
**SP:** 1
**Recommendation:** Add a Zod schema: `z.object({ alertIds: z.array(z.string().uuid()).optional(), markAllRead: z.boolean().optional() })`.

---

## 3. SQL Injection

### SEC-009 | LOW | CWE-89: SQL Injection (False Positive -- Parameterized)
**File:** `packages/web/app/api/projects/[id]/feedback/route.ts:75`
**File:** `packages/web/app/api/preview/route.ts:67,153,164`
**File:** `packages/web/app/api/health/route.ts:28`
**Description:** The codebase uses `$queryRaw` and `$executeRaw` in 5 locations. All instances use **tagged template literals**, which Prisma automatically parameterizes.
```typescript
// feedback/route.ts -- SAFE: tagged template literal
const feedback = await prisma.$queryRaw<FeedbackRow[]>`
  INSERT INTO feedback (user_id, project_id, target, target_id, rating, rejection_reason, comment, metadata)
  VALUES (${userId}, ${projectId}::uuid, ${target}, ${targetId}, ${rating || null}, ...)
  RETURNING *
`;

// preview/route.ts -- SAFE: tagged template literal
const result = await prisma.$queryRaw<[{ get_remaining_previews: number }]>`
  SELECT get_remaining_previews(${userId}::text)
`;
```
**SP:** 0
**Recommendation:** No action required. All raw SQL is parameterized via Prisma's tagged template syntax. Document this as a convention to maintain.

---

## 4. Insecure Direct Object Reference (IDOR)

### SEC-010 | HIGH | CWE-639: Authorization Bypass Through User-Controlled Key
**File:** `packages/orchestrator/src/index.ts:97`
**Description:** The orchestrator's `/download/:project_id/:filename` endpoint authenticates the user via `authMiddleware` but **does not verify the user owns the project**. Any authenticated user can download any project's audio files by guessing or enumerating project UUIDs.
```typescript
app.get('/download/:project_id/:filename', authMiddleware, (req: Request, res: Response) => {
  const { project_id, filename } = req.params;
  // Validates UUID format and path traversal -- BUT NO OWNERSHIP CHECK
  const filePath = path.resolve(baseOutputDir, project_id, filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath);  // Downloads without checking req.user.id === project owner
  }
```
**SP:** 3
**Recommendation:** Query the database to verify `req.user.id` owns the project before serving the file. Alternatively, add a signed-URL mechanism.

---

### SEC-011 | LOW | CWE-639: Queue Status Leaks Cross-Tenant Data
**File:** `packages/web/app/api/queue/status/route.ts:7`
**Description:** `GET /api/queue/status` returns platform-wide queue statistics (total queued, processing, completed, failed, average wait time) to any authenticated user. This leaks information about other tenants' workloads.
```typescript
export const GET = withAuth(async () => {
  const stats = await getQueueStats();
  return NextResponse.json({ queue: { queued: stats.totalQueued, ... } });
});
```
**SP:** 1
**Recommendation:** Either restrict to admin users or scope the stats to the requesting user's jobs.

---

## 5. Secrets Exposure

### SEC-012 | INFORMATIONAL | CWE-200: Exposure of Sensitive Information
**File:** `packages/web/app/api/health/route.ts:28-48`
**Description:** The health check endpoint confirms whether specific API keys are configured by name (OpenAI, ElevenLabs, Clerk). Error messages include `"ELEVENLABS_API_KEY not configured"`. While no key values are leaked, this assists reconnaissance.
**SP:** 0
**Recommendation:** In production, redact specific key names. Return generic "external service unavailable" messages.

---

### SEC-013 | INFORMATIONAL | CWE-532: Insertion of Sensitive Information into Log File
**File:** `packages/web/app/api/auth/signout/route.ts:9-10`
**Description:** The signout route reads the `origin` and `referer` headers and uses them to construct a redirect URL. If the origin is unexpected, the redirect could go to an attacker-controlled domain (open redirect). However, `NextResponse.redirect()` in Next.js validates the URL is relative or same-origin in most configurations.
```typescript
const origin = headersList.get('origin') ||
  headersList.get('referer')?.split('/').slice(0, 3).join('/') ||
  'https://story-magic-web.onrender.com';
return NextResponse.redirect(new URL('/login', origin));
```
**SP:** 1
**Recommendation:** Validate the origin against the ALLOWED_ORIGINS list before using it in the redirect.

---

## 6. CSRF Protection

### SEC-014 | MEDIUM | CWE-352: Cross-Site Request Forgery
**File:** `packages/web/app/api/shares/access/[code]/route.ts:271` (POST)
**Description:** The `POST /api/shares/access/[code]` endpoint (password verification for protected shares) does **not** use `withAuth` and therefore does not go through CSRF validation. It has its own rate limiting but no CSRF check. Since this is a public endpoint that accepts a password, CSRF protection is relevant to prevent an attacker from tricking a logged-in user into verifying a share password.
```typescript
export async function POST(request: NextRequest, { params }: RouteParams) {
  // Rate limit -- yes
  // CSRF -- NO
  const body = await request.json();
```
**SP:** 1
**Recommendation:** Add manual CSRF validation since this route doesn't use `withAuth`. Call `validateCsrf(request)` at the top of the handler.

---

### SEC-015 | LOW | CWE-352: CSRF on Invite POST
**File:** `packages/web/app/api/invite/[token]/route.ts:28`
**Description:** The invite POST handler uses manual auth (calls `auth()` directly) and does include CSRF validation, but the CSRF check happens before the rate limit. If `validateCsrf` throws or has performance issues, rate limiting won't apply. The current ordering is: rate limit -> CSRF -> auth, which is correct. This is informational only -- the implementation is sound.
**SP:** 0
**Recommendation:** No action needed. The ordering is correct: rate limit first, then CSRF, then auth.

---

## 7. Rate Limiting

### SEC-016 | MEDIUM | CWE-770: Allocation of Resources Without Limits
**File:** Multiple routes
**Description:** Several routes that perform expensive operations or are sensitive do not specify a rate limit tier (defaulting to `'normal'` = 20/min), or could benefit from stricter limits:

| Route | Method | Current Rate Limit | Recommended |
|-------|--------|-------------------|-------------|
| `/api/stripe/checkout` | POST | `normal` (default) | `strict` |
| `/api/stripe/portal` | POST | `normal` (default) | `strict` |
| `/api/teams/[teamId]/members` | POST (invite) | `normal` (default) | `strict` |
| `/api/admin/corpus/populate` | POST | `normal` (default) | `strict` |
| `/api/reader/upload/create-payment` | POST | `normal` (default via withAuth) | `strict` |
| `/api/admin/users/[userId]` | PATCH | `normal` (default) | `normal` (acceptable) |

**SP:** 2
**Recommendation:** Apply `{ rateLimit: 'strict' }` to payment-related routes and admin mutation routes to limit abuse.

---

### SEC-017 | MEDIUM | CWE-770: No Rate Limit on Public Share Access
**File:** `packages/web/app/api/shares/access/[code]/route.ts:134`
**Description:** The GET endpoint for share access has no rate limiting at all (it doesn't use `withAuth`). The POST endpoint correctly has strict rate limiting. An attacker could enumerate share codes at high speed via the unprotected GET endpoint.
**SP:** 2
**Recommendation:** Add IP-based rate limiting to the GET handler: `const limited = await rateLimit('share-get:' + ip, 'normal'); if (limited) return limited;`

---

## 8. Webhook Verification

### SEC-018 | INFORMATIONAL | Webhook Verification Status
**File:** `packages/web/app/api/stripe/webhook/route.ts:18-33`
**File:** `packages/web/app/api/webhooks/clerk/route.ts:18-50`
**Description:** Both webhook routes properly verify cryptographic signatures before processing events.

- **Stripe:** Uses `constructWebhookEvent(body, signature)` which internally calls `stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET`.
- **Clerk:** Uses Svix library to verify `svix-id`, `svix-timestamp`, and `svix-signature` headers against `CLERK_WEBHOOK_SECRET`.

Both routes correctly read the raw body as text (not JSON) before signature verification.

```typescript
// Stripe
const body = await request.text();
const signature = request.headers.get('stripe-signature');
event = constructWebhookEvent(body, signature);

// Clerk
const payload = await request.text();
const wh = new Webhook(WEBHOOK_SECRET);
event = wh.verify(payload, { 'svix-id': svixId, ... });
```
**SP:** 0
**Recommendation:** No action required. Webhook verification is correctly implemented.

---

## 9. Additional Security Observations

### SEC-019 | MEDIUM | CWE-22: Improper Limitation of a Pathname to a Restricted Directory
**File:** `packages/web/app/api/reader/upload/process/route.ts:31-33`
**Description:** The upload processing route saves files to disk using `file.name` from the uploaded form data without sanitization. While the parent directory uses a generated `nanoid`, the filename itself could contain path traversal sequences.
```typescript
const fileName = file.name;  // User-controlled filename
const filePath = path.join(uploadsDir, fileName);
fs.writeFileSync(filePath, fileBuffer);
```
**SP:** 2
**Recommendation:** Sanitize the filename by stripping directory separators and special characters: `const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');`

---

## Findings Summary Table

| ID | Severity | CWE | SP | Description | File |
|----|----------|-----|----|----|------|
| SEC-001 | HIGH | CWE-306 | 1 | Health check leaks service config to unauthenticated users | health/route.ts |
| SEC-002 | MEDIUM | CWE-306 | 1 | OpenAPI spec exposed without auth | docs/route.ts |
| SEC-003 | MEDIUM | CWE-306 | 2 | Share access GET has no rate limiting | shares/access/[code]/route.ts |
| SEC-004 | LOW | CWE-306 | 1 | Invite GET leaks PII without rate limit | invite/[token]/route.ts |
| SEC-005 | HIGH | CWE-20 | 1 | workflow-mode: no try/catch, no Zod | projects/[id]/workflow-mode/route.ts |
| SEC-006 | HIGH | CWE-20 | 3 | 4 reader routes lack Zod validation | reader/library/*/route.ts |
| SEC-007 | MEDIUM | CWE-20 | 1 | Stripe checkout uses inline validation | stripe/checkout/route.ts |
| SEC-008 | MEDIUM | CWE-20 | 1 | Alerts PATCH missing Zod schema | alerts/route.ts |
| SEC-009 | LOW | CWE-89 | 0 | Raw SQL is safely parameterized (false positive) | feedback, preview, health |
| SEC-010 | HIGH | CWE-639 | 3 | Orchestrator download has no ownership check | orchestrator/src/index.ts |
| SEC-011 | LOW | CWE-639 | 1 | Queue status leaks cross-tenant data | queue/status/route.ts |
| SEC-012 | INFO | CWE-200 | 0 | Health check confirms key names | health/route.ts |
| SEC-013 | INFO | CWE-532 | 1 | Signout redirect uses unvalidated origin | auth/signout/route.ts |
| SEC-014 | MEDIUM | CWE-352 | 1 | Share password POST missing CSRF check | shares/access/[code]/route.ts |
| SEC-015 | LOW | CWE-352 | 0 | Invite POST CSRF ordering (informational) | invite/[token]/route.ts |
| SEC-016 | MEDIUM | CWE-770 | 2 | Sensitive routes use default rate limit | multiple |
| SEC-017 | MEDIUM | CWE-770 | 2 | Public share GET has no rate limit | shares/access/[code]/route.ts |
| SEC-018 | INFO | N/A | 0 | Webhook verification correctly implemented | stripe/webhook, webhooks/clerk |
| SEC-019 | MEDIUM | CWE-22 | 2 | Upload filename not sanitized | reader/upload/process/route.ts |

**Total Story Points (actionable):** 23 SP

---

## Auth Coverage Matrix

All 58 routes checked. Routes using `withAuth` or `withProjectAuth` are protected. Routes marked "None" are intentionally public or webhook endpoints.

| Route | Auth | CSRF | Rate Limit | Validated |
|-------|------|------|------------|-----------|
| admin/audit-logs GET | withAuth + admin check | auto | normal | Zod |
| admin/corpus/populate POST | withAuth + admin check | auto | normal | N/A |
| admin/settings GET | withAuth + admin check | N/A | normal | N/A |
| admin/settings PUT | withAuth + admin check | auto | normal | Zod |
| admin/stats GET | withAuth + admin check | N/A | normal | N/A |
| admin/subscriptions GET | withAuth + admin check | N/A | normal | Zod |
| admin/subscriptions PATCH | withAuth + admin check | auto | normal | Zod |
| admin/subscriptions/[id] GET | withAuth + admin check | N/A | normal | N/A |
| admin/subscriptions/[id] POST | withAuth + admin check | auto | normal | N/A |
| admin/users GET | withAuth + admin check | N/A | normal | Zod |
| admin/users PATCH | withAuth + admin check | auto | normal | Zod |
| admin/users/[id] GET | withAuth + admin check | N/A | normal | N/A |
| admin/users/[id] PATCH | withAuth + admin check | auto | normal | Zod |
| alerts GET | withAuth | N/A | normal | N/A |
| alerts PATCH | withAuth | auto | normal | **MISSING** |
| audio-preview GET | withAuth | N/A | normal | N/A |
| auth/signout POST | withAuth | auto | normal | N/A |
| docs GET | **None** | N/A | none | N/A |
| generate-demo-script POST | withAuth | auto | strict | manual |
| generate POST | withAuth | auto | strict | Zod |
| health GET/HEAD | **None** | N/A | none | N/A |
| invite/[token] GET | **None** | N/A | none | N/A |
| invite/[token] POST | manual auth() | manual | strict | N/A |
| jobs/[id] GET | withAuth + ownership | N/A | normal | N/A |
| jobs/[id]/cancel POST | withAuth + ownership | auto | normal | N/A |
| jobs/[id]/position GET | withAuth + ownership | N/A | normal | N/A |
| preview POST | withAuth + ownership | auto | strict | Zod |
| projects GET | withAuth | N/A | normal | N/A |
| projects POST | withAuth | auto | normal | Zod |
| projects/[id] GET | withProjectAuth | N/A | normal | N/A |
| projects/[id] PATCH | withProjectAuth | auto | normal | Zod |
| projects/[id] DELETE | withProjectAuth | auto | normal | N/A |
| projects/[id]/audio-overrides GET | withProjectAuth | N/A | normal | N/A |
| projects/[id]/audio-overrides PUT | withProjectAuth | auto | normal | Zod |
| projects/[id]/comparables GET | withProjectAuth | N/A | normal | N/A |
| projects/[id]/delete POST | withProjectAuth | auto | normal | N/A |
| projects/[id]/export GET | withProjectAuth | N/A | normal | N/A |
| projects/[id]/feedback POST | withProjectAuth | auto | normal | Zod |
| projects/[id]/feedback GET | withProjectAuth | N/A | normal | N/A |
| projects/[id]/regenerate-scene POST | withProjectAuth | auto | strict | Zod (parseBody) |
| projects/[id]/revisions GET | withProjectAuth | N/A | normal | N/A |
| projects/[id]/revisions POST | withProjectAuth | auto | normal | Zod |
| projects/[id]/revisions/compare GET | withProjectAuth | N/A | normal | N/A |
| projects/[id]/route GET/PATCH/DELETE | withProjectAuth | auto (mutations) | normal | Zod |
| projects/[id]/score GET | withProjectAuth | N/A | normal | N/A |
| projects/[id]/score POST | withProjectAuth | auto | strict | Zod |
| projects/[id]/suggestions GET | withProjectAuth | N/A | normal | Zod |
| projects/[id]/suggestions POST | withProjectAuth | auto | strict | Zod |
| projects/[id]/suggestions/[id] PATCH | withProjectAuth | auto | normal | Zod |
| projects/[id]/suggestions/[id]/rewrite POST | withProjectAuth | auto | strict | Zod |
| projects/[id]/voice-assignments GET | withProjectAuth | N/A | normal | N/A |
| projects/[id]/voice-assignments PUT | withProjectAuth | auto | normal | Zod |
| projects/[id]/workflow-mode POST | withProjectAuth | auto | normal | **MISSING** |
| projects/[id]/workflow-mode GET | withProjectAuth | N/A | normal | N/A |
| queue/status GET | withAuth | N/A | normal | N/A |
| reader/library GET | withAuth | N/A | normal | N/A |
| reader/library/[id] GET | withAuth + ownership | N/A | normal | N/A |
| reader/library/[id] PATCH | withAuth + ownership | auto | normal | **MISSING** |
| reader/library/[id] DELETE | withAuth + ownership | auto | normal | N/A |
| reader/library/[id]/favorite POST | withAuth + ownership | auto | normal | **MISSING** |
| reader/library/[id]/position POST | withAuth + ownership | auto | normal | **MISSING** |
| reader/upload/create-payment POST | withAuth | auto | normal | **MISSING** |
| reader/upload/process POST | withAuth | auto | strict | manual |
| revisions/[id] GET | withAuth + ownership | N/A | normal | N/A |
| revisions/[id] PUT | withAuth + ownership | auto | normal | Zod |
| revisions/[id] DELETE | withAuth + ownership | auto | normal | N/A |
| revisions/[id]/compare/[toId] GET | withAuth + ownership | N/A | normal | N/A |
| shares GET | withAuth + ownership filter | N/A | normal | N/A |
| shares POST | withAuth + ownership check | auto | normal | Zod |
| shares/[id] GET | withAuth + ownership | N/A | normal | N/A |
| shares/[id] PATCH | withAuth + ownership | auto | normal | Zod |
| shares/[id] DELETE | withAuth + ownership | auto | normal | N/A |
| shares/access/[code] GET | **None** | N/A | **none** | N/A |
| shares/access/[code] POST | **None** | **none** | strict | Zod |
| stripe/checkout POST | withAuth | auto | normal | manual |
| stripe/portal POST | withAuth | auto | normal | N/A |
| stripe/webhook POST | **None** (signature verified) | N/A | none | signature |
| suggestions/[id] GET | withAuth + ownership | N/A | normal | N/A |
| suggestions/[id] PUT | withAuth + ownership | auto | normal | Zod |
| suggestions/[id] DELETE | withAuth + ownership | auto | normal | N/A |
| suggestions/[id]/rewrite GET | withAuth + ownership | N/A | normal | N/A |
| suggestions/[id]/rewrite POST | withAuth + ownership | auto | normal | Zod |
| teams GET | withAuth | N/A | normal | N/A |
| teams POST | withAuth | auto | normal | Zod |
| teams/[id]/members GET | withAuth + team access | N/A | normal | N/A |
| teams/[id]/members POST | withAuth + owner check | auto | normal | Zod |
| teams/[id]/members DELETE | withAuth + owner check | auto | normal | Zod |
| teams/share POST | withAuth + ownership | auto | normal | Zod |
| teams/share DELETE | withAuth + ownership | auto | normal | Zod |
| voices GET | withAuth | N/A | normal | N/A |
| webhooks/clerk POST | **None** (signature verified) | N/A | none | signature |
