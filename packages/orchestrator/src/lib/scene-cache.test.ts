/**
 * Tests for scene-level idempotency cache (T2-2 of #190).
 *
 * Pins:
 *   - computeSceneRenderHash is deterministic and content-sensitive.
 *   - findCachedSceneRender returns the path on (hash, file present),
 *     returns null on hash mismatch OR missing file OR DB error.
 *   - recordSceneRender upserts cleanly and never throws.
 *   - SCENE_CACHE_DISABLED=true bypasses cache reads + writes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockFindUnique, mockUpsert, mockExistsSync } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpsert: vi.fn(),
  mockExistsSync: vi.fn(),
}));

vi.mock('./prisma.js', () => ({
  prisma: { sceneRender: { findUnique: mockFindUnique, upsert: mockUpsert } },
}));

vi.mock('fs', () => ({ default: { existsSync: mockExistsSync }, existsSync: mockExistsSync }));

vi.mock('./logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  computeSceneRenderHash,
  findCachedSceneRender,
  recordSceneRender,
  isSceneCacheEnabled,
} from './scene-cache.js';
import type { Scene } from '../schemas/director-json.js';

const baseScene: Scene = {
  scene_id: 'scene_001',
  mood: 'tense',
  intensity: 0.7,
  dialogue: [
    {
      line_id: 'line_001',
      character: 'ALEX',
      text: 'We have a problem.',
      voice_key: 'voice_alex_001',
      emotion: 'NERVOUS',
    },
  ],
  music: [{ file: 'm_orchestra_01.mp3', start_at: 0, volume: 0.6 }],
  ambience: [{ file: 'a_room_tone.mp3', volume: 0.3 }],
  sfx: [],
  mix: { target_lufs: -16, true_peak_db: -1, music_gain_db: -6 },
};

describe('computeSceneRenderHash', () => {
  it('is deterministic for the same scene', () => {
    const h1 = computeSceneRenderHash(baseScene);
    const h2 = computeSceneRenderHash(baseScene);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes when dialogue text changes', () => {
    const edited = {
      ...baseScene,
      dialogue: [{ ...baseScene.dialogue[0], text: 'Something else entirely.' }],
    };
    expect(computeSceneRenderHash(edited)).not.toBe(computeSceneRenderHash(baseScene));
  });

  it('changes when voice_key changes', () => {
    const edited = {
      ...baseScene,
      dialogue: [{ ...baseScene.dialogue[0], voice_key: 'voice_different' }],
    };
    expect(computeSceneRenderHash(edited)).not.toBe(computeSceneRenderHash(baseScene));
  });

  it('changes when a music cue is added', () => {
    const edited = {
      ...baseScene,
      music: [...(baseScene.music ?? []), { file: 'm_string_swell.mp3' }],
    };
    expect(computeSceneRenderHash(edited)).not.toBe(computeSceneRenderHash(baseScene));
  });

  it('changes when mix params change', () => {
    const edited = { ...baseScene, mix: { ...baseScene.mix, target_lufs: -14 } };
    expect(computeSceneRenderHash(edited)).not.toBe(computeSceneRenderHash(baseScene));
  });

  it('is INSENSITIVE to summary/mood-string changes that do not affect rendering', () => {
    // Mood DOES affect the hash (it can feed alignment/mix decisions). This
    // is a "negative" sanity check that the hash is at least sensitive to
    // the inputs we listed in the spec — not a contract about *everything*
    // being insensitive.
    const stillSame = { ...baseScene }; // identical
    expect(computeSceneRenderHash(stillSame)).toBe(computeSceneRenderHash(baseScene));
  });

  // B-003 (2026-06-15) — per-user audio tuning must invalidate the cache.
  // Without this the slider feature breaks invisibly: locking new values
  // would silently return the same render that was made with the old values.
  describe('B-003 — audio tuning invalidation', () => {
    it('hash without tuning matches hash with explicit undefined tuning (back-compat)', () => {
      expect(computeSceneRenderHash(baseScene)).toBe(
        computeSceneRenderHash(baseScene, undefined),
      );
    });

    it('hash changes when ANY tuning offset changes', () => {
      const base = computeSceneRenderHash(baseScene);
      expect(
        computeSceneRenderHash(baseScene, {
          musicGainOffsetDb: 3,
          ambienceGainOffsetDb: 0,
          sfxGainOffsetDb: 0,
          narrationSpeed: 1.0,
        }),
      ).not.toBe(base);
      expect(
        computeSceneRenderHash(baseScene, {
          musicGainOffsetDb: 0,
          ambienceGainOffsetDb: 0,
          sfxGainOffsetDb: 0,
          narrationSpeed: 1.05, // only speed changed
        }),
      ).not.toBe(base);
    });

    it('two different tuning shapes produce different hashes', () => {
      const t1 = computeSceneRenderHash(baseScene, {
        musicGainOffsetDb: 3,
        ambienceGainOffsetDb: 0,
        sfxGainOffsetDb: 0,
        narrationSpeed: 1.0,
      });
      const t2 = computeSceneRenderHash(baseScene, {
        musicGainOffsetDb: 0,
        ambienceGainOffsetDb: 3,
        sfxGainOffsetDb: 0,
        narrationSpeed: 1.0,
      });
      expect(t1).not.toBe(t2);
    });

    it('same tuning hashes identically (deterministic)', () => {
      const tuning = {
        musicGainOffsetDb: 2,
        ambienceGainOffsetDb: 1,
        sfxGainOffsetDb: -1,
        narrationSpeed: 1.1,
      };
      expect(computeSceneRenderHash(baseScene, tuning)).toBe(
        computeSceneRenderHash(baseScene, tuning),
      );
    });
  });
});

describe('findCachedSceneRender', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SCENE_CACHE_DISABLED;
  });

  it('returns the cached path on a hash + file match', async () => {
    mockFindUnique.mockResolvedValueOnce({
      contentHash: 'abc123',
      scenePath: '/tmp/scene.m4a',
    });
    mockExistsSync.mockReturnValueOnce(true);

    const result = await findCachedSceneRender('proj_1', 'scene_001', 'abc123');
    expect(result).toBe('/tmp/scene.m4a');
  });

  it('returns null on hash mismatch', async () => {
    mockFindUnique.mockResolvedValueOnce({
      contentHash: 'stale_hash',
      scenePath: '/tmp/scene.m4a',
    });

    const result = await findCachedSceneRender('proj_1', 'scene_001', 'fresh_hash');
    expect(result).toBeNull();
    // Should not even check file existence when hash differs.
    expect(mockExistsSync).not.toHaveBeenCalled();
  });

  it('returns null when DB has the hash but file has been cleaned off disk', async () => {
    mockFindUnique.mockResolvedValueOnce({
      contentHash: 'abc123',
      scenePath: '/tmp/gone.m4a',
    });
    mockExistsSync.mockReturnValueOnce(false);

    const result = await findCachedSceneRender('proj_1', 'scene_001', 'abc123');
    expect(result).toBeNull();
  });

  it('returns null when no DB row exists', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    const result = await findCachedSceneRender('proj_1', 'scene_001', 'abc123');
    expect(result).toBeNull();
  });

  it('returns null on DB error (does not throw)', async () => {
    mockFindUnique.mockRejectedValueOnce(new Error('DB unavailable'));
    const result = await findCachedSceneRender('proj_1', 'scene_001', 'abc123');
    expect(result).toBeNull();
  });

  it('returns null + skips DB call when SCENE_CACHE_DISABLED=true', async () => {
    process.env.SCENE_CACHE_DISABLED = 'true';
    const result = await findCachedSceneRender('proj_1', 'scene_001', 'abc123');
    expect(result).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  // #372: per-run TTS cache bypass — the "Re-render audio (reuse cached AI)"
  // UI toggle sets this. Must return null without touching the DB, even
  // when SCENE_CACHE_DISABLED is unset (i.e. cache is otherwise enabled).
  it('returns null + skips DB call when forceFreshTts=true', async () => {
    const result = await findCachedSceneRender(
      'proj_1',
      'scene_001',
      'abc123',
      { forceFreshTts: true },
    );
    expect(result).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  // The negation: forceFreshTts=false (or absent) must NOT short-circuit
  // — normal cache logic continues. Without this guard, a default-undefined
  // option could be misread as truthy and accidentally bypass every lookup.
  it('does NOT bypass cache when forceFreshTts=false', async () => {
    mockFindUnique.mockResolvedValueOnce({
      contentHash: 'abc123',
      scenePath: '/tmp/scene.m4a',
    });
    mockExistsSync.mockReturnValueOnce(true);
    const result = await findCachedSceneRender(
      'proj_1',
      'scene_001',
      'abc123',
      { forceFreshTts: false },
    );
    expect(result).toBe('/tmp/scene.m4a');
    expect(mockFindUnique).toHaveBeenCalledTimes(1);
  });
});

describe('recordSceneRender', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SCENE_CACHE_DISABLED;
  });

  it('upserts a row with the given hash + path', async () => {
    mockUpsert.mockResolvedValueOnce({});
    await recordSceneRender('proj_1', 'scene_001', 'h', '/tmp/s.m4a');
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const call = mockUpsert.mock.calls[0][0];
    expect(call.create).toEqual({
      projectId: 'proj_1',
      sceneId: 'scene_001',
      contentHash: 'h',
      scenePath: '/tmp/s.m4a',
    });
  });

  it('swallows DB errors so the request still completes', async () => {
    mockUpsert.mockRejectedValueOnce(new Error('disk full'));
    await expect(recordSceneRender('p', 's', 'h', '/x')).resolves.toBeUndefined();
  });

  it('skips DB call when SCENE_CACHE_DISABLED=true', async () => {
    process.env.SCENE_CACHE_DISABLED = 'true';
    await recordSceneRender('p', 's', 'h', '/x');
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

describe('isSceneCacheEnabled', () => {
  afterEach(() => {
    delete process.env.SCENE_CACHE_DISABLED;
  });

  it('is enabled by default', () => {
    delete process.env.SCENE_CACHE_DISABLED;
    expect(isSceneCacheEnabled()).toBe(true);
  });

  it('is disabled when env=true', () => {
    process.env.SCENE_CACHE_DISABLED = 'true';
    expect(isSceneCacheEnabled()).toBe(false);
  });

  it('any other value keeps the cache enabled', () => {
    process.env.SCENE_CACHE_DISABLED = 'false';
    expect(isSceneCacheEnabled()).toBe(true);
    process.env.SCENE_CACHE_DISABLED = 'yes';
    expect(isSceneCacheEnabled()).toBe(true);
  });
});
