-- Add deactivated_at to team_members for sub-account deactivation with 90-day retention (#147)
ALTER TABLE "team_members" ADD COLUMN "deactivated_at" TIMESTAMPTZ;
CREATE INDEX "team_members_deactivated_at_idx" ON "team_members"("deactivated_at");
