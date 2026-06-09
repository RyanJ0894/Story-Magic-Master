-- Migration: 0034_add_voice_catalog
-- Add voice_catalog_entries table for runtime-configurable voice catalog (#164)

CREATE TABLE "voice_catalog_entries" (
    "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
    "voice_id"      TEXT         NOT NULL,
    "name"          TEXT         NOT NULL,
    "label"         TEXT         NOT NULL,
    "gender"        TEXT         NOT NULL,
    "style"         TEXT         NOT NULL,
    "tone"          TEXT,
    "description"   TEXT,
    "is_placeholder" BOOLEAN     NOT NULL DEFAULT false,
    "is_active"     BOOLEAN      NOT NULL DEFAULT true,
    "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT "voice_catalog_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "voice_catalog_entries_voice_id_key" ON "voice_catalog_entries"("voice_id");
CREATE INDEX "voice_catalog_entries_is_active_idx" ON "voice_catalog_entries"("is_active");
