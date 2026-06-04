-- Migration 0032: FK cascade — GDPR user deletion compliance
-- Makes user FK columns nullable + changes ON DELETE to SET NULL on three tables:
--   purchases.user_id, script_shares.shared_by, team_shares.shared_by
-- Allows deleting a user without cascading into financial/audit records.

-- ============================================================
-- 1. purchases.user_id — nullable + SET NULL
-- ============================================================
ALTER TABLE "purchases" ALTER COLUMN "user_id" DROP NOT NULL;

ALTER TABLE "purchases" DROP CONSTRAINT IF EXISTS "purchases_user_id_fkey";
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- project_id was already nullable; update its FK to SET NULL as well
ALTER TABLE "purchases" DROP CONSTRAINT IF EXISTS "purchases_project_id_fkey";
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 2. script_shares.shared_by — nullable + SET NULL
-- ============================================================
ALTER TABLE "script_shares" ALTER COLUMN "shared_by" DROP NOT NULL;

ALTER TABLE "script_shares" DROP CONSTRAINT IF EXISTS "script_shares_shared_by_fkey";
ALTER TABLE "script_shares" ADD CONSTRAINT "script_shares_shared_by_fkey"
  FOREIGN KEY ("shared_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- shared_with was already nullable — add SET NULL to its FK too
ALTER TABLE "script_shares" DROP CONSTRAINT IF EXISTS "script_shares_shared_with_fkey";
ALTER TABLE "script_shares" ADD CONSTRAINT "script_shares_shared_with_fkey"
  FOREIGN KEY ("shared_with") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 3. team_shares.shared_by — nullable + SET NULL
-- ============================================================
ALTER TABLE "team_shares" ALTER COLUMN "shared_by" DROP NOT NULL;

ALTER TABLE "team_shares" DROP CONSTRAINT IF EXISTS "team_shares_shared_by_fkey";
ALTER TABLE "team_shares" ADD CONSTRAINT "team_shares_shared_by_fkey"
  FOREIGN KEY ("shared_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
