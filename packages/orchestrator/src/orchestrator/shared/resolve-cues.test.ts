/**
 * Resolve Cues Tests (#96)
 *
 * Verifies that resolveCuesToMixInputs:
 * 1. Correctly resolves existing catalog tracks
 * 2. Logs a warning (not a throw) when a track is missing from catalog
 * 3. Skips missing tracks silently (no crash)
 * 4. getDefaultMixParams returns audible ambience gain (-18 dB)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockGetTrackPath = vi.fn();
const mockExistsSync = vi.fn();
const mockWarn = vi.fn();

vi.mock('../../lib/catalog-loader.js', () => ({
  getTrackPath: (...args: unknown[]) => mockGetTrackPath(...args),
}));

vi.mock('fs', () => ({
  default: { existsSync: (...args: unknown[]) => mockExistsSync(...args) },
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
}));

vi.mock('../../lib/logger.js', () => ({
  log: { warn: (...args: unknown[]) => mockWarn(...args), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { resolveCuesToMixInputs, getDefaultMixParams } = await import('./resolve-cues.js');

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeCues(overrides = {}) {
  return {
    music: [],
    ambience: [],
    sfx: [],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('getDefaultMixParams — audible ambience gain (#96)', () => {
  it('returns ambience_gain_db of -18 (raised from -26 for audibility)', () => {
    const params = getDefaultMixParams();
    expect(params.ambience_gain_db).toBe(-18);
  });

  it('returns music_gain_db of -22 (background level)', () => {
    const params = getDefaultMixParams();
    expect(params.music_gain_db).toBe(-22);
  });

  it('returns sfx_gain_db of -12', () => {
    const params = getDefaultMixParams();
    expect(params.sfx_gain_db).toBe(-12);
  });

  it('applies scene overrides on top of defaults', () => {
    const params = getDefaultMixParams({ ambience_gain_db: -10 });
    expect(params.ambience_gain_db).toBe(-10);
    expect(params.music_gain_db).toBe(-22);
  });
});

describe('resolveCuesToMixInputs — missing track handling (#96)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves an existing ambience track to mixInputs.ambience', () => {
    mockGetTrackPath.mockReturnValue('/catalog/ambience/forest.mp3');
    mockExistsSync.mockReturnValue(true);

    const result = resolveCuesToMixInputs({
      cues: makeCues({ ambience: [{ file: 'ambience/forest.mp3' }] }),
      alignmentLines: [],
      dialoguePath: '/audio/dialogue.wav',
    });

    expect(result.ambience).toBe('/catalog/ambience/forest.mp3');
  });

  it('skips ambience and logs warning when track is missing from catalog', () => {
    mockGetTrackPath.mockReturnValue(null);
    mockExistsSync.mockReturnValue(false);

    const result = resolveCuesToMixInputs({
      cues: makeCues({ ambience: [{ file: 'ambience/missing_track.mp3' }] }),
      alignmentLines: [],
      dialoguePath: '/audio/dialogue.wav',
    });

    expect(result.ambience).toBeUndefined();
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining('[ResolveCues] ambience track not found'),
      expect.objectContaining({ trackId: 'ambience/missing_track.mp3' })
    );
  });

  it('skips music and logs warning when music track is missing', () => {
    mockGetTrackPath.mockReturnValue(null);
    mockExistsSync.mockReturnValue(false);

    const result = resolveCuesToMixInputs({
      cues: makeCues({ music: [{ file: 'music/missing.mp3' }] }),
      alignmentLines: [],
      dialoguePath: '/audio/dialogue.wav',
    });

    expect(result.music).toBeUndefined();
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining('[ResolveCues] music track not found'),
      expect.any(Object)
    );
  });

  it('skips SFX cue and logs warning when SFX file is missing', () => {
    mockGetTrackPath.mockReturnValue(null);

    const result = resolveCuesToMixInputs({
      cues: makeCues({
        sfx: [{ file: 'sfx/missing_sfx.mp3', start_at: 0, duration: null }],
      }),
      alignmentLines: [],
      dialoguePath: '/audio/dialogue.wav',
    });

    expect(result.sfx).toBeUndefined();
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining('[ResolveCues] SFX track not found'),
      expect.objectContaining({ file: 'sfx/missing_sfx.mp3' })
    );
  });

  it('resolves an existing SFX track with numeric start_at', () => {
    mockGetTrackPath.mockReturnValue('/catalog/sfx/gunshot.mp3');
    mockExistsSync.mockReturnValue(true);

    const result = resolveCuesToMixInputs({
      cues: makeCues({
        sfx: [{ file: 'sfx/gunshot.mp3', start_at: 5, duration: 2 }],
      }),
      alignmentLines: [],
      dialoguePath: '/audio/dialogue.wav',
    });

    expect(result.sfx).toHaveLength(1);
    expect(result.sfx?.[0]).toMatchObject({ file: '/catalog/sfx/gunshot.mp3', at: 5, duration: 2 });
  });

  it('resolves SFX start_at from line_id via alignment lookup', () => {
    mockGetTrackPath.mockReturnValue('/catalog/sfx/door.mp3');
    mockExistsSync.mockReturnValue(true);

    const result = resolveCuesToMixInputs({
      cues: makeCues({
        sfx: [{ file: 'sfx/door.mp3', start_at: 'line_003', duration: null }],
      }),
      alignmentLines: [
        { line_id: 'line_003', start: 12.5, end: 14.0, text: '' },
      ],
      dialoguePath: '/audio/dialogue.wav',
    });

    expect(result.sfx?.[0]).toMatchObject({ at: 12.5 });
  });

  it('returns empty sfx when all SFX tracks are missing', () => {
    mockGetTrackPath.mockReturnValue(null);

    const result = resolveCuesToMixInputs({
      cues: makeCues({
        sfx: [
          { file: 'sfx/missing1.mp3', start_at: 0, duration: null },
          { file: 'sfx/missing2.mp3', start_at: 1, duration: null },
        ],
      }),
      alignmentLines: [],
      dialoguePath: '/audio/dialogue.wav',
    });

    expect(result.sfx).toBeUndefined();
    expect(mockWarn).toHaveBeenCalledTimes(2);
  });
});
