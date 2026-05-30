-- Migration: Orchestrator pipeline tables
-- Formalises tables previously created ad-hoc (prisma db push) by the
-- orchestrator service. Now tracked in the shared migration history.

-- CreateTable: mix_manifests
CREATE TABLE IF NOT EXISTS "mix_manifests" (
    "project_id" TEXT NOT NULL,
    "scene_id" TEXT NOT NULL,
    "mix_manifest_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mix_manifests_pkey" PRIMARY KEY ("project_id","scene_id")
);

-- CreateTable: timelines
CREATE TABLE IF NOT EXISTS "timelines" (
    "project_id" TEXT NOT NULL,
    "scene_id" TEXT NOT NULL,
    "timeline_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timelines_pkey" PRIMARY KEY ("project_id","scene_id")
);

-- CreateTable: alignments
CREATE TABLE IF NOT EXISTS "alignments" (
    "project_id" TEXT NOT NULL,
    "scene_id" TEXT NOT NULL,
    "alignment_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alignments_pkey" PRIMARY KEY ("project_id","scene_id")
);

-- CreateTable: tts_stems
CREATE TABLE IF NOT EXISTS "tts_stems" (
    "project_id" TEXT NOT NULL,
    "scene_id" TEXT NOT NULL,
    "line_id" TEXT NOT NULL,
    "text_hash" TEXT,
    "voice_hash" TEXT,
    "path" TEXT,
    "duration_s" DOUBLE PRECISION,

    CONSTRAINT "tts_stems_pkey" PRIMARY KEY ("project_id","scene_id","line_id")
);

-- CreateTable: voice_map
CREATE TABLE IF NOT EXISTS "voice_map" (
    "project_id" TEXT NOT NULL,
    "character" TEXT NOT NULL,
    "voice_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'elevenlabs',
    "params_json" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "voice_map_pkey" PRIMARY KEY ("project_id","character")
);
