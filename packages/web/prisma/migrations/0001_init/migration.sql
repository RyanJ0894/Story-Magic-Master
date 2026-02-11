-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "full_name" TEXT,
    "avatar_url" TEXT,
    "subscription_tier" TEXT NOT NULL DEFAULT 'free',
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "subscription_status" TEXT NOT NULL DEFAULT 'inactive',
    "current_period_end" TIMESTAMP(3),
    "user_type" TEXT NOT NULL DEFAULT 'writer',
    "writer_code" TEXT,
    "reader_code" TEXT,
    "external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "script_text" TEXT,
    "page_count" INTEGER NOT NULL DEFAULT 0,
    "director_json" JSONB,
    "preferred_workflow_mode" TEXT NOT NULL DEFAULT 'automatic',
    "current_run_number" INTEGER NOT NULL DEFAULT 0,
    "voice_assignments" JSONB NOT NULL DEFAULT '[]',
    "audio_overrides" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" JSONB NOT NULL DEFAULT '{"step": "queued", "percent": 0}',
    "result" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "queued_at" TIMESTAMP(3),
    "processing_lock" UUID,
    "lock_expires_at" TIMESTAMP(3),
    "worker_id" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "last_error" TEXT,
    "job_type" TEXT NOT NULL DEFAULT 'audio_generation',
    "estimated_duration_ms" INTEGER,
    "actual_duration_ms" INTEGER,
    "run_number" INTEGER,
    "workflow_mode" TEXT NOT NULL DEFAULT 'automatic',

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "step" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "error_message" TEXT,
    "error_stack" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_ms" INTEGER,

    CONSTRAINT "job_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_outputs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "job_id" UUID,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size" INTEGER,
    "duration_seconds" DECIMAL(10,2),
    "format" TEXT NOT NULL DEFAULT 'mp3',
    "storage_bucket" TEXT NOT NULL DEFAULT 'audio-outputs',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audio_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "pages_used" INTEGER NOT NULL DEFAULT 0,
    "pages_limit" INTEGER NOT NULL DEFAULT 3,
    "previews_used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "stripe_price_id" TEXT,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "generations_used" INTEGER NOT NULL DEFAULT 0,
    "generations_limit" INTEGER NOT NULL DEFAULT 5,
    "downloads_used" INTEGER NOT NULL DEFAULT 0,
    "downloads_limit" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "project_id" UUID,
    "purchase_type" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "stripe_payment_intent_id" TEXT,
    "stripe_invoice_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_shares" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "shared_by" TEXT NOT NULL,
    "shared_with" TEXT,
    "share_token" TEXT,
    "access_level" TEXT NOT NULL DEFAULT 'stream',
    "via_reader_code" TEXT,
    "expires_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "last_viewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reader_library" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reader_id" TEXT NOT NULL,
    "project_id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "share_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'active',
    "is_favorited" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_played_at" TIMESTAMP(3),
    "play_position_seconds" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "read_status" TEXT NOT NULL DEFAULT 'undecided',
    "read_status_updated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reader_library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_access_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT,
    "project_id" UUID NOT NULL,
    "share_id" UUID,
    "access_type" TEXT NOT NULL,
    "start_position_seconds" INTEGER,
    "end_position_seconds" INTEGER,
    "duration_seconds" INTEGER,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_access_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "premise_originality" DECIMAL(3,1) NOT NULL,
    "premise_originality_reasoning" TEXT NOT NULL,
    "logline_clarity" DECIMAL(3,1) NOT NULL,
    "logline_clarity_reasoning" TEXT NOT NULL,
    "commercial_viability" DECIMAL(3,1) NOT NULL,
    "commercial_viability_reasoning" TEXT NOT NULL,
    "three_act_integrity" DECIMAL(3,1) NOT NULL,
    "three_act_integrity_reasoning" TEXT NOT NULL,
    "pacing_momentum" DECIMAL(3,1) NOT NULL,
    "pacing_momentum_reasoning" TEXT NOT NULL,
    "stakes_escalation" DECIMAL(3,1) NOT NULL,
    "stakes_escalation_reasoning" TEXT NOT NULL,
    "protagonist_arc" DECIMAL(3,1) NOT NULL,
    "protagonist_arc_reasoning" TEXT NOT NULL,
    "supporting_cast" DECIMAL(3,1) NOT NULL,
    "supporting_cast_reasoning" TEXT NOT NULL,
    "castability" DECIMAL(3,1) NOT NULL,
    "castability_reasoning" TEXT NOT NULL,
    "dialogue_quality" DECIMAL(3,1) NOT NULL,
    "dialogue_quality_reasoning" TEXT NOT NULL,
    "visual_storytelling" DECIMAL(3,1) NOT NULL,
    "visual_storytelling_reasoning" TEXT NOT NULL,
    "technical_execution" DECIMAL(3,1) NOT NULL,
    "technical_execution_reasoning" TEXT NOT NULL,
    "concept_score" DECIMAL(3,1) NOT NULL,
    "structure_score" DECIMAL(3,1) NOT NULL,
    "character_score" DECIMAL(3,1) NOT NULL,
    "craft_score" DECIMAL(3,1) NOT NULL,
    "overall_score" DECIMAL(3,1) NOT NULL,
    "rating" TEXT NOT NULL,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weaknesses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidence" DECIMAL(3,2) NOT NULL,
    "model_version" TEXT NOT NULL DEFAULT 'gpt-4o',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggestions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "score_id" UUID,
    "start_line" INTEGER NOT NULL,
    "end_line" INTEGER NOT NULL,
    "start_char" INTEGER,
    "end_char" INTEGER,
    "excerpt" TEXT NOT NULL,
    "scene_number" INTEGER,
    "scene_heading" TEXT,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "user_feedback" TEXT,
    "confidence" DECIMAL(3,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewrites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "suggestion_id" UUID NOT NULL,
    "original_text" TEXT NOT NULL,
    "rewritten_text" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "style" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rewrites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "label" TEXT,
    "script_text" TEXT NOT NULL,
    "word_count" INTEGER NOT NULL,
    "page_count" INTEGER NOT NULL,
    "score_id" UUID,
    "overall_score" DECIMAL(4,1),
    "changes_summary" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_corpus" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "logline" TEXT,
    "genre" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tone" TEXT,
    "writer" TEXT,
    "sale_date" DATE,
    "production_status" TEXT,
    "studio" TEXT,
    "budget_tier" TEXT,
    "box_office_millions" DECIMAL(10,2),
    "logline_embedding" vector(1536),
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_corpus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "default_share_access" TEXT NOT NULL DEFAULT 'stream',
    "auto_share_new_projects" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "team_id" UUID NOT NULL,
    "user_id" TEXT,
    "invited_email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invite_token" TEXT,
    "invited_by" TEXT,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_shares" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "shared_by" TEXT NOT NULL,
    "access_level" TEXT NOT NULL DEFAULT 'stream',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "alert_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "project_id" UUID,
    "team_id" UUID,
    "related_user_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "email_sent" BOOLEAN NOT NULL DEFAULT false,
    "email_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "email_team_invites" BOOLEAN NOT NULL DEFAULT true,
    "email_script_shared" BOOLEAN NOT NULL DEFAULT true,
    "email_status_changes" BOOLEAN NOT NULL DEFAULT true,
    "email_comments" BOOLEAN NOT NULL DEFAULT true,
    "email_team_changes" BOOLEAN NOT NULL DEFAULT true,
    "email_generation_complete" BOOLEAN NOT NULL DEFAULT false,
    "inapp_all" BOOLEAN NOT NULL DEFAULT true,
    "email_digest_frequency" TEXT NOT NULL DEFAULT 'instant',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_writer_code_key" ON "profiles"("writer_code");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_reader_code_key" ON "profiles"("reader_code");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_external_id_key" ON "profiles"("external_id");

-- CreateIndex
CREATE INDEX "profiles_stripe_customer_id_idx" ON "profiles"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "profiles_stripe_subscription_id_idx" ON "profiles"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "projects_user_id_idx" ON "projects"("user_id");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "projects_user_id_created_at_idx" ON "projects"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "jobs_project_id_idx" ON "jobs"("project_id");

-- CreateIndex
CREATE INDEX "jobs_user_id_idx" ON "jobs"("user_id");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_created_at_idx" ON "jobs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "jobs_job_type_idx" ON "jobs"("job_type");

-- CreateIndex
CREATE INDEX "jobs_project_id_run_number_idx" ON "jobs"("project_id", "run_number");

-- CreateIndex
CREATE INDEX "job_logs_job_id_idx" ON "job_logs"("job_id");

-- CreateIndex
CREATE INDEX "job_logs_project_id_idx" ON "job_logs"("project_id");

-- CreateIndex
CREATE INDEX "job_logs_job_id_created_at_idx" ON "job_logs"("job_id", "created_at");

-- CreateIndex
CREATE INDEX "job_logs_created_at_idx" ON "job_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audio_outputs_project_id_idx" ON "audio_outputs"("project_id");

-- CreateIndex
CREATE INDEX "usage_user_id_period_idx" ON "usage"("user_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "usage_user_id_period_key" ON "usage"("user_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "subscriptions_stripe_subscription_id_idx" ON "subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "purchases_user_id_idx" ON "purchases"("user_id");

-- CreateIndex
CREATE INDEX "purchases_project_id_idx" ON "purchases"("project_id");

-- CreateIndex
CREATE INDEX "purchases_stripe_payment_intent_id_idx" ON "purchases"("stripe_payment_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "script_shares_share_token_key" ON "script_shares"("share_token");

-- CreateIndex
CREATE INDEX "script_shares_share_token_idx" ON "script_shares"("share_token");

-- CreateIndex
CREATE INDEX "script_shares_project_id_idx" ON "script_shares"("project_id");

-- CreateIndex
CREATE INDEX "script_shares_shared_by_idx" ON "script_shares"("shared_by");

-- CreateIndex
CREATE INDEX "script_shares_shared_with_idx" ON "script_shares"("shared_with");

-- CreateIndex
CREATE INDEX "reader_library_reader_id_idx" ON "reader_library"("reader_id");

-- CreateIndex
CREATE INDEX "reader_library_reader_id_status_idx" ON "reader_library"("reader_id", "status");

-- CreateIndex
CREATE INDEX "reader_library_reader_id_read_status_idx" ON "reader_library"("reader_id", "read_status");

-- CreateIndex
CREATE UNIQUE INDEX "reader_library_reader_id_project_id_key" ON "reader_library"("reader_id", "project_id");

-- CreateIndex
CREATE INDEX "content_access_log_project_id_created_at_idx" ON "content_access_log"("project_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "content_access_log_user_id_created_at_idx" ON "content_access_log"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "story_scores_project_id_idx" ON "story_scores"("project_id");

-- CreateIndex
CREATE INDEX "story_scores_rating_idx" ON "story_scores"("rating");

-- CreateIndex
CREATE INDEX "story_scores_overall_score_idx" ON "story_scores"("overall_score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "story_scores_project_id_version_key" ON "story_scores"("project_id", "version");

-- CreateIndex
CREATE INDEX "suggestions_project_id_idx" ON "suggestions"("project_id");

-- CreateIndex
CREATE INDEX "suggestions_score_id_idx" ON "suggestions"("score_id");

-- CreateIndex
CREATE INDEX "suggestions_status_idx" ON "suggestions"("status");

-- CreateIndex
CREATE INDEX "suggestions_category_idx" ON "suggestions"("category");

-- CreateIndex
CREATE INDEX "suggestions_severity_idx" ON "suggestions"("severity");

-- CreateIndex
CREATE INDEX "suggestions_project_id_start_line_end_line_idx" ON "suggestions"("project_id", "start_line", "end_line");

-- CreateIndex
CREATE INDEX "rewrites_suggestion_id_idx" ON "rewrites"("suggestion_id");

-- CreateIndex
CREATE INDEX "revisions_project_id_idx" ON "revisions"("project_id");

-- CreateIndex
CREATE INDEX "revisions_score_id_idx" ON "revisions"("score_id");

-- CreateIndex
CREATE INDEX "revisions_created_at_idx" ON "revisions"("created_at");

-- CreateIndex
CREATE INDEX "revisions_project_id_version_number_idx" ON "revisions"("project_id", "version_number" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "revisions_project_id_version_number_key" ON "revisions"("project_id", "version_number");

-- CreateIndex
CREATE INDEX "script_corpus_production_status_idx" ON "script_corpus"("production_status");

-- CreateIndex
CREATE INDEX "script_corpus_is_public_idx" ON "script_corpus"("is_public");

-- CreateIndex
CREATE INDEX "teams_owner_id_idx" ON "teams"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_invite_token_key" ON "team_members"("invite_token");

-- CreateIndex
CREATE INDEX "team_members_team_id_idx" ON "team_members"("team_id");

-- CreateIndex
CREATE INDEX "team_members_user_id_idx" ON "team_members"("user_id");

-- CreateIndex
CREATE INDEX "team_members_invite_token_idx" ON "team_members"("invite_token");

-- CreateIndex
CREATE INDEX "team_members_invited_email_idx" ON "team_members"("invited_email");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_team_id_user_id_key" ON "team_members"("team_id", "user_id");

-- CreateIndex
CREATE INDEX "team_shares_team_id_idx" ON "team_shares"("team_id");

-- CreateIndex
CREATE INDEX "team_shares_project_id_idx" ON "team_shares"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_shares_project_id_team_id_key" ON "team_shares"("project_id", "team_id");

-- CreateIndex
CREATE INDEX "alerts_user_id_created_at_idx" ON "alerts"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "alert_preferences_user_id_key" ON "alert_preferences"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_idx" ON "audit_logs"("resource_type");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_outputs" ADD CONSTRAINT "audio_outputs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_outputs" ADD CONSTRAINT "audio_outputs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage" ADD CONSTRAINT "usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_shares" ADD CONSTRAINT "script_shares_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_shares" ADD CONSTRAINT "script_shares_shared_by_fkey" FOREIGN KEY ("shared_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_shares" ADD CONSTRAINT "script_shares_shared_with_fkey" FOREIGN KEY ("shared_with") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader_library" ADD CONSTRAINT "reader_library_reader_id_fkey" FOREIGN KEY ("reader_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader_library" ADD CONSTRAINT "reader_library_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader_library" ADD CONSTRAINT "reader_library_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "script_shares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_access_log" ADD CONSTRAINT "content_access_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_access_log" ADD CONSTRAINT "content_access_log_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_access_log" ADD CONSTRAINT "content_access_log_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "script_shares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_scores" ADD CONSTRAINT "story_scores_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_score_id_fkey" FOREIGN KEY ("score_id") REFERENCES "story_scores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewrites" ADD CONSTRAINT "rewrites_suggestion_id_fkey" FOREIGN KEY ("suggestion_id") REFERENCES "suggestions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_score_id_fkey" FOREIGN KEY ("score_id") REFERENCES "story_scores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_corpus" ADD CONSTRAINT "script_corpus_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_shares" ADD CONSTRAINT "team_shares_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_shares" ADD CONSTRAINT "team_shares_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_shares" ADD CONSTRAINT "team_shares_shared_by_fkey" FOREIGN KEY ("shared_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_related_user_id_fkey" FOREIGN KEY ("related_user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_preferences" ADD CONSTRAINT "alert_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- =============================================================================
-- STORED FUNCTIONS
-- =============================================================================
-- Note: user_id parameters changed from UUID to TEXT for Clerk string IDs
-- Note: handle_new_user() removed — replaced by Clerk webhook
-- Note: All RLS policies removed — app-level auth via withProjectAuth middleware

-- Helper: current billing period
CREATE OR REPLACE FUNCTION current_billing_period()
RETURNS TEXT AS $$
BEGIN
    RETURN TO_CHAR(NOW(), 'YYYY-MM');
END;
$$ LANGUAGE plpgsql;

-- Timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Usage: get remaining pages
CREATE OR REPLACE FUNCTION get_remaining_pages(p_user_id TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_used INTEGER;
    v_limit INTEGER;
    v_period TEXT;
BEGIN
    v_period := current_billing_period();
    SELECT pages_used, pages_limit INTO v_used, v_limit
    FROM usage
    WHERE user_id = p_user_id AND period = v_period;

    IF NOT FOUND THEN
        RETURN 3; -- default free tier
    END IF;

    RETURN GREATEST(0, v_limit - v_used);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage: increment
CREATE OR REPLACE FUNCTION increment_usage(p_user_id TEXT, p_pages INTEGER DEFAULT 1)
RETURNS VOID AS $$
DECLARE
    v_period TEXT;
BEGIN
    v_period := current_billing_period();
    INSERT INTO usage (user_id, period, pages_used)
    VALUES (p_user_id, v_period, p_pages)
    ON CONFLICT (user_id, period)
    DO UPDATE SET
        pages_used = usage.pages_used + p_pages,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage: get remaining previews
CREATE OR REPLACE FUNCTION get_remaining_previews(p_user_id TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_remaining_pages INTEGER;
    v_previews_used INTEGER;
BEGIN
    v_remaining_pages := get_remaining_pages(p_user_id);

    SELECT COALESCE(previews_used, 0) INTO v_previews_used
    FROM usage
    WHERE user_id = p_user_id
    AND period = current_billing_period();

    IF v_previews_used IS NULL THEN
        v_previews_used := 0;
    END IF;

    RETURN GREATEST(0, (v_remaining_pages * 5) - v_previews_used);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage: increment preview usage
CREATE OR REPLACE FUNCTION increment_preview_usage(p_user_id TEXT)
RETURNS VOID AS $$
BEGIN
    INSERT INTO usage (user_id, period, previews_used)
    VALUES (p_user_id, current_billing_period(), 1)
    ON CONFLICT (user_id, period)
    DO UPDATE SET
        previews_used = usage.previews_used + 1,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Job logging
CREATE OR REPLACE FUNCTION log_job_event(
    p_job_id UUID,
    p_project_id UUID,
    p_level TEXT,
    p_step TEXT,
    p_message TEXT,
    p_metadata JSONB DEFAULT '{}',
    p_error_message TEXT DEFAULT NULL,
    p_error_stack TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
    v_last_log_time TIMESTAMPTZ;
    v_duration_ms INTEGER;
BEGIN
    SELECT created_at INTO v_last_log_time
    FROM job_logs
    WHERE job_id = p_job_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_last_log_time IS NOT NULL THEN
        v_duration_ms := EXTRACT(MILLISECONDS FROM (NOW() - v_last_log_time))::INTEGER;
    END IF;

    INSERT INTO job_logs (
        job_id, project_id, level, step, message,
        metadata, error_message, error_stack, duration_ms
    )
    VALUES (
        p_job_id, p_project_id, p_level, p_step, p_message,
        p_metadata, p_error_message, p_error_stack, v_duration_ms
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Share code generation (for profiles)
CREATE OR REPLACE FUNCTION generate_share_codes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.writer_code IS NULL THEN
    NEW.writer_code := UPPER(SUBSTRING(MD5(NEW.id::text || 'writer' || NOW()::text) FROM 1 FOR 8));
  END IF;
  IF NEW.reader_code IS NULL THEN
    NEW.reader_code := UPPER(SUBSTRING(MD5(NEW.id::text || 'reader' || NOW()::text) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Share token generation
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.share_token IS NULL THEN
    NEW.share_token := LOWER(SUBSTRING(MD5(NEW.id::text || NOW()::text) FROM 1 FOR 12));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Subscription: is writer subscribed
CREATE OR REPLACE FUNCTION is_writer_subscribed(writer_user_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = writer_user_id
    AND status IN ('active', 'trialing')
    AND (current_period_end IS NULL OR current_period_end > NOW())
  );
END;
$$ LANGUAGE plpgsql;

-- Subscription: get remaining generations
CREATE OR REPLACE FUNCTION get_remaining_generations(p_user_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_limit INTEGER;
  v_used INTEGER;
BEGIN
  SELECT generations_limit, generations_used
  INTO v_limit, v_used
  FROM subscriptions
  WHERE user_id = p_user_id
  AND status IN ('active', 'trialing');

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  RETURN GREATEST(0, v_limit - v_used);
END;
$$ LANGUAGE plpgsql;

-- Subscription: use generation
CREATE OR REPLACE FUNCTION use_generation(p_user_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_remaining INTEGER;
BEGIN
  v_remaining := get_remaining_generations(p_user_id);

  IF v_remaining <= 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE subscriptions
  SET generations_used = generations_used + 1,
      updated_at = NOW()
  WHERE user_id = p_user_id
  AND status IN ('active', 'trialing');

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Subscription: archive writer shares on cancel
CREATE OR REPLACE FUNCTION archive_writer_shares()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('active', 'trialing') AND OLD.status IN ('active', 'trialing') THEN
    UPDATE reader_library rl
    SET status = 'archived', updated_at = NOW()
    FROM script_shares ss
    WHERE rl.share_id = ss.id
    AND ss.shared_by = NEW.user_id
    AND rl.source = 'received';
  END IF;

  IF NEW.status IN ('active', 'trialing') AND OLD.status NOT IN ('active', 'trialing') THEN
    UPDATE reader_library rl
    SET status = 'active', updated_at = NOW()
    FROM script_shares ss
    WHERE rl.share_id = ss.id
    AND ss.shared_by = NEW.user_id
    AND rl.status = 'archived';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- StoryScore: get next version
CREATE OR REPLACE FUNCTION get_next_score_version(p_project_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_max_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version), 0) INTO v_max_version
    FROM story_scores
    WHERE project_id = p_project_id;

    RETURN v_max_version + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- StoryScore: get latest
CREATE OR REPLACE FUNCTION get_latest_score(p_project_id UUID)
RETURNS SETOF story_scores AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM story_scores
    WHERE project_id = p_project_id
    ORDER BY version DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Suggestions: get stats
CREATE OR REPLACE FUNCTION get_suggestion_stats(p_project_id UUID)
RETURNS TABLE (
    total BIGINT,
    pending BIGINT,
    accepted BIGINT,
    rejected BIGINT,
    dismissed BIGINT,
    critical BIGINT,
    important BIGINT,
    minor BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total,
        COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending,
        COUNT(*) FILTER (WHERE status = 'accepted')::BIGINT as accepted,
        COUNT(*) FILTER (WHERE status = 'rejected')::BIGINT as rejected,
        COUNT(*) FILTER (WHERE status = 'dismissed')::BIGINT as dismissed,
        COUNT(*) FILTER (WHERE severity = 'critical')::BIGINT as critical,
        COUNT(*) FILTER (WHERE severity = 'important')::BIGINT as important,
        COUNT(*) FILTER (WHERE severity = 'minor')::BIGINT as minor
    FROM suggestions
    WHERE project_id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Suggestions: clear all for project
CREATE OR REPLACE FUNCTION clear_project_suggestions(p_project_id UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM suggestions WHERE project_id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revisions: get next version number
CREATE OR REPLACE FUNCTION get_next_version_number(p_project_id UUID)
RETURNS INT AS $$
DECLARE
    max_version INT;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) INTO max_version
    FROM revisions
    WHERE project_id = p_project_id;

    RETURN max_version + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revisions: get timeline
CREATE OR REPLACE FUNCTION get_revision_timeline(p_project_id UUID)
RETURNS TABLE (
    id UUID,
    version_number INT,
    label TEXT,
    word_count INT,
    page_count INT,
    overall_score DECIMAL(4,1),
    changes_summary JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.version_number,
        r.label,
        r.word_count,
        r.page_count,
        r.overall_score,
        r.changes_summary,
        r.created_at
    FROM revisions r
    WHERE r.project_id = p_project_id
    ORDER BY r.version_number DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revisions: get score trajectory
CREATE OR REPLACE FUNCTION get_score_trajectory(p_project_id UUID)
RETURNS TABLE (
    revision_id UUID,
    version_number INT,
    score DECIMAL(4,1),
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id as revision_id,
        r.version_number,
        r.overall_score as score,
        r.created_at
    FROM revisions r
    WHERE r.project_id = p_project_id
    AND r.overall_score IS NOT NULL
    ORDER BY r.version_number ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revisions: create initial on project insert
CREATE OR REPLACE FUNCTION create_initial_revision()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.script_text IS NOT NULL AND LENGTH(TRIM(NEW.script_text)) > 0 THEN
        INSERT INTO revisions (
            project_id,
            version_number,
            label,
            script_text,
            word_count,
            page_count,
            created_by
        ) VALUES (
            NEW.id,
            1,
            'Initial upload',
            NEW.script_text,
            array_length(regexp_split_to_array(TRIM(NEW.script_text), '\s+'), 1),
            CEIL(array_length(regexp_split_to_array(TRIM(NEW.script_text), '\s+'), 1)::DECIMAL / 250),
            NEW.user_id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- pgvector: search similar scripts
CREATE OR REPLACE FUNCTION search_similar_scripts(
    query_embedding VECTOR(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5,
    filter_production_status TEXT[] DEFAULT NULL,
    filter_genre TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    logline TEXT,
    genre TEXT[],
    tone TEXT,
    production_status TEXT,
    studio TEXT,
    budget_tier TEXT,
    box_office_millions DECIMAL,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sc.id,
        sc.title,
        sc.logline,
        sc.genre,
        sc.tone,
        sc.production_status,
        sc.studio,
        sc.budget_tier,
        sc.box_office_millions,
        1 - (sc.logline_embedding <=> query_embedding) AS similarity
    FROM script_corpus sc
    WHERE sc.is_public = true
        AND sc.logline_embedding IS NOT NULL
        AND 1 - (sc.logline_embedding <=> query_embedding) > match_threshold
        AND (filter_production_status IS NULL OR sc.production_status = ANY(filter_production_status))
        AND (filter_genre IS NULL OR sc.genre && filter_genre)
    ORDER BY sc.logline_embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Script corpus: update timestamp
CREATE OR REPLACE FUNCTION update_script_corpus_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Queue: get next queued job
CREATE OR REPLACE FUNCTION get_next_queued_job(
    p_worker_id TEXT,
    p_lock_duration_seconds INTEGER DEFAULT 300
)
RETURNS TABLE (
    job_id UUID,
    project_id UUID,
    user_id TEXT,
    job_type TEXT,
    priority INTEGER,
    retry_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_job_id UUID;
    v_lock_id UUID := gen_random_uuid();
    v_lock_expires TIMESTAMPTZ := NOW() + (p_lock_duration_seconds || ' seconds')::INTERVAL;
BEGIN
    SELECT j.id INTO v_job_id
    FROM jobs j
    WHERE j.status = 'queued'
      AND (j.lock_expires_at IS NULL OR j.lock_expires_at < NOW())
    ORDER BY j.priority DESC, j.queued_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_job_id IS NULL THEN
        RETURN;
    END IF;

    UPDATE jobs
    SET
        status = 'processing',
        processing_lock = v_lock_id,
        lock_expires_at = v_lock_expires,
        worker_id = p_worker_id,
        started_at = NOW(),
        progress = jsonb_build_object(
            'step', 'initializing',
            'percent', 0,
            'updated_at', NOW()
        )
    WHERE id = v_job_id;

    RETURN QUERY
    SELECT
        j.id,
        j.project_id,
        j.user_id,
        j.job_type,
        j.priority,
        j.retry_count
    FROM jobs j
    WHERE j.id = v_job_id;
END;
$$;

-- Queue: release job lock
CREATE OR REPLACE FUNCTION release_job_lock(
    p_job_id UUID,
    p_worker_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_updated BOOLEAN;
BEGIN
    UPDATE jobs
    SET
        status = 'queued',
        processing_lock = NULL,
        lock_expires_at = NULL,
        worker_id = NULL,
        started_at = NULL
    WHERE id = p_job_id
      AND worker_id = p_worker_id
      AND status = 'processing';

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$;

-- Queue: complete job
CREATE OR REPLACE FUNCTION complete_job(
    p_job_id UUID,
    p_result JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_started_at TIMESTAMPTZ;
    v_duration_ms INTEGER;
BEGIN
    SELECT started_at INTO v_started_at
    FROM jobs WHERE id = p_job_id;

    IF v_started_at IS NOT NULL THEN
        v_duration_ms := EXTRACT(EPOCH FROM (NOW() - v_started_at)) * 1000;
    END IF;

    UPDATE jobs
    SET
        status = 'completed',
        completed_at = NOW(),
        processing_lock = NULL,
        lock_expires_at = NULL,
        result = COALESCE(p_result, result),
        actual_duration_ms = v_duration_ms,
        progress = jsonb_build_object(
            'step', 'done',
            'percent', 100,
            'updated_at', NOW()
        )
    WHERE id = p_job_id;

    RETURN FOUND;
END;
$$;

-- Queue: fail job
CREATE OR REPLACE FUNCTION fail_job(
    p_job_id UUID,
    p_error TEXT,
    p_should_retry BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    retrying BOOLEAN,
    retry_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_retry_count INTEGER;
    v_max_retries INTEGER;
    v_should_retry BOOLEAN;
BEGIN
    SELECT j.retry_count, j.max_retries
    INTO v_retry_count, v_max_retries
    FROM jobs j WHERE j.id = p_job_id;

    v_should_retry := p_should_retry AND (v_retry_count < v_max_retries);

    IF v_should_retry THEN
        UPDATE jobs
        SET
            status = 'queued',
            processing_lock = NULL,
            lock_expires_at = NULL,
            worker_id = NULL,
            retry_count = v_retry_count + 1,
            last_error = p_error,
            queued_at = NOW() + ((v_retry_count + 1) * INTERVAL '30 seconds'),
            progress = jsonb_build_object(
                'step', 'retrying',
                'percent', 0,
                'error', p_error,
                'retry_attempt', v_retry_count + 1,
                'updated_at', NOW()
            )
        WHERE id = p_job_id;

        RETURN QUERY SELECT TRUE, v_retry_count + 1;
    ELSE
        UPDATE jobs
        SET
            status = 'failed',
            completed_at = NOW(),
            processing_lock = NULL,
            lock_expires_at = NULL,
            error = p_error,
            last_error = p_error,
            progress = jsonb_build_object(
                'step', 'failed',
                'percent', 0,
                'error', p_error,
                'updated_at', NOW()
            )
        WHERE id = p_job_id;

        UPDATE projects
        SET status = 'failed'
        WHERE id = (SELECT project_id FROM jobs WHERE id = p_job_id);

        RETURN QUERY SELECT FALSE, v_retry_count;
    END IF;
END;
$$;

-- Queue: cleanup expired locks
CREATE OR REPLACE FUNCTION cleanup_expired_job_locks()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE jobs
    SET
        status = 'queued',
        processing_lock = NULL,
        lock_expires_at = NULL,
        worker_id = NULL,
        retry_count = retry_count + 1,
        last_error = 'Worker timeout - job lock expired',
        progress = jsonb_build_object(
            'step', 'queued',
            'percent', 0,
            'error', 'Worker timeout - automatically requeued',
            'updated_at', NOW()
        )
    WHERE status = 'processing'
      AND lock_expires_at IS NOT NULL
      AND lock_expires_at < NOW()
      AND retry_count < max_retries;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    UPDATE jobs
    SET
        status = 'failed',
        completed_at = NOW(),
        processing_lock = NULL,
        lock_expires_at = NULL,
        error = 'Max retries exceeded after worker timeout',
        progress = jsonb_build_object(
            'step', 'failed',
            'percent', 0,
            'error', 'Max retries exceeded',
            'updated_at', NOW()
        )
    WHERE status = 'processing'
      AND lock_expires_at IS NOT NULL
      AND lock_expires_at < NOW()
      AND retry_count >= max_retries;

    RETURN v_count;
END;
$$;

-- Queue: get position
CREATE OR REPLACE FUNCTION get_queue_position(p_job_id UUID)
RETURNS TABLE (
    queue_position INTEGER,
    estimated_wait_seconds INTEGER,
    jobs_ahead INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_queued_at TIMESTAMPTZ;
    v_priority INTEGER;
    v_jobs_ahead INTEGER;
    v_avg_duration INTEGER;
BEGIN
    SELECT j.queued_at, j.priority
    INTO v_queued_at, v_priority
    FROM jobs j
    WHERE j.id = p_job_id AND j.status = 'queued';

    IF v_queued_at IS NULL THEN
        RETURN QUERY SELECT NULL::INTEGER, NULL::INTEGER, NULL::INTEGER;
        RETURN;
    END IF;

    SELECT COUNT(*)::INTEGER
    INTO v_jobs_ahead
    FROM jobs j
    WHERE j.status = 'queued'
      AND (j.priority > v_priority OR (j.priority = v_priority AND j.queued_at < v_queued_at));

    SELECT COALESCE(AVG(j.actual_duration_ms), 60000)::INTEGER
    INTO v_avg_duration
    FROM jobs j
    WHERE j.status = 'completed'
      AND j.completed_at > NOW() - INTERVAL '24 hours';

    RETURN QUERY SELECT
        (v_jobs_ahead + 1)::INTEGER,
        ((v_jobs_ahead * v_avg_duration) / 1000)::INTEGER,
        v_jobs_ahead;
END;
$$;

-- Queue: set queued_at on insert
CREATE OR REPLACE FUNCTION set_job_queued_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'queued' AND NEW.queued_at IS NULL THEN
        NEW.queued_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Teams: generate invite token
CREATE OR REPLACE FUNCTION generate_invite_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invite_token IS NULL AND NEW.status = 'pending' THEN
    NEW.invite_token := LOWER(ENCODE(gen_random_bytes(16), 'hex'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Alerts: create alert preferences for new profiles
CREATE OR REPLACE FUNCTION create_alert_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO alert_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alerts: create alert
CREATE OR REPLACE FUNCTION create_alert(
  p_user_id TEXT,
  p_alert_type TEXT,
  p_title TEXT,
  p_message TEXT DEFAULT NULL,
  p_project_id UUID DEFAULT NULL,
  p_team_id UUID DEFAULT NULL,
  p_related_user_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_alert_id UUID;
BEGIN
  INSERT INTO alerts (
    user_id, alert_type, title, message,
    project_id, team_id, related_user_id, metadata
  )
  VALUES (
    p_user_id, p_alert_type, p_title, p_message,
    p_project_id, p_team_id, p_related_user_id, p_metadata
  )
  RETURNING id INTO v_alert_id;

  RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alerts: notify on read status change
CREATE OR REPLACE FUNCTION notify_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_project_owner_id TEXT;
  v_project_name TEXT;
  v_reader_name TEXT;
  v_status_label TEXT;
BEGIN
  IF OLD.read_status IS DISTINCT FROM NEW.read_status THEN
    SELECT p.user_id, p.name INTO v_project_owner_id, v_project_name
    FROM projects p
    WHERE p.id = NEW.project_id;

    SELECT COALESCE(pr.full_name, 'A reader') INTO v_reader_name
    FROM profiles pr
    WHERE pr.id = NEW.reader_id;

    v_status_label := CASE NEW.read_status
      WHEN 'like' THEN 'liked'
      WHEN 'pass' THEN 'passed on'
      ELSE 'marked as undecided'
    END;

    PERFORM create_alert(
      v_project_owner_id,
      'script_status_changed',
      v_reader_name || ' ' || v_status_label || ' your script',
      '"' || v_project_name || '" was ' || v_status_label || ' by ' || v_reader_name,
      NEW.project_id,
      NULL,
      NEW.reader_id,
      jsonb_build_object(
        'old_status', OLD.read_status,
        'new_status', NEW.read_status,
        'reader_id', NEW.reader_id
      )
    );

    NEW.read_status_updated_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Project runs: get next run number
CREATE OR REPLACE FUNCTION get_next_run_number(p_project_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_next_run INTEGER;
BEGIN
  UPDATE projects
  SET current_run_number = current_run_number + 1
  WHERE id = p_project_id
  RETURNING current_run_number INTO v_next_run;

  RETURN v_next_run;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Project runs: set job run number on insert
CREATE OR REPLACE FUNCTION set_job_run_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.run_number IS NULL THEN
    NEW.run_number := get_next_run_number(NEW.project_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS
-- =============================================================================
-- Note: on_auth_user_created trigger removed (Clerk webhook handles profile creation)
-- Note: trigger_create_alert_preferences on auth.users removed (profiles trigger instead)

-- Timestamp triggers
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_usage_updated_at
    BEFORE UPDATE ON usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Profile share codes
CREATE TRIGGER trigger_generate_share_codes
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION generate_share_codes();

-- Alert preferences on profile creation (replaces auth.users trigger)
CREATE TRIGGER trigger_create_alert_preferences
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_alert_preferences();

-- Share token generation
CREATE TRIGGER trigger_generate_share_token
  BEFORE INSERT ON script_shares
  FOR EACH ROW
  EXECUTE FUNCTION generate_share_token();

-- Archive shares on subscription cancel
CREATE TRIGGER trigger_archive_writer_shares
  AFTER UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION archive_writer_shares();

-- Initial revision on project creation
CREATE TRIGGER trigger_create_initial_revision
    AFTER INSERT ON projects
    FOR EACH ROW
    EXECUTE FUNCTION create_initial_revision();

-- Script corpus timestamp
CREATE TRIGGER trigger_script_corpus_updated_at
    BEFORE UPDATE ON script_corpus
    FOR EACH ROW
    EXECUTE FUNCTION update_script_corpus_updated_at();

-- Job queue triggers
CREATE TRIGGER trigger_set_job_queued_at
    BEFORE INSERT OR UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION set_job_queued_at();

CREATE TRIGGER set_job_run_number_trigger
  BEFORE INSERT ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_job_run_number();

-- Team invite token
CREATE TRIGGER trigger_generate_invite_token
  BEFORE INSERT ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION generate_invite_token();

-- Reader status change notification
CREATE TRIGGER trigger_notify_status_change
  BEFORE UPDATE ON reader_library
  FOR EACH ROW
  EXECUTE FUNCTION notify_status_change();

-- =============================================================================
-- VIEWS
-- =============================================================================

-- Recent job errors (admin dashboard)
CREATE OR REPLACE VIEW recent_job_errors AS
SELECT
    jl.id,
    jl.job_id,
    jl.project_id,
    j.user_id,
    p.name AS project_name,
    jl.step,
    jl.message,
    jl.error_message,
    jl.error_stack,
    jl.metadata,
    jl.created_at
FROM job_logs jl
JOIN jobs j ON j.id = jl.job_id
JOIN projects p ON p.id = jl.project_id
WHERE jl.level = 'error'
ORDER BY jl.created_at DESC
LIMIT 100;

-- Queue statistics
CREATE OR REPLACE VIEW queue_stats AS
SELECT
    job_type,
    COUNT(*) FILTER (WHERE status = 'queued') AS queued_count,
    COUNT(*) FILTER (WHERE status = 'processing') AS processing_count,
    COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') AS completed_24h,
    COUNT(*) FILTER (WHERE status = 'failed' AND completed_at > NOW() - INTERVAL '24 hours') AS failed_24h,
    AVG(actual_duration_ms) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') AS avg_duration_ms,
    MAX(queued_at) FILTER (WHERE status = 'queued') AS oldest_queued_at,
    COUNT(*) FILTER (WHERE status = 'processing' AND lock_expires_at < NOW()) AS stale_locks
FROM jobs
GROUP BY job_type;

-- =============================================================================
-- SEED DATA: Script Corpus (12 classic films)
-- =============================================================================

INSERT INTO script_corpus (title, logline, genre, tone, production_status, studio, budget_tier, box_office_millions, is_public, source) VALUES
('The Godfather', 'The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant youngest son.', ARRAY['Crime', 'Drama'], 'dark', 'produced', 'Paramount', 'mid', 245.07, true, 'public_domain'),
('Casablanca', 'A cynical American expatriate struggles to decide whether or not he should help his former lover and her fugitive husband escape French Morocco during World War II.', ARRAY['Drama', 'Romance', 'War'], 'romantic', 'produced', 'Warner Bros', 'mid', 10.46, true, 'public_domain'),
('Chinatown', 'A private detective hired to expose an adulterer finds himself caught up in a web of deceit, corruption, and murder.', ARRAY['Mystery', 'Thriller', 'Neo-Noir'], 'noir', 'produced', 'Paramount', 'mid', 29.20, true, 'public_domain'),
('Rocky', 'A small-time Philadelphia boxer gets a supremely rare chance to fight the world heavyweight champion in a bout in which he strives to go the distance.', ARRAY['Drama', 'Sport'], 'inspirational', 'produced', 'United Artists', 'indie', 225.00, true, 'public_domain'),
('Jaws', 'When a killer shark unleashes chaos on a beach community off Cape Cod, it is up to a local sheriff, a marine biologist, and an old seafarer to hunt the beast down.', ARRAY['Adventure', 'Thriller', 'Horror'], 'suspenseful', 'produced', 'Universal', 'mid', 470.65, true, 'public_domain'),
('Star Wars', 'Luke Skywalker joins forces with a Jedi Knight, a cocky pilot, a Wookiee, and two droids to save the galaxy from the Empire''s world-destroying battle station.', ARRAY['Action', 'Adventure', 'Sci-Fi'], 'epic', 'produced', '20th Century Fox', 'mid', 775.40, true, 'public_domain'),
('Alien', 'After investigating a mysterious transmission of unknown origin, the crew of a commercial spacecraft encounters a deadly lifeform.', ARRAY['Horror', 'Sci-Fi'], 'dark', 'produced', '20th Century Fox', 'mid', 203.63, true, 'public_domain'),
('Die Hard', 'An NYPD officer tries to save his wife and several others taken hostage by German terrorists during a Christmas party at the Nakatomi Plaza in Los Angeles.', ARRAY['Action', 'Thriller'], 'intense', 'produced', '20th Century Fox', 'mid', 140.77, true, 'public_domain'),
('Pulp Fiction', 'The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption.', ARRAY['Crime', 'Drama'], 'dark comedy', 'produced', 'Miramax', 'indie', 213.93, true, 'public_domain'),
('The Matrix', 'When a beautiful stranger leads computer hacker Neo to a forbidding underworld, he discovers the shocking truth -- the life he knows is the elaborate deception of an evil cyber-intelligence.', ARRAY['Action', 'Sci-Fi'], 'philosophical', 'produced', 'Warner Bros', 'tentpole', 463.52, true, 'public_domain'),
('Get Out', 'A young African-American visits his white girlfriend''s parents for the weekend, where his simmering uneasiness about their reception of him eventually reaches a boiling point.', ARRAY['Horror', 'Mystery', 'Thriller'], 'satirical', 'produced', 'Universal', 'micro', 255.46, true, 'public_domain'),
('Parasite', 'Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan.', ARRAY['Drama', 'Thriller', 'Comedy'], 'satirical', 'produced', 'CJ Entertainment', 'indie', 266.10, true, 'public_domain');

-- =============================================================================
-- HNSW INDEX for vector similarity search
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_script_corpus_logline_embedding
  ON script_corpus
  USING hnsw (logline_embedding vector_cosine_ops);

-- Additional GIN index for genre array
CREATE INDEX IF NOT EXISTS idx_script_corpus_genre
  ON script_corpus
  USING gin (genre);
