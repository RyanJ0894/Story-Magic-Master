-- Migration 0040: Pipeline-table referential integrity + activity_logs index.
--
-- Closes:
--   - DT-31-H-1 (HIGH): Pipeline tables (mix_manifests, timelines, alignments,
--     tts_stems, scene_renders, voice_map) stored project_id as TEXT with no
--     FK to projects(id), creating orphan + cache-poisoning risk and breaking
--     ON DELETE CASCADE invariants when a project is deleted.
--   - DT-32-M-1 (MED): activity_logs lacked (user_id, created_at DESC) index.
--     PR #200's notification producers do `WHERE user_id = ? ORDER BY created_at
--     DESC` and would table-scan as activity_logs grows.
--
-- Pre-flight check (run before this migration in prod):
--   The dev audit on 2026-06-10 found 0 orphan project_id values in dev and
--   exactly 6 orphan rows in prod.timelines (project deleted; cascade never
--   fired because no FK). Step 1 of this migration deletes them. No other
--   pipeline table had orphans. All project_id values were valid-format UUIDs
--   in TEXT form, so the ALTER ... TYPE UUID cast is safe.
--
-- The ALTER COLUMN TYPE UUID USING project_id::uuid works even when the
-- column is part of the composite PK — PostgreSQL transparently updates the
-- PK constraint's column type. No DROP CONSTRAINT/RECREATE is needed.

-- =============================================================================
-- Step 1: Delete orphan rows (FK creation in step 3 would otherwise fail).
-- =============================================================================
DELETE FROM "mix_manifests" WHERE NOT EXISTS (
  SELECT 1 FROM "projects" WHERE "projects"."id"::text = "mix_manifests"."project_id"
);
DELETE FROM "timelines" WHERE NOT EXISTS (
  SELECT 1 FROM "projects" WHERE "projects"."id"::text = "timelines"."project_id"
);
DELETE FROM "alignments" WHERE NOT EXISTS (
  SELECT 1 FROM "projects" WHERE "projects"."id"::text = "alignments"."project_id"
);
DELETE FROM "tts_stems" WHERE NOT EXISTS (
  SELECT 1 FROM "projects" WHERE "projects"."id"::text = "tts_stems"."project_id"
);
DELETE FROM "scene_renders" WHERE NOT EXISTS (
  SELECT 1 FROM "projects" WHERE "projects"."id"::text = "scene_renders"."project_id"
);
DELETE FROM "voice_map" WHERE NOT EXISTS (
  SELECT 1 FROM "projects" WHERE "projects"."id"::text = "voice_map"."project_id"
);

-- =============================================================================
-- Step 2: Convert project_id from TEXT to UUID.
-- =============================================================================
ALTER TABLE "mix_manifests"
  ALTER COLUMN "project_id" TYPE UUID USING "project_id"::uuid;

ALTER TABLE "timelines"
  ALTER COLUMN "project_id" TYPE UUID USING "project_id"::uuid;

ALTER TABLE "alignments"
  ALTER COLUMN "project_id" TYPE UUID USING "project_id"::uuid;

ALTER TABLE "tts_stems"
  ALTER COLUMN "project_id" TYPE UUID USING "project_id"::uuid;

ALTER TABLE "scene_renders"
  ALTER COLUMN "project_id" TYPE UUID USING "project_id"::uuid;

ALTER TABLE "voice_map"
  ALTER COLUMN "project_id" TYPE UUID USING "project_id"::uuid;

-- =============================================================================
-- Step 3: Add FK constraints with ON DELETE CASCADE.
-- Match the cascade semantics of every other Project-owned table.
-- =============================================================================
ALTER TABLE "mix_manifests"
  ADD CONSTRAINT "mix_manifests_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "timelines"
  ADD CONSTRAINT "timelines_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "alignments"
  ADD CONSTRAINT "alignments_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tts_stems"
  ADD CONSTRAINT "tts_stems_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scene_renders"
  ADD CONSTRAINT "scene_renders_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "voice_map"
  ADD CONSTRAINT "voice_map_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- Step 4: Add (user_id, created_at DESC) index on activity_logs (DT-32-M-1).
-- Required for the notification feed producers added in PR #200, which read
-- recent activity by user.
-- =============================================================================
CREATE INDEX "activity_logs_user_id_created_at_idx"
  ON "activity_logs"("user_id", "created_at" DESC);
