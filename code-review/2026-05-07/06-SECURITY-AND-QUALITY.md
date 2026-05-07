# Security and Quality — 2026-05-07

## Security Findings

### [NEW] CRITICAL: Credit purchase webhook non-idempotent
**File:** `packages/web/app/api/stripe/webhook/route.ts:58–77`

Stripe retries webhooks on any network failure or 5xx. The `credit_purchase` handler uses `prisma.profile.update({ credits: { increment: N } })` without a deduplication check. Every retry increments the user's credit balance.

**Contrast:** The `advanced_analysis` and `human_review` handlers in the same file already use `stripePaymentIntentId` for idempotency. The credit handler was the only one missing this pattern.

**Fix:** Add `stripeSessionId` unique column to `CreditTransaction`, pre-flight check before applying, wrap in `prisma.$transaction`. See `08-DATA-TIERS.md` for full SQL + schema fix.

---

### [NEW] HIGH: WebhookEndpoint.secret stored in plaintext
**File:** `packages/web/prisma/schema.prisma:1057–1069`

Webhook signing secrets are stored plaintext — this is technically required for HMAC signing but creates risk if the database is compromised. Currently there is no:
- Delivery audit log (no `WebhookDeliveryLog` model)
- Secret rotation endpoint
- `isActive` flag for soft-disable

**Mitigation (already present):** HMAC-SHA256 signing is applied on all webhook sends. The plaintext secret is only used server-side for signing.

**Sprint action:** Add `WebhookDeliveryLog` model + rotation endpoint.

---

### Ownership Enforcement (All New Endpoints — VERIFIED ✅)
All 8 new API routes from Sprint D–G correctly enforce user ownership:

| Route | Mechanism | Verified |
|-------|-----------|---------|
| `/api/projects/[id]/director-notes` | `withProjectAuth` | ✅ |
| `/api/projects/[id]/emotion-overrides` | `withProjectAuth` | ✅ |
| `/api/projects/[id]/podcast` | `withProjectAuth` | ✅ |
| `/api/projects/[id]/comments` | `getAccessibleProject()` (owner + TeamShare + ScriptShare) | ✅ |
| `/api/projects/[id]/human-review` | `withProjectAuth` | ✅ |
| `/api/credits/purchase` | `withAuth` (user-scoped) | ✅ |
| `/api/api-keys` | `withAuth` (user-scoped) | ✅ |
| `/api/voices/clones` | `withAuth` (user-scoped) | ✅ |

---

### Input Validation (Sprint D–G)
- **Voice clone upload:** File type allowlist (MP3/WAV/M4A), 10MB size limit
- **API key creation:** `https://` prefix enforced on webhook URLs; event enum allowlist
- **Director notes:** `z.string().max(5000)` Zod validation
- **Comments:** `z.string().min(1).max(2000)` with auth ownership check before write
- **Fountain/FDX import:** File type validated; malformed parser returns structured error

---

## Code Quality

### No production console.log
Zero `console.log/debug/warn` calls in production code paths. All logging goes through the `log` adapter (`@/lib/logger`).

### No SQL injection vectors
All database access uses Prisma ORM with parameterized queries. No raw SQL in application code (only Prisma schema migration files which are developer-authored and version-controlled).

### Prompt injection protection
`sanitizeScriptText()` in `generate/route.ts` strips common injection patterns before script content reaches the LLM pipeline.
