-- Migration: 0025_data_integrity_sprint_m
-- Sprint M data integrity fixes found in 2026-05-19 code review.
--
-- 1. [CRITICAL CARRYOVER] Add missing FK: project_comments.user_id → profiles.id
--    First added in migration 0018 without a REFERENCES clause; missed in 0022.
--
-- 2. [HIGH] Rename hand-written index from 0024 to Prisma-expected name
--    0024 created "project_comments_project_id_scene_idx_reaction_idx" but Prisma
--    expects "project_comments_project_id_scene_index_reaction_type_idx".
--    Leaving the mismatch causes permanent `prisma migrate status` drift.
--
-- 3. [HIGH] Add partial unique index to prevent duplicate reaction rows
--    The deleteMany+create upsert pattern in comments/route.ts has a race condition.
--    The transaction wrapper (applied in code) prevents it; this index is a DB-level guard.
--    NOTE: Prisma cannot represent partial unique indexes in schema.prisma — this index
--    is tracked only in migration SQL. Do NOT run `prisma db push` on production.
--
-- 4. [HIGH] Re-assert partial index dropped by prisma migrate reset
--    "jobs_first_audio_url_not_null" was created in 0023 but Prisma cannot track it.
--    Adding it here with IF NOT EXISTS makes it survive a `prisma migrate reset`.

-- ============================================================
-- 1. Add FK: project_comments.user_id → profiles.id
-- ============================================================
ALTER TABLE "project_comments"
  ADD CONSTRAINT "project_comments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 2. Rename 0024 reaction index to Prisma-expected name
-- ============================================================
DROP INDEX IF EXISTS "project_comments_project_id_scene_idx_reaction_idx";

CREATE INDEX IF NOT EXISTS "project_comments_project_id_scene_index_reaction_type_idx"
  ON "project_comments" ("project_id", "scene_index", "reaction_type");

-- ============================================================
-- 3. Partial unique index — prevent duplicate reactions per user+scene
--    (untracked by Prisma — see NOTE above)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS "project_comments_user_reaction_scene_uniq"
  ON "project_comments" ("project_id", "user_id", "scene_index")
  WHERE "reaction_type" IS NOT NULL;

-- ============================================================
-- 4. Re-assert progressive playback partial index
--    (untracked by Prisma — created in 0023, dropped by migrate reset)
-- ============================================================
CREATE INDEX IF NOT EXISTS "jobs_first_audio_url_not_null"
  ON "jobs" ("id")
  WHERE "first_audio_url" IS NOT NULL;
