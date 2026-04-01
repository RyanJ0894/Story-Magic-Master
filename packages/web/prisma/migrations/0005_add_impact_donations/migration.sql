-- Migration: 0005_add_impact_donations
-- Stores Stripe Checkout sessions for Impact program donations.

CREATE TABLE "impact_donations" (
    "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
    "stripe_session_id" TEXT        NOT NULL,
    "amount_cents"     INTEGER      NOT NULL,
    "currency"         TEXT         NOT NULL DEFAULT 'usd',
    "donor_email"      TEXT,
    "donor_name"       TEXT,
    "message"          TEXT,
    "status"           TEXT         NOT NULL DEFAULT 'completed',
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impact_donations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "impact_donations_stripe_session_id_key" ON "impact_donations"("stripe_session_id");
CREATE INDEX "impact_donations_created_at_idx" ON "impact_donations"("created_at" DESC);
CREATE INDEX "impact_donations_stripe_session_id_idx" ON "impact_donations"("stripe_session_id");
