-- Phase E account-level + per-project flags for the ConsistencyVerifierAgent.
--
-- Profile.advanced_consistency_check_enabled is the account-level opt-in.
-- Default false keeps free-tier cost flat; flip to true on premium tiers.
--
-- Project.advanced_consistency_check_enabled is a per-project override.
-- NULL means "inherit from profile". Explicit true/false overrides in either
-- direction — useful for one-off premium upgrades on free-tier accounts or
-- for premium accounts disabling the check on small experimental projects.
--
-- Both columns default-safe: missing values fall back to "verifier off".

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS advanced_consistency_check_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS advanced_consistency_check_enabled BOOLEAN;
