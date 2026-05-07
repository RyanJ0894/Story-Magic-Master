# Data Tiers Architecture Audit
**Date:** 2026-05-06  
**Scope:** Advanced Analysis upgrade feature (commit 5048f55), ElevenLabs TTS optimizations (commit 33ffc75), test fixes (commit ba24d9a)  
**Auditor:** Automated Code Review System

---

## Executive Summary

The Data Tiers architecture for the Advanced Analysis upgrade feature is **well-structured** with proper separation of concerns between billing (web package) and orchestration (orchestrator package). Stripe webhook integration correctly routes events to Purchase record creation, and the orchestrator safely performs server-side model selection based on database lookups.

**Critical Issues Found:** 1  
**High Issues Found:** 1  
**Medium Issues Found:** 1  
**Low Issues Found:** 2

---

## 1. Schema Consistency

### Status: ✅ PASS

**Finding:** Purchase model is correctly defined in both packages:

- **Web package** (`/packages/web/prisma/schema.prisma` lines 262–282): Complete Purchase model with relations to Profile and Project, proper indexing
- **Orchestrator package** (`/packages/orchestrator/prisma/schema.prisma` lines 50–66): Read-only Purchase model with essential fields for lookup (userId, projectId, purchaseType, status)

Both schemas use the same database (shared `DATABASE_URL`), and the orchestrator schema intentionally mirrors only the fields it needs, maintaining clean architectural boundaries.

**Key Fields:**
- `userId`: Ownership verification
- `projectId`: Per-project billing scope
- `purchaseType`: 'advanced_analysis' discriminator
- `status`: 'completed' for active purchases
- `stripePaymentIntentId`: Audit trail

**Indexes Present:**
- userId (efficient user-scoped queries)
- projectId (efficient project-scoped queries)
- stripePaymentIntentId (webhook idempotency support — though not utilized)

---

## 2. Stripe Webhook Completeness

### Status: ⚠️ CRITICAL ISSUE IDENTIFIED

**File:** `/packages/web/app/api/stripe/webhook/route.ts` lines 57–82

**Issue:** **Missing idempotency protection on webhook events**

The webhook handler correctly identifies and processes `checkout.session.completed` events with `metadata.type === 'advanced_analysis'`, but lacks idempotency protection. Stripe may retry webhook delivery multiple times (due to network failures, processing delays, or manual retries), and duplicate events will create multiple Purchase records for the same transaction.

**Code Analysis:**
```typescript
// Lines 57-82: Creates Purchase without deduplication
await prisma.purchase.create({
  data: {
    userId: advUserId,
    projectId,
    purchaseType: 'advanced_analysis',
    amountCents: 999,
    currency: session.currency ?? 'usd',
    stripePaymentIntentId: paymentIntentId,
    status: 'completed',
  },
});
```

**Problem:**
1. No `findFirst` check before `create`
2. No unique constraint on `(stripePaymentIntentId)` or `(stripePaymentIntentId, purchaseType)`
3. Database accepts multiple Purchase records for same `paymentIntentId`
4. Orchestrator lookup uses `findFirst()` by `projectId` only (lines 102–109 in generate-scenes.ts), so duplicate records don't affect model selection, but billing data becomes corrupted

**Impact:**
- Duplicate payment records in database
- Incorrect usage analytics and revenue reports
- Potential double-charging scenarios if charge amounts are summed

**Severity:** 🔴 **CRITICAL**

**Remediation:**
1. **Add unique constraint** to web schema:
   ```prisma
   model Purchase {
     // ... existing fields ...
     stripePaymentIntentId String? @unique @map("stripe_payment_intent_id")
     // ...
   }
   ```
   
2. **Update webhook handler** to use upsert:
   ```typescript
   await prisma.purchase.upsert({
     where: { stripePaymentIntentId: paymentIntentId },
     create: { /* ... */ },
     update: { status: 'completed' }, // idempotent
   });
   ```

3. **Add Stripe event deduplication** (optional, defense-in-depth):
   ```typescript
   const eventId = event.id; // Stripe Event ID
   const existingEvent = await prisma.webhookEvent.findUnique({
     where: { stripeEventId: eventId },
   });
   if (existingEvent) return NextResponse.json({ received: true });
   ```

---

## 3. API Route Security (Advanced Analysis Endpoint)

### Status: ✅ PASS

**File:** `/packages/web/app/api/projects/[id]/advanced-analysis/route.ts`

**Findings:**

**GET Endpoint:**
- ✅ Uses `withProjectAuth` middleware ensuring authenticated user owns the project
- ✅ Returns `{ purchased: boolean, price: 999 }` — safe to expose
- ✅ Gracefully handles missing projects with 404 response

**POST Endpoint (Checkout):**
- ✅ Ownership verified via `withProjectAuth`
- ✅ Duplicate purchase check prevents re-purchasing:
  ```typescript
  const existing = await prisma.purchase.findFirst({
    where: { projectId, purchaseType: 'advanced_analysis', status: 'completed' }
  });
  if (existing) return res.status(400).json({ error: 'Already purchased' });
  ```
- ✅ Stripe session metadata correctly includes `userId` and `projectId` for webhook correlation
- ✅ Metadata type discriminator (`type: 'advanced_analysis'`) ensures proper routing in webhook handler

**Ownership Verification Flow:**
```
Client Request → withProjectAuth middleware
  → Verify req.user.id owns project[id]
  → If not owned: return 403
  → If owned: proceed to endpoint logic
  → Check for existing Purchase record
  → Create Stripe checkout session
  → Return clientSecret
```

**No Security Gaps:** Model selection is server-side only (database lookup in orchestrator), client cannot influence which model is used.

---

## 4. Database Indexes

### Status: ⚠️ HIGH ISSUE IDENTIFIED

**File:** `/packages/web/prisma/schema.prisma` (Purchase model)

**Current Indexes:**
```prisma
@@index([userId])
@@index([projectId])
@@index([stripePaymentIntentId])
```

**Issue:** Missing composite index for the most common query pattern

**Analysis:**

The orchestrator's `generate-scenes.ts` (lines 102–109) performs:
```typescript
const advancedPurchase = await prisma.purchase.findFirst({
  where: {
    projectId: project_id,
    purchaseType: 'advanced_analysis',
    status: 'completed',
  },
  select: { id: true },
});
```

This query filters on **three columns** (`projectId`, `purchaseType`, `status`), but the schema only has:
- Single-column index on `projectId`
- No index covering `(projectId, purchaseType, status)`

**Impact:**
- Query planner cannot use index efficiently
- Full table scan or multi-index merge required
- Latency increases with table growth

**Severity:** 🟠 **HIGH**

**Remediation:**

Add composite index to web schema:
```prisma
model Purchase {
  // ... fields ...
  
  @@index([userId])
  @@index([projectId])
  @@index([stripePaymentIntentId])
  @@index([projectId, purchaseType, status]) // NEW: covers common query
  @@map("purchases")
}
```

Update orchestrator read-only schema similarly:
```prisma
model Purchase {
  // ... fields ...
  
  @@index([userId])
  @@index([projectId])
  @@index([stripePaymentIntentId])
  @@index([projectId, purchaseType, status]) // NEW
  @@map("purchases")
}
```

---

## 5. Seed Data

### Status: ⚠️ MEDIUM ISSUE IDENTIFIED

**Finding:** No seed data exists for Purchase test records

**Files Checked:**
- `/packages/web/prisma/seed.ts` — Does not create Purchase records
- `/packages/web/prisma/seeds/` — No advanced_analysis test fixtures

**Issue:** Development and testing environments lack realistic Purchase data, making it difficult to:
- Test the orchestrator's `findFirst` lookup logic
- Verify webhook handler correctness
- Validate model selection behavior
- Test edge cases (missing purchase, expired purchase, etc.)

**Severity:** 🟡 **MEDIUM**

**Remediation:**

Create or update seed data to include:
```typescript
// In /packages/web/prisma/seed.ts
const purchase = await prisma.purchase.create({
  data: {
    userId: testUser.id,
    projectId: testProject.id,
    purchaseType: 'advanced_analysis',
    amountCents: 999,
    currency: 'usd',
    stripePaymentIntentId: 'pi_test_' + Date.now(),
    status: 'completed',
  },
});

console.log('✅ Seeded Purchase:', purchase.id);
```

Also create seed fixture for testing webhook handler:
```typescript
// Test fixture with multiple scenarios
- Purchase with completed status (should enable advanced model)
- Purchase with pending status (should not enable advanced model)
- Deleted purchase (should not enable advanced model)
```

---

## 6. Environment Variable Documentation

### Status: ⚠️ MEDIUM ISSUE IDENTIFIED

**Finding:** `ELEVENLABS_MODEL` environment variable is used in code but not documented in `.env.example`

**Files:**
- **Code uses it:** `/packages/orchestrator/src/lib/audio.ts` line 153
  ```typescript
  const modelId = process.env.ELEVENLABS_MODEL || DEFAULT_ELEVENLABS_MODEL;
  ```
  
- **Not documented:** `/packages/orchestrator/.env.example` (lines 45–52 cover ELEVENLABS_API_KEY and TTS_CONCURRENCY but omit ELEVENLABS_MODEL)

**Context:** Code comment (lines 26–29) explains the purpose:
> Override via ELEVENLABS_MODEL env var if needed (e.g. eleven_multilingual_v2 for non-English scripts, or eleven_flash_v2_5 for maximum speed at slight quality cost).

**Severity:** 🟡 **MEDIUM**

**Remediation:**

Add to `/packages/orchestrator/.env.example`:
```bash
# ElevenLabs Text-to-Speech Configuration
# API key for authentication with ElevenLabs
ELEVENLABS_API_KEY=

# Model ID for TTS generation (default: eleven_turbo_v2_5)
# Options:
#   - eleven_turbo_v2_5: Recommended (3× faster, same cost as v2)
#   - eleven_multilingual_v2: Non-English scripts
#   - eleven_flash_v2_5: Maximum speed (slight quality trade-off)
ELEVENLABS_MODEL=eleven_turbo_v2_5

# Maximum concurrent TTS requests
TTS_CONCURRENCY=5
```

Also update env validation in `/packages/orchestrator/src/lib/env.ts` to include ELEVENLABS_MODEL:
```typescript
const envSchema = z.object({
  // ... existing fields ...
  ELEVENLABS_MODEL: z.string().default('eleven_turbo_v2_5'),
  // ... rest ...
});
```

---

## 7. Row-Level Security (RLS) Gaps

### Status: ✅ PASS

**Finding:** No Supabase RLS policies are implemented; access control is entirely application-layer

**Analysis:**

Supabase RLS check (`grep -r "using (true)"` — found 0 matches):
- No RLS policies define database-level row access
- Access control depends on application middleware (withProjectAuth)
- Orchestrator queries Purchase directly without WHERE clauses that enforce userId

**Risk Assessment:**
- **Low Risk**: Web package's `withProjectAuth` middleware enforces project ownership before any query
- **Acceptable Pattern**: Orchestrator has its own authorization model (service-to-service with DATABASE_URL credentials, not user-scoped)
- **No Gap**: Database credentials are not exposed to clients; all access is server-side

**Design Rationale:**
- Web package: Application-layer authorization (sufficient, since API routes verify ownership)
- Orchestrator: Service account with full database access (appropriate for internal orchestration service)

**Recommendation:** This is acceptable for the current architecture. If future direct database access is enabled (e.g., GraphQL API), implement RLS policies as defense-in-depth.

---

## Summary Table

| Area | Status | Severity | Issue |
|------|--------|----------|-------|
| Schema Consistency | ✅ PASS | — | Properly mirrored between packages |
| Stripe Webhook | ⚠️ FAIL | 🔴 CRITICAL | Missing idempotency protection; duplicate records possible |
| API Security | ✅ PASS | — | Ownership verified via middleware |
| Indexes | ⚠️ FAIL | 🟠 HIGH | Missing composite index on (projectId, purchaseType, status) |
| Seed Data | ⚠️ FAIL | 🟡 MEDIUM | No Purchase test records in seed |
| Env Documentation | ⚠️ FAIL | 🟡 MEDIUM | ELEVENLABS_MODEL not documented in .env.example |
| RLS Gaps | ✅ PASS | — | No gaps; application-layer authorization is adequate |

---

## Action Items (Priority Order)

### 🔴 CRITICAL (Implement Immediately)
1. **Add unique constraint** on `Purchase.stripePaymentIntentId`
2. **Update webhook handler** to use upsert instead of create
3. **Test webhook retry scenarios** to verify idempotency

### 🟠 HIGH (Implement Before Production Scale)
1. **Add composite index** `(projectId, purchaseType, status)` to Purchase model
2. **Run query performance test** on orchestrator's findFirst lookup
3. **Monitor query latency** in production

### 🟡 MEDIUM (Implement in Next Sprint)
1. **Create Purchase seed data** for development/testing
2. **Add ELEVENLABS_MODEL** to .env.example and env validation
3. **Document model selection options** in README

---

## Conclusion

The Advanced Analysis upgrade feature demonstrates **solid architectural practices** with proper separation between billing (web) and orchestration layers. The critical idempotency issue and missing indexes are straightforward to remediate and should be addressed before handling significant transaction volume. Environment variable documentation gaps are low-impact but should be fixed for developer experience.

**Overall Architecture Grade: B+**
- Security: A (ownership verified, server-side model selection)
- Correctness: B (idempotency issue)
- Performance: B (missing indexes)
- Maintainability: A- (clear separation of concerns, minor documentation gap)
