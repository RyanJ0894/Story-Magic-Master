# Data Tiers Architecture Audit — 2026-05-07

**Scope:** 9 new Prisma models + JSON fields added since 2026-05-06 review  
**Models Audited:** CreditTransaction, PodcastFeed, VoiceClone, ApiKey, WebhookEndpoint, HumanReview, ProjectComment, SceneShare (sceneIndex/sceneStartMs), DirectorNotes/EmotionOverrides (JSON on Project)  
**Status:** 4 CRITICAL findings, 3 HIGH findings, 4 MEDIUM findings, 4 LOW findings identified

---

## CRITICAL Findings

### [NEW] Missing foreign key constraint on HumanReview.jobId
**Where:** `packages/web/prisma/schema.prisma:1078` (HumanReview model)  
**Issue:** The `jobId` field is a String UUID with no foreign key relation to Job model. This allows orphaned HumanReview records if a job is deleted. Additionally, `userId` (the customer) is never referenced to Profile, creating a data integrity gap where reviews exist for non-existent users.

**Current Schema:**
```prisma
model HumanReview {
  id                   String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId            String    @map("project_id") @db.Uuid
  jobId                String    @map("job_id") @db.Uuid  // ← NO FK constraint
  userId               String    @map("user_id")        // ← NO FK constraint
  // ... fields ...
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  // Missing: Job and Profile relations
}
```

**Fix:** Add foreign key relations to Job and Profile:
```prisma
model HumanReview {
  id                   String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId            String    @map("project_id") @db.Uuid
  jobId                String    @unique @map("job_id") @db.Uuid  // already unique in schema
  userId               String    @map("user_id")
  status               String    @default("pending")
  reviewerNotes        String?   @map("reviewer_notes") @db.Text
  reviewedAt           DateTime? @map("reviewed_at")
  reviewedBy           String?   @map("reviewed_by")
  notifiedReviewerAt   DateTime? @map("notified_reviewer_at")
  notifiedCustomerAt   DateTime? @map("notified_customer_at")
  amountCents          Int       @default(9900) @map("amount_cents")
  createdAt            DateTime  @default(now()) @map("created_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  job     Job     @relation(fields: [jobId], references: [id], onDelete: Cascade)  // NEW
  user    Profile @relation(fields: [userId], references: [id], onDelete: Cascade) // NEW

  @@unique([jobId])
  @@index([status, createdAt(sort: Desc)])
  @@index([userId])
  @@index([projectId])  // NEW: for queries like HumanReview.findFirst({where:{projectId}})
  @@map("human_reviews")
}
```

**Migration SQL:**
```sql
-- Add foreign key for jobId
ALTER TABLE "human_reviews" ADD CONSTRAINT "human_reviews_job_id_fkey"
  FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add foreign key for userId
ALTER TABLE "human_reviews" ADD CONSTRAINT "human_reviews_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add index for projectId queries
CREATE INDEX IF NOT EXISTS "human_reviews_project_id_idx" ON "human_reviews"("project_id");
```

**Severity:** 🔴 **CRITICAL** — Orphaned records + cascading issues on Job/Profile deletion

---

### [NEW] Credit system idempotency gap on webhook retries
**Where:** `packages/web/app/api/stripe/webhook/route.ts:58–77` (credit_purchase handler)  
**Issue:** The credit purchase webhook uses `Promise.all()` to update profile and create transaction without idempotency protection. If Stripe retries a `checkout.session.completed` event, the profile's credits are incremented twice and two CreditTransaction records are created. Unlike `advanced_analysis` and `human_review` purchases which use upsert on `stripePaymentIntentId`, the credit system lacks any deduplication.

**Current Code:**
```typescript
if (session.metadata?.type === 'credit_purchase') {
  const { userId: creditUserId, credits } = session.metadata;
  const creditAmount = parseInt(credits ?? '0', 10);
  if (creditUserId && creditAmount > 0) {
    await Promise.all([
      prisma.profile.update({
        where: { id: creditUserId },
        data: { credits: { increment: creditAmount } },  // ← Non-idempotent
      }),
      prisma.creditTransaction.create({
        data: {
          profileId: creditUserId,
          amount: creditAmount,
          reason: 'purchase',
        },
      }),
    ]);
  }
  break;
}
```

**Problem:**
- Stripe can retry webhook delivery multiple times (network failures, processing delays, manual retries via dashboard)
- Profile.credits gets incremented on each retry
- Multiple CreditTransaction records with same reason and amount created
- Balance calculations for users will be corrupted

**Fix:** Add unique constraint on stripeSessionId in CreditTransaction and use upsert:

1. **Schema update** — Add Stripe session tracking to CreditTransaction:
```prisma
model CreditTransaction {
  id               String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  profileId        String    @map("profile_id")
  amount           Int       // positive = credit, negative = debit
  reason           String    // signup_bonus | purchase | scene_generation | refund
  jobId            String?   @map("job_id") @db.Uuid
  stripeSessionId  String?   @unique @map("stripe_session_id")  // NEW: webhook idempotency
  createdAt        DateTime  @default(now()) @map("created_at")

  profile Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId])
  @@map("credit_transactions")
}
```

2. **Migration SQL:**
```sql
ALTER TABLE "credit_transactions" ADD COLUMN IF NOT EXISTS "stripe_session_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "credit_transactions_stripe_session_id_key"
  ON "credit_transactions"("stripe_session_id") WHERE "stripe_session_id" IS NOT NULL;
```

3. **Webhook handler update:**
```typescript
if (session.metadata?.type === 'credit_purchase') {
  const { userId: creditUserId, credits } = session.metadata;
  const creditAmount = parseInt(credits ?? '0', 10);
  if (creditUserId && creditAmount > 0) {
    const stripeSessionId = session.id;
    
    // Check if already processed
    const existing = await prisma.creditTransaction.findUnique({
      where: { stripeSessionId },
    });
    if (existing) {
      log.info('credit_purchase already processed (retry)', { stripeSessionId });
      break;  // Idempotent: already done
    }

    // Atomic: update profile and record transaction in same transaction
    await prisma.$transaction(async (tx) => {
      await tx.profile.update({
        where: { id: creditUserId },
        data: { credits: { increment: creditAmount } },
      });
      await tx.creditTransaction.create({
        data: {
          profileId: creditUserId,
          amount: creditAmount,
          reason: 'purchase',
          stripeSessionId,  // NEW: prevent retries
        },
      });
    });
    
    log.info('credit_purchase recorded', { userId: creditUserId, credits: creditAmount });
  }
  break;
}
```

**Severity:** 🔴 **CRITICAL** — User balance corruption on webhook retries (financial data integrity)

---

### [NEW] WebhookEndpoint.secret stored plaintext; no HMAC verification in signature validation
**Where:** `packages/web/prisma/schema.prisma:1057–1069` (WebhookEndpoint model)  
**Issue:** Webhook secrets are stored as plaintext in the database. The schema includes a comment `//' HMAC-SHA256 signing secret (stored plaintext — needed for signing)'` acknowledging this. However, there is no verification that the outgoing webhook signatures are actually HMAC-signed. If the secret is exposed via database breach, attackers can forge valid webhook signatures.

**Current Schema:**
```prisma
model WebhookEndpoint {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId    String   @map("user_id")
  url       String
  secret    String   // HMAC-SHA256 signing secret (stored plaintext — needed for signing)
  events    String[]
  createdAt DateTime @default(now()) @map("created_at")

  user Profile @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("webhook_endpoints")
}
```

**Problem:**
- Plaintext storage is unavoidable (needed for HMAC signing)
- But no verification that webhooks are actually signed
- No audit trail of webhook deliveries
- No way to rotate secrets without breaking active endpoints

**Fix:**
1. Add WebhookDeliveryLog table to track deliveries:
```prisma
model WebhookDeliveryLog {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  endpointId      String    @map("endpoint_id") @db.Uuid
  eventType       String    @map("event_type")
  payload         Json
  signature       String    // For audit trail
  statusCode      Int       @map("status_code")
  responseBody    String?   @map("response_body")
  deliveredAt     DateTime  @default(now()) @map("delivered_at")
  nextRetryAt     DateTime? @map("next_retry_at")
  retryCount      Int       @default(0) @map("retry_count")

  endpoint WebhookEndpoint @relation(fields: [endpointId], references: [id], onDelete: Cascade)

  @@index([endpointId, deliveredAt(sort: Desc)])
  @@map("webhook_delivery_logs")
}
```

2. Update WebhookEndpoint schema:
```prisma
model WebhookEndpoint {
  id                String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId            String    @map("user_id")
  url               String
  secret            String    // HMAC-SHA256 signing secret
  secretRotatedAt   DateTime? @map("secret_rotated_at")
  events            String[]
  isActive          Boolean   @default(true) @map("is_active")
  lastTestedAt      DateTime? @map("last_tested_at")  // For health checks
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @default(now()) @updatedAt @map("updated_at")

  user             Profile              @relation(fields: [userId], references: [id], onDelete: Cascade)
  deliveryLogs     WebhookDeliveryLog[]

  @@index([userId])
  @@index([isActive])
  @@map("webhook_endpoints")
}
```

3. Add API endpoint for secret rotation (`/api/webhooks/[id]/rotate-secret`)

**Severity:** 🔴 **CRITICAL** — Database compromise = webhook forgery + no audit trail for PII/payment events

---

### [NEW] Missing user foreign key and index on ProjectComment.userId
**Where:** `packages/web/prisma/migrations/0018_project_comments/migration.sql:1-19` and `packages/web/prisma/schema.prisma:723–740`  
**Issue:** ProjectComment has a `userId` field with a Prisma relation to Profile, but the migration SQL (0018) never added a foreign key constraint. The schema shows the relation is defined in Prisma, but the raw SQL migration is incomplete.

**Migration SQL (0018):**
```sql
CREATE TABLE project_comments (
  id                 UUID         NOT NULL DEFAULT gen_random_uuid(),
  project_id         UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id            TEXT         NOT NULL,  -- ← FK missing
  scene_index        INTEGER,
  audio_timestamp_ms INTEGER,
  body               TEXT         NOT NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_project_comments PRIMARY KEY (id)
);

CREATE INDEX idx_project_comments_project_created ON project_comments (project_id, created_at DESC);
CREATE INDEX idx_project_comments_user ON project_comments (user_id);  -- ← Index exists but FK doesn't
```

**Current Schema:**
```prisma
model ProjectComment {
  id               String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId        String   @map("project_id") @db.Uuid
  userId           String   @map("user_id")
  // ... fields ...
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  author  Profile @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([projectId, createdAt(sort: Desc)])
  @@index([userId])
  @@map("project_comments")
}
```

**Problem:**
- Prisma enforces the FK at the ORM level, but raw SQL queries bypass it
- Orphaned comments remain if a user account is deleted
- Data integrity at DB level depends on application layer only

**Fix:** Add missing FK constraint:
```sql
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

**Severity:** 🔴 **CRITICAL** — Orphaned data + potential referential integrity violations in direct SQL queries

---

## HIGH Findings

### [NEW] PodcastFeed missing user ownership index
**Where:** `packages/web/prisma/schema.prisma:309–324` (PodcastFeed model)  
**Issue:** PodcastFeed is project-scoped (unique on projectId), but the model doesn't cache user ownership. When listing podcasts for a user, the query must join through Project to filter by userId. Current indexes don't support the common query pattern: "list all podcasts for userId X".

**Current Schema:**
```prisma
model PodcastFeed {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId     String    @unique @map("project_id") @db.Uuid
  episodeTitle  String    @map("episode_title")
  // ... fields ...
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  @@map("podcast_feeds")  // ← No indexes on userId path
}
```

**Query Pattern (Inferred from UI):**
```typescript
// Find all published podcasts for a user
const feeds = await prisma.podcastFeed.findMany({
  where: {
    published: true,
    project: { userId: currentUserId },  // ← Requires JOIN through Project
  },
});
```

**Problem:**
- Query requires JOIN to Project on every list/filter operation
- No composite index on (published, projectId) or denormalized userId
- Scales poorly as podcast_feeds table grows

**Fix:** Add userId as denormalized column with index:
```prisma
model PodcastFeed {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId     String    @unique @map("project_id") @db.Uuid
  userId        String    @map("user_id")           // NEW: denormalized for ownership queries
  episodeTitle  String    @map("episode_title")
  description   String    @db.Text
  coverArtUrl   String?   @map("cover_art_url")
  rssFeedSlug   String    @unique @map("rss_feed_slug")
  published     Boolean   @default(false)
  publishedAt   DateTime? @map("published_at")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @default(now()) @updatedAt @map("updated_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    Profile @relation("PodcastFeedsOwned", fields: [userId], references: [id], onDelete: Cascade)  // NEW

  @@unique([projectId])
  @@index([userId, published])    // NEW: supports "user's published podcasts" queries
  @@index([rssFeedSlug])          // NEW: for public RSS feed lookups
  @@map("podcast_feeds")
}
```

**Migration SQL:**
```sql
ALTER TABLE "podcast_feeds" ADD COLUMN "user_id" TEXT NOT NULL DEFAULT '';

-- Backfill user_id from projects
UPDATE "podcast_feeds"
SET "user_id" = p."user_id"
FROM "projects" p
WHERE p."id" = "podcast_feeds"."project_id";

-- Add FK and indexes
ALTER TABLE "podcast_feeds" ADD CONSTRAINT "podcast_feeds_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "podcast_feeds_user_id_published_idx"
  ON "podcast_feeds"("user_id", "published");

CREATE INDEX IF NOT EXISTS "podcast_feeds_rss_feed_slug_idx"
  ON "podcast_feeds"("rss_feed_slug");
```

**Severity:** 🟠 **HIGH** — Performance regression as user podcast count grows; queries force JOIN instead of direct filter

---

### [NEW] CreditTransaction.jobId not indexed; queries slow for job-linked credits
**Where:** `packages/web/prisma/schema.prisma:295–307` (CreditTransaction model)  
**Issue:** CreditTransaction has a jobId field (linking credits to generation jobs) but no index. When querying credits for a specific job (e.g., "was credit deducted for job X?"), the database must scan the entire table or use the profileId index + filter, both inefficient.

**Current Schema:**
```prisma
model CreditTransaction {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  profileId String   @map("profile_id")
  amount    Int
  reason    String
  jobId     String?  @map("job_id") @db.Uuid  // ← No index
  createdAt DateTime @default(now()) @map("created_at")

  profile Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId])  // ← Only this index exists
  @@map("credit_transactions")
}
```

**Problem:**
- Job-linked credit lookups require full table scan or multi-index merge
- Audit queries like "all credits for job X" slow down
- Potential to double-charge if credit lookup fails

**Fix:**
```prisma
model CreditTransaction {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  profileId String   @map("profile_id")
  amount    Int       // positive = credit, negative = debit
  reason    String    // signup_bonus | purchase | scene_generation | refund
  jobId     String?   @map("job_id") @db.Uuid
  createdAt DateTime  @default(now()) @map("created_at")

  profile Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId])
  @@index([jobId])                    // NEW: for job-linked credit lookups
  @@index([profileId, createdAt(sort: Desc)])  // NEW: for "credits in date range" queries
  @@map("credit_transactions")
}
```

**Migration SQL:**
```sql
CREATE INDEX IF NOT EXISTS "credit_transactions_job_id_idx"
  ON "credit_transactions"("job_id");

CREATE INDEX IF NOT EXISTS "credit_transactions_profile_id_created_at_idx"
  ON "credit_transactions"("profile_id", "created_at" DESC);
```

**Severity:** 🟠 **HIGH** — Audit trail queries slow; double-charge risk if lookups time out

---

### [CARRYOVER] Missing composite index on Purchase(projectId, purchaseType, status)
**Where:** `packages/web/prisma/schema.prisma:289–293` (Purchase model)  
**Status:** 🟠 **HIGH** (from 2026-05-06 review, not yet fixed)  
**Note:** The schema NOW includes `@@index([projectId, purchaseType, status])` at line 291, which means **this issue was already remediated in a migration after the prior review**. The fix is in place. No further action needed.

---

## MEDIUM Findings

### [NEW] Missing index on ApiKey.keyHash for authentication lookup
**Where:** `packages/web/prisma/schema.prisma:1041–1055` (ApiKey model)  
**Issue:** ApiKey.keyHash is marked `@unique`, which creates a unique constraint but Prisma may not automatically create an index for lookups. The migration (0019) includes both a unique constraint AND a separate index on keyHash, which is redundant but safe. However, missing the index at the Prisma schema level could cause issues during future schema changes.

**Current Schema & Migration:**
```prisma
model ApiKey {
  id         String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId     String    @map("user_id")
  name       String
  keyHash    String    @unique @map("key_hash")
  keyPrefix  String    @map("key_prefix")
  lastUsedAt DateTime? @map("last_used_at")
  createdAt  DateTime  @default(now()) @map("created_at")

  user Profile @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([keyHash])  // ← Explicitly in schema (redundant but safe)
  @@map("api_keys")
}
```

**Migration (0019) SQL:**
```sql
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys"("key_hash");  -- Redundant
```

**Problem:**
- The explicit index in Prisma schema is good for documentation
- But the unique constraint alone should suffice for PG
- Migration creates both, which is not harmful but wastes storage

**Fix:** Remove the redundant index from the schema (unique constraint on keyHash is sufficient):
```prisma
model ApiKey {
  id         String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId     String    @map("user_id")
  name       String
  keyHash    String    @unique @map("key_hash")  // Unique constraint = index for lookups
  keyPrefix  String    @map("key_prefix")
  lastUsedAt DateTime? @map("last_used_at")
  createdAt  DateTime  @default(now()) @map("created_at")

  user Profile @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  // @@index([keyHash]) -- REMOVE: @unique creates implicit index
  @@map("api_keys")
}
```

**Severity:** 🟡 **MEDIUM** — Schema bloat; no performance impact but confusing for future maintainers

---

### [NEW] VoiceClone missing unique constraint on elevenLabsVoiceId
**Where:** `packages/web/prisma/schema.prisma:1024–1035` (VoiceClone model)  
**Issue:** ElevenLabs voice IDs are globally unique identifiers from the ElevenLabs API. If a user somehow clones two voices with the same ElevenLabs voice ID (e.g., user creates clone, account deleted, same user re-creates from same audio sample), the database will accept duplicates. The model should enforce uniqueness at the database level.

**Current Schema:**
```prisma
model VoiceClone {
  id                 String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId             String   @map("user_id")
  name               String
  elevenLabsVoiceId  String   @map("elevenlabs_voice_id")  // ← No @unique or @@unique constraint
  createdAt          DateTime @default(now()) @map("created_at")

  user Profile @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("voice_clones")
}
```

**Problem:**
- ElevenLabs voice IDs are global and immutable (they are the identity of the cloned voice)
- Two users should never have a VoiceClone with the same elevenLabsVoiceId
- Application code may assume elevenLabsVoiceId uniqueness for permission checks

**Fix:**
```prisma
model VoiceClone {
  id                 String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId             String   @map("user_id")
  name               String
  elevenLabsVoiceId  String   @unique @map("elevenlabs_voice_id")  // NEW: globally unique
  createdAt          DateTime @default(now()) @map("created_at")

  user Profile @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("voice_clones")
}
```

**Migration SQL:**
```sql
CREATE UNIQUE INDEX IF NOT EXISTS "voice_clones_elevenlabs_voice_id_key"
  ON "voice_clones"("elevenlabs_voice_id");
```

**Severity:** 🟡 **MEDIUM** — Data integrity; duplicate voice IDs could cause voice assignment conflicts

---

### [NEW] ProjectComment missing composite index for efficient scene/timestamp queries
**Where:** `packages/web/prisma/schema.prisma:723–740` (ProjectComment model)  
**Issue:** ProjectComment supports querying by sceneIndex and audioTimestampMs to display comments at specific timeline positions. Current indexes support projectId + createdAt, but not queries like "comments for project X at scene 5".

**Current Schema:**
```prisma
model ProjectComment {
  id               String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId        String   @map("project_id") @db.Uuid
  userId           String   @map("user_id")
  sceneIndex       Int?     @map("scene_index")
  audioTimestampMs Int?     @map("audio_timestamp_ms")
  body             String   @db.Text
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @default(now()) @updatedAt @map("updated_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  author  Profile @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([projectId, createdAt(sort: Desc)])  // ← Doesn't support scene queries
  @@index([userId])
  @@map("project_comments")
}
```

**Problem:**
- Timeline UI likely queries: `findMany({ where: { projectId, sceneIndex }, orderBy: { createdAt } })`
- Current index doesn't support this efficiently
- Full table scan or multi-index merge required

**Fix:**
```prisma
model ProjectComment {
  id               String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId        String   @map("project_id") @db.Uuid
  userId           String   @map("user_id")
  sceneIndex       Int?     @map("scene_index")
  audioTimestampMs Int?     @map("audio_timestamp_ms")
  body             String   @db.Text
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @default(now()) @updatedAt @map("updated_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  author  Profile @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([projectId, createdAt(sort: Desc)])
  @@index([projectId, sceneIndex])              // NEW: for scene-based queries
  @@index([projectId, audioTimestampMs])        // NEW: for timestamp-based queries
  @@index([userId])
  @@map("project_comments")
}
```

**Migration SQL:**
```sql
CREATE INDEX IF NOT EXISTS "project_comments_project_id_scene_index_idx"
  ON "project_comments"("project_id", "scene_index");

CREATE INDEX IF NOT EXISTS "project_comments_project_id_audio_timestamp_idx"
  ON "project_comments"("project_id", "audio_timestamp_ms");
```

**Severity:** 🟡 **MEDIUM** — Timeline rendering may slow down with many comments; query planner chooses suboptimal index path

---

## LOW Findings (Backlog)

| ID | Severity | Title | Where | Fix |
|-----|----------|-------|-------|-----|
| 1 | 🟢 LOW | Missing NOT NULL constraint on ApiKey.userId | `schema.prisma:1043` | `userId String @map("user_id") @db.Map("NOT NULL")` — Actually, Prisma doesn't require NOT NULL on FK fields that are backed by relations. This is a false positive. **Status: NO ACTION** |
| 2 | 🟢 LOW | WebhookEndpoint should store endpoint_status (active/inactive/error) | `schema.prisma:1057–1069` | Add `isActive Boolean @default(true) @map("is_active")` for soft-delete pattern without data loss |
| 3 | 🟢 LOW | CreditTransaction.reason enum not validated; accepts arbitrary strings | `schema.prisma:298` | Change `reason String` to `reason String // @default("scene_generation")` with explicit enum values in schema comment or add enum type validation in app code |
| 4 | 🟢 LOW | ScriptShare.sceneIndex/sceneStartMs used but no corresponding indexes | `0012_scene_share/migration.sql` | Add `@@index([projectId, sceneIndex])` if scene-based shares are queried frequently |

---

## Summary of Fixes by Priority

### Immediate (Before Production Scale)
1. **Add FK constraints on HumanReview** (jobId, userId) — prevents orphaned data
2. **Implement credit transaction idempotency** (stripeSessionId unique constraint + upsert) — prevents balance corruption
3. **Add missing FK on ProjectComment.userId** — ensures referential integrity
4. **Denormalize userId on PodcastFeed + add indexes** — query performance

### This Sprint (High Priority)
1. **Implement WebhookDeliveryLog** + secret rotation endpoint
2. **Add jobId and composite indexes on CreditTransaction**
3. **Add elevenLabsVoiceId unique constraint on VoiceClone**
4. **Add scene/timestamp indexes on ProjectComment**

### Cleanup (Next Sprint)
1. Remove redundant index on ApiKey.keyHash (keep @unique constraint)
2. Add isActive field to WebhookEndpoint for soft-delete pattern

---

## Ownership Enforcement Summary (All Routes Verified ✅)

**Routes Checked:**
- ✅ `/api/projects/[id]/director-notes` — Uses `withProjectAuth` middleware
- ✅ `/api/projects/[id]/emotion-overrides` — Uses `withProjectAuth` middleware
- ✅ `/api/projects/[id]/podcast` — Uses `withProjectAuth` middleware
- ✅ `/api/projects/[id]/comments` — Custom `getAccessibleProject()` checks owner + TeamShare + ScriptShare
- ✅ `/api/projects/[id]/human-review` — Uses `withProjectAuth` middleware
- ✅ `/api/credits/purchase` — Uses `withAuth` middleware (user-scoped, not project-scoped)
- ✅ `/api/api-keys` — Uses `withAuth` middleware (user-scoped)
- ✅ `/api/voices/clones` — Uses `withAuth` middleware (user-scoped)

**Credit deduction atomicity:** ✅ Uses `prisma.$transaction()` to atomically decrement credits + record CreditTransaction (lines 129–142 in `/api/generate/route.ts`)

**Webhook secret storage:** ⚠️ Plaintext (required for HMAC signing) — see CRITICAL finding #3 for audit trail recommendations

---

## Conclusion

The 9 new models demonstrate solid Prisma schema design with proper CASCADE deletes and relation coverage. However, **4 CRITICAL issues** exist around data integrity and webhook security:

1. **HumanReview missing FKs** — Allows orphaned reviews
2. **Credit system lacking idempotency** — Duplicate webhook events corrupt balance
3. **WebhookEndpoint secrets + no delivery audit trail** — Security risk
4. **ProjectComment missing FK** — Referential integrity gap

All identified issues are straightforward to remediate and should be prioritized before scaling to production traffic.

**Overall Architecture Grade: B** (up from B+ in prior review)
- Security: B (webhook audit trail missing)
- Correctness: B- (missing idempotency, FKs)
- Performance: B (indexes needed on new high-query columns)
- Maintainability: B (schema is clear but some constraints missing)

