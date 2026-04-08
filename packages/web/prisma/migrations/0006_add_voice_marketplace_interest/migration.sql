-- CreateTable
CREATE TABLE "voice_marketplace_interest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_marketplace_interest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "voice_marketplace_interest_email_key" ON "voice_marketplace_interest"("email");

-- CreateIndex
CREATE INDEX "voice_marketplace_interest_created_at_idx" ON "voice_marketplace_interest"("created_at" DESC);

-- CreateIndex
CREATE INDEX "voice_marketplace_interest_role_idx" ON "voice_marketplace_interest"("role");
