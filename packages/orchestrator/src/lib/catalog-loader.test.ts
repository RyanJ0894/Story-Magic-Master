/**
 * Tests for Catalog Loader
 * Validates audio catalog loading and track lookup
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadCatalog, getTrackPath, validateSceneTracks, type AudioCatalog } from './catalog-loader.js';
import { log } from './logger.js';

// Mock fs module
vi.mock('fs');

describe('loadCatalog', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should load catalog from existing directories', () => {
    // Mock directory existence
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const pathStr = String(p);
      return (
        pathStr.includes('catalog') ||
        pathStr.includes('music') ||
        pathStr.includes('ambience') ||
        pathStr.includes('sfx')
      );
    });

    // Mock directory reading
    vi.mocked(fs.readdirSync).mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr.includes('music')) {
        return ['track1.mp3', 'track2.wav', 'readme.txt'] as unknown as fs.Dirent[];
      }
      if (pathStr.includes('ambience')) {
        return ['forest.mp3', 'city.wav'] as unknown as fs.Dirent[];
      }
      if (pathStr.includes('sfx')) {
        return ['gunshot.mp3', 'explosion.wav', 'footsteps.m4a'] as unknown as fs.Dirent[];
      }
      return [] as unknown as fs.Dirent[];
    });

    // Mock console methods
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const catalog = loadCatalog();

    expect(catalog.music).toHaveLength(2); // Excludes readme.txt
    expect(catalog.ambience).toHaveLength(2);
    expect(catalog.sfx).toHaveLength(3); // Includes m4a

    consoleSpy.mockRestore();
  });

  it('should create directories if catalog does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const catalog = loadCatalog();

    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(catalog.music).toHaveLength(0);
    expect(catalog.ambience).toHaveLength(0);
    expect(catalog.sfx).toHaveLength(0);

    consoleSpy.mockRestore();
  });

  it('should filter only audio files', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      'track.mp3',
      'track.wav',
      'track.m4a',
      'readme.md',
      'config.json',
      '.DS_Store',
    ] as unknown as fs.Dirent[]);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const catalog = loadCatalog();

    // Only mp3, wav, m4a files should be included
    const allTracks = [...catalog.music, ...catalog.ambience, ...catalog.sfx];
    const hasNonAudio = allTracks.some(
      (t) => !t.filename.endsWith('.mp3') && !t.filename.endsWith('.wav') && !t.filename.endsWith('.m4a')
    );

    expect(hasNonAudio).toBe(false);
    consoleSpy.mockRestore();
  });

  it('should handle read errors gracefully', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const logErrorSpy = vi.spyOn(log, 'error').mockImplementation(() => {});

    const catalog = loadCatalog();

    expect(catalog).toBeDefined();
    expect(logErrorSpy).toHaveBeenCalled();

    logErrorSpy.mockRestore();
  });
});

describe('getTrackPath', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return path for existing track', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const result = getTrackPath('music/epic_001.mp3');

    expect(result).toBe(path.join('catalog', 'music/epic_001.mp3'));
  });

  it('should return null for non-existent track', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = getTrackPath('music/nonexistent.mp3');

    expect(result).toBeNull();
    consoleWarnSpy.mockRestore();
  });

  it('should try alternate extension (.mp3 -> .wav)', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return String(p).endsWith('.wav');
    });

    const result = getTrackPath('music/track.mp3');

    expect(result).toContain('.wav');
  });

  it('should try alternate extension (.wav -> .mp3)', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return String(p).endsWith('.mp3');
    });

    const result = getTrackPath('music/track.wav');

    expect(result).toContain('.mp3');
  });

  it('should return null for empty/null input', () => {
    expect(getTrackPath('')).toBeNull();
    // @ts-expect-error - Testing null input
    expect(getTrackPath(null)).toBeNull();
  });

  it('should handle paths with subdirectories', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const result = getTrackPath('music/epic/track_001.mp3');

    expect(result).toContain('catalog');
    expect(result).toContain('music/epic/track_001.mp3');
  });
});

describe('validateSceneTracks', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should validate scene with all tracks present', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const scene = {
      music: [{ track_id: 'music/epic.mp3' }],
      ambience: { track_id: 'ambience/forest.mp3' },
      sfx: [{ track_id: 'sfx/gunshot.mp3' }],
    };

    const result = validateSceneTracks(scene);

    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('should detect missing music track', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const scene = {
      music: [{ track_id: 'music/nonexistent.mp3' }],
    };

    const result = validateSceneTracks(scene);

    expect(result.valid).toBe(false);
    expect(result.missing).toContain('music/nonexistent.mp3');

    consoleWarnSpy.mockRestore();
  });

  it('should detect missing ambience track', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const scene = {
      ambience: { track_id: 'ambience/missing.mp3' },
    };

    const result = validateSceneTracks(scene);

    expect(result.valid).toBe(false);
    expect(result.missing).toContain('ambience/missing.mp3');

    consoleWarnSpy.mockRestore();
  });

  it('should detect multiple missing tracks', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const scene = {
      music: [{ track_id: 'music/missing1.mp3' }, { track_id: 'music/missing2.mp3' }],
      sfx: [{ track_id: 'sfx/missing.mp3' }],
    };

    const result = validateSceneTracks(scene);

    expect(result.valid).toBe(false);
    expect(result.missing).toHaveLength(3);

    consoleWarnSpy.mockRestore();
  });

  it('should handle scene with no audio cues', () => {
    const scene = {};

    const result = validateSceneTracks(scene);

    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('should handle scene with empty arrays', () => {
    const scene = {
      music: [],
      sfx: [],
    };

    const result = validateSceneTracks(scene);

    expect(result.valid).toBe(true);
  });

  it('should skip entries without track_id', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const scene = {
      music: [{ track_id: 'music/valid.mp3' }, {}],
    };

    const result = validateSceneTracks(scene);

    expect(result.valid).toBe(true);
  });
});

describe('AudioCatalog type', () => {
  it('should have correct structure', () => {
    const catalog: AudioCatalog = {
      music: [{ id: 'music/track.mp3', path: '/path/to/track.mp3', filename: 'track.mp3' }],
      ambience: [],
      sfx: [],
    };

    expect(catalog.music[0].id).toBe('music/track.mp3');
    expect(catalog.music[0].path).toBe('/path/to/track.mp3');
    expect(catalog.music[0].filename).toBe('track.mp3');
  });
});
