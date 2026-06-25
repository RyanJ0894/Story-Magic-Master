# Data Tiers Audit — 2026-06-25

**Audit Period:** 2026-06-22 → 2026-06-25  
**Model:** claude-haiku-4-5-20251001  
**Scope:** Migrations 0040–0044, schema drift, ownership checks, cascade behavior, indexes, orphaned fields, seed data.

---

## Executive Summary

Migrations 0040–0044 are **well-executed and schema-aligned**. All recent changes (pipeline FK adds, audio tuning, consistency flags, director cache) are correct and properly indexed. Application-layer ownership checks (withProjectAuth) are solid and prevent sub-account project-leakage.

**Two new findings** require attention:
1. **[NEW] DT-35-H-1** — CreditTransaction.jobId has no FK constraint; orphan cost-debit rows survive if a job is deleted.
2. **[NEW] DT-36-M-1** — ContentAccessLog back-relations (user, share) lack explicit onDelete clauses; default is RESTRICT (silent DELETE failures).

**One resolved:** Seed data (DT-30-M-2) is **FIXED** in the codebase (lines 33–44 of seed.ts).

---

## CRITICAL Findings
None. All FK cascades and type conversions (0040, 0041) are correct.

---

## HIGH Findings

### [NEW] DT-35-H-1 — CreditTransaction.jobId missing FK + onDelete
**Where:** `packages/shared/prisma/schema.prisma:338–353`  
**Issue:** `jobId` is nullable, indexed (line 350), but has no @relation and no FK constraint to jobs(id). If a job is deleted, the CreditTransaction remains with a dangling jobId reference. The cost ledger (used for cost-attribution reports and refunds) becomes inconsistent — a credit/debit row claims to be for a job that no longer exists.

**Why It Matters:**
- Cost rollup queries that JOIN credit_transactions → jobs will miss orphan rows.
- Refund logic that locates a charge by jobId will fail for deleted jobs.
- Audit trails become hard to reconcile.

**Fix:**

Add a @relation and set onDelete to SetNull (so cost history survives, FK just nulls):
```prisma
model CreditTransaction {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  profileId       String   @map("profile_id")
  amount          Int
  reason          String
  jobId           String?  @map("job_id") @db.Uuid
  stripeSessionId String?  @unique @map("stripe_session_id")
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz

  profile Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  job     Job?    @relation(fields: [jobId], references: [id], onDelete: SetNull)  // ADD THIS

  @@index([profileId])
  @@index([jobId])
  @@index([profileId, createdAt(sort: Desc)])
  @@map("credit_transactions")
}
```

Create migration:
```sql
ALTER TABLE "credit_transactions"
  ADD CONSTRAINT "credit_transactions_job_id_fkey"
  FOREIGN KEY ("job_id")
  REFERENCES "jobs"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
```

---

### [CARRYOVER] DT-30-M-2 — Seed data gap: subscriptions row not created for dev profile

**Status:** ✅ **RESOLVED** in seed.ts lines 33–44.  
Seed now creates both Profile and Subscription rows, keeping them in sync with provisionTier invariants. No further action needed.

---

## MEDIUM Findings

### [NEW] DT-36-M-1 — ContentAccessLog back-relations missing onDelete
**Where:** `packages/shared/prisma/schema.prisma:449–472`  
**Issue:** ContentAccessLog has two optional ForeignKeys — userId and shareId — with no explicit onDelete clauses:
- Line 464: `user Profile? @relation(fields: [userId], references: [id])` — no onDelete
- Line 466: `share ScriptShare? @relation(fields: [shareId], references: [id])` — no onDelete

By Prisma default, missing onDelete defaults to `RESTRICT`, which means:
- If you try to delete a Profile (or ScriptShare), PostgreSQL rejects the DELETE with a FK constraint error if a ContentAccessLog row exists.
- This blocks user account deletion if they ever listened to a shared script.
- Silent failure: the API call returns 500 or hangs; logs show FK constraint error instead of a clean cascade.

**Why It Matters:**
- User cleanup / GDPR deletion becomes impossible if they have any content_access_log rows.
- ScriptShare deletion cascades from Project, so a project delete could fail silently.

**Fix:**

Explicitly set onDelete to SetNull (access logs survive the deletion, FK just nulls):
```prisma
model ContentAccessLog {
  id                   String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId               String?  @map("user_id")
  projectId            String   @map("project_id") @db.Uuid
  shareId              String?  @map("share_id") @db.Uuid
  accessType           String   @map("access_type")
  startPositionSeconds Int?     @map("start_position_seconds")
  endPositionSeconds   Int?     @map("end_position_seconds")
  durationSeconds      Int?     @map("duration_seconds")
  ipAddress            String?  @map("ip_address")
  userAgent            String?  @map("user_agent")
  deviceType           String?  @map("device_type")
  createdAt            DateTime @default(now()) @map("created_at") @db.Timestamptz

  // Relations — explicit onDelete: SetNull to allow user/share deletion
  user    Profile?     @relation(fields: [userId], references: [id], onDelete: SetNull)  // ADD: onDelete
  project Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  share   ScriptShare? @relation(fields: [shareId], references: [id], onDelete: SetNull)  // ADD: onDelete

  @@index([projectId, createdAt(sort: Desc)])
  @@index([userId, createdAt(sort: Desc)])
  @@index([shareId, createdAt(sort: Desc)])
  @@map("content_access_log")
}
```

Create migration:
```sql
ALTER TABLE "content_access_log"
  DROP CONSTRAINT IF EXISTS "content_access_log_user_id_fkey",
  ADD CONSTRAINT "content_access_log_user_id_fkey"
  FOREIGN KEY ("user_id")
  REFERENCES "profiles"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "content_access_log"
  DROP CONSTRAINT IF EXISTS "content_access_log_share_id_fkey",
  ADD CONSTRAINT "content_access_log_share_id_fkey"
  FOREIGN KEY ("share_id")
  REFERENCES "script_shares"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
```

---

### [CARRYOVER] DT-32-L-2, DT-31-L-2, DT-27-2/5 — Backlog from prior reviews
Still deferred (PLAY-TOCTOU, CONTENT-LOG-RETENTION).

---

## Spot-Checks (2026-06-25)

| Check | Result | Notes |
|-------|--------|-------|
| **Migration 0040 pipeline FKs** | ✓ | Six tables (mix_manifests, timelines, alignments, tts_stems, scene_renders, voice_map) correctly converted TEXT → UUID and added FK + CASCADE. Orphans (6 in prod timelines) were pre-deleted. |
| **Migration 0041 llm_call_log FK** | ✓ | Correctly uses ON DELETE SET NULL (cost history survives). Indexes remain valid. Non-UUID values pre-nulled. |
| **Migration 0042 audio_tuning** | ✓ | New table, simple (user_id PK, 4 offset columns, 1 locked bool). One-to-one with profiles, on-demand lazily created. No index needed beyond PK. |
| **Migration 0043 director_scene_cache** | ✓ | Cross-project lookup cache (content_hash PK). TTL index on last_hit_at (pruning). No FKs (intentional — orphan rows are acceptable). |
| **Migration 0044 consistency flags** | ✓ | Phase E feature flags: Profile.advancedConsistencyCheckEnabled (default false) + Project.advancedConsistencyCheckEnabled (nullable, inherit-via-null). Both default safe. |
| **Cascade coverage** | ⚠ | Job + Job.user + Job.project → Cascade ✓. Profile + User-owned projects → Cascade ✓. **BUT** CreditTransaction.jobId has no FK (DT-35-H-1). ContentAccessLog.user/share lack onDelete (DT-36-M-1). |
| **withProjectAuth guard** | ✓ | Three-path predicate (lines 176–204 of middleware.ts) mirrors listProjects exactly. Sub-account access requires ProjectAssignment. No leaks. |
| **Seed consistency** | ✓ | Profile + Subscription both created with matching tier/status (DT-30-M-2 resolved). |
| **High-volume table indexes** | ✓ | Job: (projectId), (userId), (status), (createdAt DESC), (jobType), (projectId, runNumber). Subscription: (stripeSubscriptionId), (userId), (userId, status). No major gaps. |
| **Partial indexes noted** | ⚠ | jobs.first_audio_url (WHERE IS NOT NULL) and project_comments.user_reaction_scene_uniq (partial unique) are in SQL but cannot be represented in Prisma schema.prisma. Both flagged in comments; both preserved by using raw migrations only. |
| **No orphaned Prisma fields** | ✓ | All schema fields are either written (createdAt, updatedAt, status, etc.) or are relation back-references. No dead columns. |

---

## Priority for Next PR

1. **DT-35-H-1** (HIGH) — Add FK to CreditTransaction.jobId with ON DELETE SET NULL. Cost ledger integrity. ~15 SQL LOC.
2. **DT-36-M-1** (MEDIUM) — Add explicit onDelete: SetNull to ContentAccessLog.user and .share. User deletion safety. ~20 SQL LOC.
3. **Phase E QA** — Verify consistency-check feature flags flow correctly through to orchestrator (not in audit scope, but mentioned in migration 0044).

---

## Summary of Changes Since 2026-06-22

- **Migrations 0040–0044 all applied & correct.** No schema drift.
- **Two new findings identified:** missing FK on cost ledger, and missing cascade guards on analytics logs.
- **One carryover resolved:** seed data now includes subscription row (DT-30-M-2).
- **withProjectAuth verified solid** — no ownership-check gaps.

**Audit Status:** GREEN with 2 follow-up PRs recommended.

---

**Audit completed:** 2026-06-25 06:45 UTC  
**Model:** claude-haiku-4-5-20251001  
**Scope:** Migrations 0040–0044, application-layer ownership, cascade semantics, index coverage, seed data.
