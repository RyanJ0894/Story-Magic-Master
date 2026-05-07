-- Migration 0014: Credit System
-- Adds per-user scene credit balance and audit log for credit transactions.

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "credits" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "credit_transactions" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "profile_id"  TEXT        NOT NULL,
  "amount"      INTEGER     NOT NULL,
  "reason"      TEXT        NOT NULL,
  "job_id"      UUID,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "credit_transactions_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "credit_transactions_profile_id_idx"
  ON "credit_transactions"("profile_id");
