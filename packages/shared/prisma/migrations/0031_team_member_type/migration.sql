-- Migration 0031: Add member_type to team_members
-- Stores the sub-account classification label (talent_actor | staff | representation).
-- Separate from `role` (which controls permissions); this is purely an identity label.

ALTER TABLE "team_members"
  ADD COLUMN IF NOT EXISTS "member_type" TEXT;
