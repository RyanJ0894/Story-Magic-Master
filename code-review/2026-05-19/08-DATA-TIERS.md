# Data Tiers Audit — 2026-05-19

**Scope:** Migrations 0023–0024 (Sprints K/L/M) + carryover verification from 2026-05-07 review  
**Models Audited:** Job (segments/firstAudioUrl), ProjectComment (reactionType), AudioOutput (jobId FK), Alert (isRead index)  
**Prior Review:** `code-review/2026-05-07/08-DATA-TIERS.md`

---

## Carryover Status from 2026-05-07 Review

| Prior Finding | Status |
|---|---|
| HumanReview missing FK (jobId, userId) | FIXED — migration 0022 |
| Credit idempotency (stripeSessionId unique) | FIXED — migration 0022 |
| WebhookEndpoint: WebhookDeliveryLog + isActive | FIXED — migration 0022 |
| **ProjectComment missing FK on user_id** | **STILL OPEN — not in any migration** |
| PodcastFeed userId denormalization + index | FIXED — migration 0022 |
| CreditTransaction jobId + composite indexes | FIXED — migration 0022 |
| VoiceClone elevenLabsVoiceId unique | FIXED — migration 0022 |
| ProjectComment scene/timestamp indexes | FIXED — migration 0022 |
| ApiKey redundant index removed | FIXED — migration 0022 |

---

## CRITICAL Findings

### [CARRYOVER] ProjectComment.user_id has no database FK constraint
**Where:** `packages/web/prisma/migrations/0018_project_comments/migration.sql:7`, `packages/web/prisma/schema.prisma:748`

**Issue:** Migration 0018 created `project_comments.user_id TEXT NOT NULL` with no `REFERENCES profiles(id)` clause. Migration 0022 fixed FKs for `human_reviews` and `podcast_feeds` but did not fix `project_comments`. No migration in the chain (`0018`–`0024`) has ever added this FK.

The Prisma schema declares the relation (`author Profile @relation(...)`) which enforces the FK at the ORM layer only. Direct SQL, bulk operations, or future Prisma raw queries bypass this enforcement. If a profile is deleted, orphaned `project_comments` rows remain indefinitely.

**Fix:**
```sql
-- New migration: 0025_fix_project_comments_user_fk
ALTER TABLE "project_comments"
  ADD CONSTRAINT "project_comments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
```

**Severity:** CRITICAL — Referential integrity gap; orphaned comments on user deletion

---

## HIGH Findings

### [NEW] Migration 0024 index name does not match Prisma schema
**Where:** `packages/web/prisma/migrations/0024_add_comment_reactions/migration.sql:9`, `packages/web/prisma/schema.prisma:754`

**Issue:** Migration 0024 created a composite index with a hand-written abbreviated name that does not match the name Prisma would generate for the same `@@index` declaration.

- **Schema declares:** `@@index([projectId, sceneIndex, reactionType])` on `ProjectComment`
- **Prisma-generated name** (deterministic): `project_comments_project_id_scene_index_reaction_type_idx`
- **Migration 0024 created:** `project_comments_project_id_scene_idx_reaction_idx`

When `prisma migrate status` runs, Prisma inspects the live database and compares against the shadow database derived from schema.prisma. It will report **schema drift** because the index it expects (`project_comments_project_id_scene_index_reaction_type_idx`) is absent, even though a functionally equivalent index (`project_comments_project_id_scene_idx_reaction_idx`) exists on the same columns. On any future `prisma migrate deploy`, Prisma may try to create the expected index as a duplicate, or `prisma migrate reset` will break the application.

**Fix:**
```sql
-- New migration: 0025_fix_project_comments_user_fk (append to same migration as above)
DROP INDEX IF EXISTS "project_comments_project_id_scene_idx_reaction_idx";
CREATE INDEX "project_comments_project_id_scene_index_reaction_type_idx"
  ON "project_comments" ("project_id", "scene_index", "reaction_type");
```

And update `schema.prisma` line 754 — no change needed; the `@@index` declaration is already correct. The migration name rename is sufficient.

**Severity:** HIGH — `prisma migrate status` will permanently report drift; future deploys risk duplicate index creation

---

### [NEW] Partial index on jobs.first_audio_url is not representable in Prisma schema
**Where:** `packages/web/prisma/migrations/0023_add_job_segments/migration.sql:10–12`

**Issue:** Migration 0023 adds a partial index:

```sql
CREATE INDEX IF NOT EXISTS "jobs_first_audio_url_not_null"
  ON "jobs" ("id")
  WHERE "first_audio_url" IS NOT NULL;
```

Prisma does not support `WHERE` clauses on `@@index` declarations (partial indexes). This index cannot be represented in `schema.prisma`. As a result:

1. `prisma migrate status` will always report **drift** for this index (present in DB, absent in schema).
2. `prisma migrate reset` will drop this index, degrading progressive playback polling performance.
3. `prisma db push` will drop and re-create it on every push if the schema is used for database sync.

The index itself is well-designed for the polling pattern (`GET /api/jobs/:id` filtering jobs with `firstAudioUrl` set), but its existence outside Prisma's tracking creates a maintenance hazard.

**Fix:** Add a comment block to schema.prisma documenting the untracked index, and add it as a post-migration raw step in the migration's SQL footer:

In `packages/web/prisma/schema.prisma`, add a comment to the `Job` model:
```prisma
// NOTE: Partial index "jobs_first_audio_url_not_null" ON jobs(id) WHERE first_audio_url IS NOT NULL
// was created manually in migration 0023. Prisma cannot represent partial indexes.
// Do NOT run prisma db push on production — it will drop this index.
```

Create a new migration `0025_...` that re-asserts it with `IF NOT EXISTS` (idempotent after reset):
```sql
-- Re-apply partial index dropped by prisma migrate reset
CREATE INDEX IF NOT EXISTS "jobs_first_audio_url_not_null"
  ON "jobs" ("id")
  WHERE "first_audio_url" IS NOT NULL;
```

**Severity:** HIGH — `prisma migrate status` reports permanent drift; `prisma migrate reset` silently degrades polling performance

---

### [NEW] Reaction upsert (deleteMany + create) is not atomic
**Where:** `packages/web/app/api/projects/[id]/comments/route.ts:130–145`

**Issue:** The reaction upsert pattern uses two separate Prisma operations with no wrapping transaction:

```typescript
// Line 131–133: Delete old reaction
await prisma.projectComment.deleteMany({
  where: { projectId, userId, sceneIndex, reactionType: { not: null } },
});
// Line 136–145: Create new reaction
const comment = await prisma.projectComment.create({ data: { ... } });
```

Under concurrent requests (same user double-tapping a reaction button, or network retry), this produces a race condition:

1. Request A: deleteMany (deletes 0 rows — none exist yet)
2. Request B: deleteMany (deletes 0 rows)
3. Request A: create → row inserted
4. Request B: create → second row inserted

Result: two reaction rows for the same user+scene. The GET endpoint groups by `reactionType` without deduplication, so the UI shows duplicate reactions. There is no `@@unique([userId, projectId, sceneIndex])` partial constraint to prevent this at the DB level.

**Fix (two-part):**

1. Add a partial unique constraint at the DB level:
```sql
-- In migration 0025
CREATE UNIQUE INDEX "project_comments_user_reaction_scene_uniq"
  ON "project_comments" ("project_id", "user_id", "scene_index")
  WHERE "reaction_type" IS NOT NULL;
```

This cannot be expressed in `schema.prisma` (partial unique constraint), so document it as an untracked index.

2. Wrap the upsert in a transaction in the route:
```typescript
if (reactionType && sceneIndex != null) {
  const comment = await prisma.$transaction(async (tx) => {
    await tx.projectComment.deleteMany({
      where: { projectId, userId, sceneIndex, reactionType: { not: null } },
    });
    return tx.projectComment.create({
      data: { projectId, userId, body: noteText, reactionType, sceneIndex, audioTimestampMs: null },
      select: COMMENT_SELECT,
    });
  });
  // ... notify + return
}
```

**Severity:** HIGH — Race condition produces duplicate reaction rows; corrupts "Notes & Reactions" enterprise dashboard aggregates

---

## Backlog (MEDIUM / LOW)

| ID | Severity | Title | Where | Fix |
|----|----------|-------|-------|-----|
| M-1 | MEDIUM | AudioOutput.jobId FK has no index | `schema.prisma:214`, `app/api/admin/review-queue/route.ts:46–47` | `admin/review-queue` queries `audioOutput.findFirst({ where: { jobId } })` against a table with no index on `job_id`. Add `@@index([jobId])` to `AudioOutput` and `CREATE INDEX "audio_outputs_job_id_idx" ON "audio_outputs"("job_id");` |
| M-2 | MEDIUM | Alert model missing composite index on (userId, isRead) | `schema.prisma:830`, `app/api/alerts/route.ts:36–42` | Alerts are queried with `{ userId, isRead: false }` for the unread count and unread-only list. The existing `@@index([userId, createdAt(sort: Desc)])` forces a range scan over all user alerts to filter by `isRead`. Add `@@index([userId, isRead])` and `CREATE INDEX "alerts_user_id_is_read_idx" ON "alerts"("user_id", "is_read");` |
| M-3 | MEDIUM | HumanReview missing projectId index | `schema.prisma:1128–1130` | Admin review queue queries by `projectId` via HumanReview relation but no `@@index([projectId])` exists. Only `@@unique([jobId])`, `@@index([status, createdAt])`, and `@@index([userId])` are present. Add `@@index([projectId])` and corresponding index SQL. |
| L-1 | LOW | Job.segments JSON shape undocumented/unvalidated | `schema.prisma:164`, `lib/generation/processor.ts:269–278` | `SegmentStatus[]` type defined inline in processor.ts only. Any consumer reading `job.segments` (e.g., `/api/jobs/[id]/route.ts:45`) casts to `unknown` or uses `??`. Export and document the type in `lib/types/job.ts` for shared use by client and server. |
| L-2 | LOW | WebhookEndpoint missing secret rotation timestamp | `schema.prisma:1072–1086` | Prior review recommended `secretRotatedAt DateTime?` for audit trail. Not yet added. Low priority since secret rotation endpoint has not been built. Add when `/api/webhooks/[id]/rotate-secret` is implemented. |

---

## Summary

### Changes Required Before Next Production Deploy

1. **Migration 0025** (one file, three changes):
   - Add FK `project_comments.user_id → profiles.id` (CRITICAL carryover — 3 sprints old)
   - Rename reaction index to Prisma-expected name (stops permanent drift reporting)
   - Add partial unique index for reaction deduplication
   - Re-assert partial index for progressive playback polling (avoids `migrate reset` regression)

2. **Transaction wrap** in `app/api/projects/[id]/comments/route.ts` (HIGH — 5-line change)

### Changes Deferred (Backlog)

- AudioOutput jobId index (admin-only query path, acceptable for now)
- Alert isRead composite index (relevant at scale, not blocking)
- HumanReview projectId index (low query volume currently)

---

## Overall Architecture Grade: B+

- **Security:** A- (FKs largely fixed in 0022; reaction deduplication gap is new)
- **Correctness:** B (ProjectComment FK still missing; reaction race condition is new)
- **Performance:** B+ (major indexes all added in 0022; three minor gaps remain)
- **Maintainability:** B (two untracked partial indexes create permanent drift noise)
