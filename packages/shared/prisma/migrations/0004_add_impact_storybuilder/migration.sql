-- CreateTable: impact_stories
CREATE TABLE "impact_stories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT,
    "session_id" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "story_text" TEXT NOT NULL,
    "expanded_text" TEXT,
    "voice_id" TEXT,
    "voice_name" TEXT,
    "audio_url" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "prize_eligible" BOOLEAN NOT NULL DEFAULT true,
    "author_name" TEXT,
    "author_city" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "job_id" UUID,
    "attested_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "play_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impact_stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable: impact_partners
CREATE TABLE "impact_partners" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_name" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "logo_url" TEXT,
    "website_url" TEXT,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "annual_amount" DECIMAL(10,2) NOT NULL,
    "credits_granted" INTEGER NOT NULL DEFAULT 0,
    "active_from" TIMESTAMP(3) NOT NULL,
    "active_to" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impact_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable: impact_prize_draws
CREATE TABLE "impact_prize_draws" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "story_id" UUID NOT NULL,
    "draw_month" TEXT NOT NULL,
    "is_winner" BOOLEAN NOT NULL DEFAULT false,
    "notified_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impact_prize_draws_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "impact_stories_user_id_idx" ON "impact_stories"("user_id");
CREATE INDEX "impact_stories_category_idx" ON "impact_stories"("category");
CREATE INDEX "impact_stories_is_public_is_approved_idx" ON "impact_stories"("is_public", "is_approved");
CREATE INDEX "impact_stories_created_at_idx" ON "impact_stories"("created_at" DESC);

CREATE INDEX "impact_partners_tier_idx" ON "impact_partners"("tier");
CREATE INDEX "impact_partners_is_active_idx" ON "impact_partners"("is_active");

CREATE INDEX "impact_prize_draws_draw_month_idx" ON "impact_prize_draws"("draw_month");
CREATE INDEX "impact_prize_draws_story_id_idx" ON "impact_prize_draws"("story_id");

-- AddForeignKey
ALTER TABLE "impact_stories" ADD CONSTRAINT "impact_stories_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "impact_prize_draws" ADD CONSTRAINT "impact_prize_draws_story_id_fkey"
    FOREIGN KEY ("story_id") REFERENCES "impact_stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
