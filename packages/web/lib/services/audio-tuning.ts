/**
 * Audio Tuning service — B-002 of the 2026-06-15 build plan.
 *
 * Pure business logic for reading/writing per-user `AudioTuning` rows.
 * The route handler at `app/api/settings/audio-tuning/route.ts` calls into
 * these so all validation/clamping happens in one place and is unit-testable
 * without spinning up Next.js.
 */

import { z } from 'zod';
import type { PrismaClient } from '@story-magic/shared';

// =============================================================================
// Ranges — single source of truth
// =============================================================================
// Mirrored by the UI sliders' min/max and the API validation. If we ever
// expand the ranges, update HERE and the sliders will auto-pick it up via
// their imports.

export const TUNING_RANGES = {
  /** Music dB offset relative to in-code -12 dB default. */
  musicGainOffsetDb:    { min: -8,    max: 8,    step: 1 },
  /** Ambience dB offset relative to in-code -18 dB default. */
  ambienceGainOffsetDb: { min: -8,    max: 8,    step: 1 },
  /** SFX dB offset relative to in-code -6 dB default. */
  sfxGainOffsetDb:      { min: -8,    max: 8,    step: 1 },
  /** Narration speed multiplier (ElevenLabs voice_settings.speed). */
  narrationSpeed:       { min: 0.85,  max: 1.20, step: 0.05 },
} as const;

// =============================================================================
// Validation schema
// =============================================================================

export const AudioTuningPatchSchema = z.object({
  musicGainOffsetDb: z
    .number()
    .int()
    .min(TUNING_RANGES.musicGainOffsetDb.min)
    .max(TUNING_RANGES.musicGainOffsetDb.max)
    .optional(),
  ambienceGainOffsetDb: z
    .number()
    .int()
    .min(TUNING_RANGES.ambienceGainOffsetDb.min)
    .max(TUNING_RANGES.ambienceGainOffsetDb.max)
    .optional(),
  sfxGainOffsetDb: z
    .number()
    .int()
    .min(TUNING_RANGES.sfxGainOffsetDb.min)
    .max(TUNING_RANGES.sfxGainOffsetDb.max)
    .optional(),
  narrationSpeed: z
    .number()
    .min(TUNING_RANGES.narrationSpeed.min)
    .max(TUNING_RANGES.narrationSpeed.max)
    .optional(),
  locked: z.boolean().optional(),
});

export type AudioTuningPatch = z.infer<typeof AudioTuningPatchSchema>;

// =============================================================================
// Shape returned to clients
// =============================================================================

export interface AudioTuningDto {
  musicGainOffsetDb: number;
  ambienceGainOffsetDb: number;
  sfxGainOffsetDb: number;
  narrationSpeed: number;
  locked: boolean;
  updatedAt: string | null;
}

/** Defaults returned when no row exists for the user yet. */
export const DEFAULT_AUDIO_TUNING: AudioTuningDto = {
  musicGainOffsetDb: 0,
  ambienceGainOffsetDb: 0,
  sfxGainOffsetDb: 0,
  narrationSpeed: 1.0,
  locked: false,
  updatedAt: null,
};

// =============================================================================
// Service
// =============================================================================

/**
 * Read the user's tuning row, or return DEFAULT_AUDIO_TUNING if none exists.
 * Cheap — single indexed PK lookup.
 */
export async function getAudioTuning(
  prisma: PrismaClient,
  userId: string,
): Promise<AudioTuningDto> {
  const row = await prisma.audioTuning.findUnique({
    where: { userId },
  });
  if (!row) return DEFAULT_AUDIO_TUNING;
  return {
    musicGainOffsetDb: row.musicGainOffsetDb,
    ambienceGainOffsetDb: row.ambienceGainOffsetDb,
    sfxGainOffsetDb: row.sfxGainOffsetDb,
    narrationSpeed: row.narrationSpeed,
    locked: row.locked,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Upsert: applies the patch to whatever the user currently has (or to defaults
 * if no row exists). Only the fields present in the patch are written; absent
 * fields preserve their current value.
 */
export async function updateAudioTuning(
  prisma: PrismaClient,
  userId: string,
  patch: AudioTuningPatch,
): Promise<AudioTuningDto> {
  // Merge patch onto current state for the create path. (For update path,
  // Prisma already preserves omitted fields.)
  const current = await prisma.audioTuning.findUnique({ where: { userId } });
  const merged = {
    musicGainOffsetDb:    patch.musicGainOffsetDb    ?? current?.musicGainOffsetDb    ?? DEFAULT_AUDIO_TUNING.musicGainOffsetDb,
    ambienceGainOffsetDb: patch.ambienceGainOffsetDb ?? current?.ambienceGainOffsetDb ?? DEFAULT_AUDIO_TUNING.ambienceGainOffsetDb,
    sfxGainOffsetDb:      patch.sfxGainOffsetDb      ?? current?.sfxGainOffsetDb      ?? DEFAULT_AUDIO_TUNING.sfxGainOffsetDb,
    narrationSpeed:       patch.narrationSpeed       ?? current?.narrationSpeed       ?? DEFAULT_AUDIO_TUNING.narrationSpeed,
    locked:               patch.locked               ?? current?.locked               ?? DEFAULT_AUDIO_TUNING.locked,
  };

  const row = await prisma.audioTuning.upsert({
    where: { userId },
    update: merged,
    create: { userId, ...merged },
  });

  return {
    musicGainOffsetDb: row.musicGainOffsetDb,
    ambienceGainOffsetDb: row.ambienceGainOffsetDb,
    sfxGainOffsetDb: row.sfxGainOffsetDb,
    narrationSpeed: row.narrationSpeed,
    locked: row.locked,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Convenience for the orchestrator-bound shape: returns the values only when
 * the user has explicitly locked them. Returns undefined otherwise — the
 * pipeline interprets undefined as "use in-code defaults".
 *
 * The check happens at the processor right before calling /orchestrate; see
 * B-005 wiring notes.
 */
export async function getLockedAudioTuning(
  prisma: PrismaClient,
  userId: string,
): Promise<Omit<AudioTuningDto, 'locked' | 'updatedAt'> | undefined> {
  const tuning = await getAudioTuning(prisma, userId);
  if (!tuning.locked) return undefined;
  return {
    musicGainOffsetDb: tuning.musicGainOffsetDb,
    ambienceGainOffsetDb: tuning.ambienceGainOffsetDb,
    sfxGainOffsetDb: tuning.sfxGainOffsetDb,
    narrationSpeed: tuning.narrationSpeed,
  };
}
