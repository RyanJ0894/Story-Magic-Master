-- AlterTable: Add missing 'suspended' column to profiles
ALTER TABLE "profiles" ADD COLUMN "suspended" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add missing columns to script_shares
ALTER TABLE "script_shares" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "script_shares" ADD COLUMN "last_accessed_at" TIMESTAMP(3);
ALTER TABLE "script_shares" ADD COLUMN "max_plays" INTEGER;
ALTER TABLE "script_shares" ADD COLUMN "password_hash" TEXT;
ALTER TABLE "script_shares" ADD COLUMN "play_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "script_shares" ADD COLUMN "recipient_email" TEXT;
ALTER TABLE "script_shares" ADD COLUMN "recipient_name" TEXT;
ALTER TABLE "script_shares" ADD COLUMN "share_code" TEXT;
ALTER TABLE "script_shares" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "script_shares_share_code_key" ON "script_shares"("share_code");

-- CreateIndex
CREATE INDEX "script_shares_share_code_idx" ON "script_shares"("share_code");
