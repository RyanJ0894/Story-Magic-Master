# Security and Quality — 2026-05-06

## Security Findings

### [RESOLVED NEW] Stripe webhook idempotency — `webhook/route.ts`
**Severity:** CRITICAL → FIXED  
**Issue:** Duplicate webhook deliveries from Stripe would create multiple `Purchase` records.  
**Fix:** `upsert` on `stripePaymentIntentId` + `@unique` schema constraint + DB migration 0011.

### [PASS] Model selection security — `route.ts`, `generate-scenes.ts`
Model choice is entirely server-side: the route creates a Stripe checkout; the orchestrator reads the DB. Client input never influences which model is used.

### [PASS] Ownership verification — `withProjectAuth` middleware
Both GET and POST of the advanced-analysis route pass through `withProjectAuth`, which verifies the authenticated user owns the project before any DB write or Stripe session creation.

### [PASS] Accept header in audio.ts
The `Accept: 'audio/pcm'` header on ElevenLabs TTS requests is semantically imprecise (ElevenLabs uses `output_format` in the body, not Accept), but causes no functional issue. Not a security concern.

## Quality Findings

### [PASS] TypeScript errors
0 errors across both packages.

### [PASS] `any` casts
Zero `any` casts in application code (only in generated Prisma files).

### [PASS] TODOs
Zero TODOs in application code.

### [MEDIUM] Missing composite index — FIXED
Added `@@index([projectId, purchaseType, status])` to `Purchase` model in both schemas + migration 0011. The orchestrator `findFirst` lookup is now covered by an efficient index.

### [MEDIUM] ELEVENLABS_MODEL + DIRECTOR_MODEL_ADVANCED undocumented — FIXED
Both vars added to `packages/orchestrator/.env.example` with descriptions.
