/**
 * Tests for the AudioTuning service — B-001/B-002 of the 2026-06-15 build plan.
 *
 * Pins:
 *   1. Zod validation range enforcement (out-of-range → invalid)
 *   2. getAudioTuning returns defaults for users with no row
 *   3. updateAudioTuning preserves unchanged fields on patch
 *   4. getLockedAudioTuning returns undefined unless locked=true
 *   5. TUNING_RANGES match what the UI sliders advertise
 */

import { describe, it, expect, vi } from 'vitest';
import {
  AudioTuningPatchSchema,
  TUNING_RANGES,
  DEFAULT_AUDIO_TUNING,
  getAudioTuning,
  updateAudioTuning,
  getLockedAudioTuning,
} from '@/lib/services/audio-tuning';

type Prisma = Parameters<typeof getAudioTuning>[0];

function makePrisma(initial: Parameters<typeof updateAudioTuning>[2] | null = null) {
  const state = initial
    ? {
        userId: 'u-1',
        musicGainOffsetDb: initial.musicGainOffsetDb ?? 0,
        ambienceGainOffsetDb: initial.ambienceGainOffsetDb ?? 0,
        sfxGainOffsetDb: initial.sfxGainOffsetDb ?? 0,
        narrationSpeed: initial.narrationSpeed ?? 1.0,
        locked: initial.locked ?? false,
        updatedAt: new Date('2026-06-15T12:00:00Z'),
      }
    : null;

  const findUnique = vi.fn().mockResolvedValue(state);
  const upsert = vi.fn().mockImplementation(({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
    const merged = state ? { ...state, ...update } : { userId: 'u-1', updatedAt: new Date(), ...create };
    return Promise.resolve(merged);
  });

  return {
    prisma: { audioTuning: { findUnique, upsert } } as unknown as Prisma,
    findUnique,
    upsert,
  };
}

describe('AudioTuningPatchSchema', () => {
  it('accepts a fully-empty patch (the route handler will reject it separately)', () => {
    expect(AudioTuningPatchSchema.safeParse({}).success).toBe(true);
  });

  it('clamps musicGainOffsetDb to integer in [-8, 8]', () => {
    expect(AudioTuningPatchSchema.safeParse({ musicGainOffsetDb: -8 }).success).toBe(true);
    expect(AudioTuningPatchSchema.safeParse({ musicGainOffsetDb: 8 }).success).toBe(true);
    expect(AudioTuningPatchSchema.safeParse({ musicGainOffsetDb: -9 }).success).toBe(false);
    expect(AudioTuningPatchSchema.safeParse({ musicGainOffsetDb: 9 }).success).toBe(false);
    expect(AudioTuningPatchSchema.safeParse({ musicGainOffsetDb: 1.5 }).success).toBe(false); // non-integer
  });

  it.each([
    ['ambienceGainOffsetDb', -9, 9],
    ['sfxGainOffsetDb', -9, 9],
  ] as const)('clamps %s outside [-8, 8]', (key, low, high) => {
    expect(AudioTuningPatchSchema.safeParse({ [key]: low }).success).toBe(false);
    expect(AudioTuningPatchSchema.safeParse({ [key]: high }).success).toBe(false);
  });

  it('narrationSpeed must be in [0.85, 1.20]', () => {
    expect(AudioTuningPatchSchema.safeParse({ narrationSpeed: 0.85 }).success).toBe(true);
    expect(AudioTuningPatchSchema.safeParse({ narrationSpeed: 1.20 }).success).toBe(true);
    expect(AudioTuningPatchSchema.safeParse({ narrationSpeed: 0.80 }).success).toBe(false);
    expect(AudioTuningPatchSchema.safeParse({ narrationSpeed: 1.25 }).success).toBe(false);
  });

  it('locked is a boolean', () => {
    expect(AudioTuningPatchSchema.safeParse({ locked: true }).success).toBe(true);
    expect(AudioTuningPatchSchema.safeParse({ locked: 'yes' }).success).toBe(false);
  });
});

describe('TUNING_RANGES', () => {
  it('mirrors the in-code defaults (sanity for UI sliders consuming the same constants)', () => {
    expect(TUNING_RANGES.musicGainOffsetDb).toEqual({ min: -8, max: 8, step: 1 });
    expect(TUNING_RANGES.narrationSpeed).toEqual({ min: 0.85, max: 1.20, step: 0.05 });
  });
});

describe('DEFAULT_AUDIO_TUNING — 2026-06-20 narrator-speed bump', () => {
  // Ryan 6/15 + 6/21: "narration delivery is consistently a slower pace
  // than desired. We should adjust Narration tempo to be slightly faster."
  // Pinned so the default can't quietly drift back.
  it('narrationSpeed default is 1.1 (was 1.0)', () => {
    expect(DEFAULT_AUDIO_TUNING.narrationSpeed).toBe(1.1);
  });
  it('all gain offsets stay at 0 — relative tuning baseline lives in mixer', () => {
    expect(DEFAULT_AUDIO_TUNING.musicGainOffsetDb).toBe(0);
    expect(DEFAULT_AUDIO_TUNING.ambienceGainOffsetDb).toBe(0);
    expect(DEFAULT_AUDIO_TUNING.sfxGainOffsetDb).toBe(0);
  });
});

describe('getAudioTuning', () => {
  it('returns defaults when no row exists for the user', async () => {
    const { prisma } = makePrisma(null);
    const result = await getAudioTuning(prisma, 'u-1');
    expect(result).toEqual(DEFAULT_AUDIO_TUNING);
  });

  it('returns the persisted row when present', async () => {
    const { prisma } = makePrisma({
      musicGainOffsetDb: 3,
      ambienceGainOffsetDb: 2,
      sfxGainOffsetDb: 1,
      narrationSpeed: 1.05,
      locked: true,
    });
    const result = await getAudioTuning(prisma, 'u-1');
    expect(result).toMatchObject({
      musicGainOffsetDb: 3,
      ambienceGainOffsetDb: 2,
      sfxGainOffsetDb: 1,
      narrationSpeed: 1.05,
      locked: true,
    });
    expect(result.updatedAt).toBe('2026-06-15T12:00:00.000Z');
  });
});

describe('updateAudioTuning', () => {
  it('preserves unchanged fields when patching only one', async () => {
    const { prisma, upsert } = makePrisma({
      musicGainOffsetDb: 5,
      ambienceGainOffsetDb: 2,
      narrationSpeed: 1.05,
      locked: true,
    });
    await updateAudioTuning(prisma, 'u-1', { sfxGainOffsetDb: 4 });

    const args = upsert.mock.calls[0][0];
    expect(args.update).toMatchObject({
      musicGainOffsetDb: 5,    // preserved
      ambienceGainOffsetDb: 2, // preserved
      sfxGainOffsetDb: 4,      // patched
      narrationSpeed: 1.05,    // preserved
      locked: true,            // preserved
    });
  });

  it('creates from defaults when no row exists yet', async () => {
    const { prisma, upsert } = makePrisma(null);
    await updateAudioTuning(prisma, 'u-1', { narrationSpeed: 1.10 });

    const args = upsert.mock.calls[0][0];
    expect(args.create).toMatchObject({
      userId: 'u-1',
      musicGainOffsetDb: 0,
      ambienceGainOffsetDb: 0,
      sfxGainOffsetDb: 0,
      narrationSpeed: 1.10, // patched
      locked: false,
    });
  });

  it('explicit locked=false in a patch overrides a previously locked row', async () => {
    const { prisma, upsert } = makePrisma({ locked: true });
    await updateAudioTuning(prisma, 'u-1', { locked: false });

    expect(upsert.mock.calls[0][0].update).toMatchObject({ locked: false });
  });
});

describe('getLockedAudioTuning', () => {
  it('returns undefined when no row exists', async () => {
    const { prisma } = makePrisma(null);
    expect(await getLockedAudioTuning(prisma, 'u-1')).toBeUndefined();
  });

  it('returns undefined when row exists but locked=false', async () => {
    const { prisma } = makePrisma({ musicGainOffsetDb: 3, locked: false });
    expect(await getLockedAudioTuning(prisma, 'u-1')).toBeUndefined();
  });

  it('returns the tuning shape (no locked/updatedAt) when locked=true', async () => {
    const { prisma } = makePrisma({
      musicGainOffsetDb: 3,
      ambienceGainOffsetDb: 2,
      sfxGainOffsetDb: 1,
      narrationSpeed: 1.05,
      locked: true,
    });
    const result = await getLockedAudioTuning(prisma, 'u-1');
    expect(result).toEqual({
      musicGainOffsetDb: 3,
      ambienceGainOffsetDb: 2,
      sfxGainOffsetDb: 1,
      narrationSpeed: 1.05,
    });
    // critically — `locked` is NOT in the shape passed to the orchestrator
    expect(result).not.toHaveProperty('locked');
  });
});
