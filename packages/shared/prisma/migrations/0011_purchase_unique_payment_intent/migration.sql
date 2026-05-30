-- Migration 0011: purchases — unique constraint on stripe_payment_intent_id,
-- composite index on (project_id, purchase_type, status) for the Advanced
-- Analysis lookup hot path.

-- Drop the old single-column index (replaced by the unique constraint below)
DROP INDEX IF EXISTS "purchases_stripe_payment_intent_id_idx";

-- Add a unique constraint on stripe_payment_intent_id.
-- PostgreSQL treats NULLs as distinct in unique indexes, so multiple
-- rows may have NULL here (one-time purchases without a payment intent).
ALTER TABLE "purchases"
  ADD CONSTRAINT "purchases_stripe_payment_intent_id_key"
  UNIQUE ("stripe_payment_intent_id");

-- Composite covering index for the per-project advanced-analysis lookup:
-- WHERE project_id = $1 AND purchase_type = $2 AND status = $3
CREATE INDEX IF NOT EXISTS "purchases_project_id_purchase_type_status_idx"
  ON "purchases" ("project_id", "purchase_type", "status");
