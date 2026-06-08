-- Migration 0035: project_assignment
-- Explicit per-user project access for sub-accounts within a team.
--
-- Sub-accounts (team members who are not team owners) must have a
-- project_assignments record to access a project via withProjectAuth.
-- Team owners still have broad access via the team ownership path.
--
-- The seed query below backfills all existing team-member+team-share pairs
-- so no current sub-account loses project access when the guard goes live.

CREATE TABLE "project_assignments" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "project_id"   UUID        NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id"      TEXT        NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "team_id"      UUID        NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "assigned_by"  TEXT        REFERENCES "profiles"("id") ON DELETE SET NULL,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "project_assignments_project_user_team_idx"
  ON "project_assignments"("project_id", "user_id", "team_id");
CREATE INDEX "project_assignments_user_id_idx"
  ON "project_assignments"("user_id");
CREATE INDEX "project_assignments_project_id_idx"
  ON "project_assignments"("project_id");

-- Seed: grant existing accepted team members access to all projects currently
-- shared with their team, preserving existing access patterns.
INSERT INTO "project_assignments" ("project_id", "user_id", "team_id", "assigned_by")
SELECT DISTINCT
  ts.project_id,
  tm.user_id,
  ts.team_id,
  t.owner_id
FROM "team_shares" ts
JOIN "teams" t        ON t.id = ts.team_id
JOIN "team_members" tm ON tm.team_id = ts.team_id
  AND tm.user_id IS NOT NULL
  AND tm.accepted_at IS NOT NULL
ON CONFLICT ("project_id", "user_id", "team_id") DO NOTHING;
