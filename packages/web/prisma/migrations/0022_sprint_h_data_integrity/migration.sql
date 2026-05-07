-- Sprint H: Data Integrity Fixes
-- DT-C1: Credit webhook idempotency — add stripeSessionId unique + indexes
-- DT-C2: HumanReview FK constraints — job + user relations
-- DT-C3: ProjectComment DB FK — user_id → profiles.id
-- DT-H1: PodcastFeed userId denormalization + indexes
-- DT-H2: CreditTransaction jobId + profileId/createdAt indexes
-- DT-M1: VoiceClone elevenLabsVoiceId unique
-- DT-M2: ProjectComment sceneIndex + audioTimestampMs indexes
-- DT-M3: WebhookDeliveryLog model + isActive on WebhookEndpoint
-- DT-L1: Remove redundant ApiKey keyHash index (unique constraint creates implicit index)

-- DropIndex (redundant — @unique creates implicit index)
DROP INDEX "api_keys_key_hash_idx";

-- AlterTable: CreditTransaction — add stripeSessionId
ALTER TABLE "credit_transactions" ADD COLUMN "stripe_session_id" TEXT;

-- AlterTable: PodcastFeed — add userId (NOT NULL with backfill from project owner)
ALTER TABLE "podcast_feeds" ADD COLUMN "user_id" TEXT;
UPDATE "podcast_feeds" pf
  SET "user_id" = p."user_id"
  FROM "projects" p
  WHERE pf."project_id" = p."id";
ALTER TABLE "podcast_feeds" ALTER COLUMN "user_id" SET NOT NULL;

-- AlterTable: WebhookEndpoint — add isActive
ALTER TABLE "webhook_endpoints" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable: WebhookDeliveryLog
CREATE TABLE "webhook_delivery_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "webhook_endpoint_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "request_body" TEXT NOT NULL,
    "response_status" INTEGER,
    "response_body" TEXT,
    "duration_ms" INTEGER,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: WebhookDeliveryLog
CREATE INDEX "webhook_delivery_logs_webhook_endpoint_id_created_at_idx" ON "webhook_delivery_logs"("webhook_endpoint_id", "created_at" DESC);

-- CreateIndex: CreditTransaction unique stripeSessionId
CREATE UNIQUE INDEX "credit_transactions_stripe_session_id_key" ON "credit_transactions"("stripe_session_id");

-- CreateIndex: CreditTransaction jobId
CREATE INDEX "credit_transactions_job_id_idx" ON "credit_transactions"("job_id");

-- CreateIndex: CreditTransaction profileId + createdAt
CREATE INDEX "credit_transactions_profile_id_created_at_idx" ON "credit_transactions"("profile_id", "created_at" DESC);

-- CreateIndex: PodcastFeed userId + published
CREATE INDEX "podcast_feeds_user_id_published_idx" ON "podcast_feeds"("user_id", "published");

-- CreateIndex: PodcastFeed rssFeedSlug
CREATE INDEX "podcast_feeds_rss_feed_slug_idx" ON "podcast_feeds"("rss_feed_slug");

-- CreateIndex: ProjectComment sceneIndex
CREATE INDEX "project_comments_project_id_scene_index_idx" ON "project_comments"("project_id", "scene_index");

-- CreateIndex: ProjectComment audioTimestampMs
CREATE INDEX "project_comments_project_id_audio_timestamp_ms_idx" ON "project_comments"("project_id", "audio_timestamp_ms");

-- CreateIndex: VoiceClone elevenLabsVoiceId unique
CREATE UNIQUE INDEX "voice_clones_elevenlabs_voice_id_key" ON "voice_clones"("elevenlabs_voice_id");

-- AddForeignKey: WebhookDeliveryLog → WebhookEndpoint
ALTER TABLE "webhook_delivery_logs" ADD CONSTRAINT "webhook_delivery_logs_webhook_endpoint_id_fkey" FOREIGN KEY ("webhook_endpoint_id") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: PodcastFeed → Profile
ALTER TABLE "podcast_feeds" ADD CONSTRAINT "podcast_feeds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: HumanReview → Job
ALTER TABLE "human_reviews" ADD CONSTRAINT "human_reviews_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: HumanReview → Profile
ALTER TABLE "human_reviews" ADD CONSTRAINT "human_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
