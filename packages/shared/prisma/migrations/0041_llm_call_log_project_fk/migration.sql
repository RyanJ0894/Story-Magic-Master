-- Migration 0041: llm_call_log.project_id TEXT → UUID + FK with ON DELETE SET NULL.
--
-- Closes:
--   - DT-32-L-1 (LOW): llm_call_log.project_id stored as TEXT with no FK to
--     projects(id). Mirror bug class of DT-31-H-1 (migration 0040) but lower
--     impact because the call log is intentionally allowed to outlive its
--     project — cost-rollup history needs the rows after delete.
--
-- Pre-flight: any pre-existing project_id values that are NOT valid UUIDs OR
-- that don't reference an existing projects.id are NULLed out (rather than
-- the row being deleted). The cost log is append-only telemetry; we'd rather
-- keep the cost data with a NULL FK than drop rows.
--
-- The ON DELETE SET NULL FK semantics (different from 0040's CASCADE) match
-- the "history outlives the project" intent.

-- =============================================================================
-- Step 1: Null out non-UUID and orphan project_id values.
-- =============================================================================

-- Non-UUID values (defensive; the application should only write UUIDs)
UPDATE "llm_call_log"
SET    "project_id" = NULL
WHERE  "project_id" IS NOT NULL
  AND  "project_id" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Orphan rows (project deleted while the FK was missing)
UPDATE "llm_call_log"
SET    "project_id" = NULL
WHERE  "project_id" IS NOT NULL
  AND  NOT EXISTS (
    SELECT 1 FROM "projects"
    WHERE "projects"."id"::text = "llm_call_log"."project_id"
  );

-- =============================================================================
-- Step 2: Convert project_id column from TEXT to UUID.
-- =============================================================================

ALTER TABLE "llm_call_log"
  ALTER COLUMN "project_id" TYPE UUID USING "project_id"::uuid;

-- =============================================================================
-- Step 3: Add the FK constraint with ON DELETE SET NULL.
-- =============================================================================

ALTER TABLE "llm_call_log"
  ADD CONSTRAINT "llm_call_log_project_id_fkey"
  FOREIGN KEY ("project_id")
  REFERENCES "projects"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- Existing indexes on (project_id, created_at DESC) etc. remain valid — the
-- column-type change doesn't invalidate them, and indexes are not dropped.
