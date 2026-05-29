-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

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
CREATE TABLE "mix_manifests" (
    "project_id" TEXT NOT NULL,
    "scene_id" TEXT NOT NULL,
    "mix_manifest_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mix_manifests_pkey" PRIMARY KEY ("project_id","scene_id")
);

-- CreateTable
CREATE TABLE "timelines" (
    "project_id" TEXT NOT NULL,
    "scene_id" TEXT NOT NULL,
    "timeline_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timelines_pkey" PRIMARY KEY ("project_id","scene_id")
);

-- CreateTable
CREATE TABLE "alignments" (
    "project_id" TEXT NOT NULL,
    "scene_id" TEXT NOT NULL,
    "alignment_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alignments_pkey" PRIMARY KEY ("project_id","scene_id")
);

-- CreateTable
CREATE TABLE "tts_stems" (
    "project_id" TEXT NOT NULL,
    "scene_id" TEXT NOT NULL,
    "line_id" TEXT NOT NULL,
    "text_hash" TEXT,
    "voice_hash" TEXT,
    "path" TEXT,
    "duration_s" DOUBLE PRECISION,

    CONSTRAINT "tts_stems_pkey" PRIMARY KEY ("project_id","scene_id","line_id")
);

-- CreateTable
CREATE TABLE "voice_map" (
    "project_id" TEXT NOT NULL,
    "character" TEXT NOT NULL,
    "voice_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'elevenlabs',
    "params_json" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "voice_map_pkey" PRIMARY KEY ("project_id","character")
);

-- CreateIndex
CREATE INDEX "projects_user_id_idx" ON "projects"("user_id");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "projects_user_id_created_at_idx" ON "projects"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "purchases_stripe_payment_intent_id_key" ON "purchases"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "purchases_user_id_idx" ON "purchases"("user_id");

-- CreateIndex
CREATE INDEX "purchases_project_id_idx" ON "purchases"("project_id");

-- CreateIndex
CREATE INDEX "purchases_project_id_purchase_type_status_idx" ON "purchases"("project_id", "purchase_type", "status");

