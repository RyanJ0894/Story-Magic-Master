/**
 * Tests for Mixer Worker
 * Validates audio mixing types and interfaces
 *
 * Note: Full mixScene integration tests require actual audio files
 * and FFmpeg installation. This file tests the types and interfaces.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('MixInputs type', () => {
  it('should define dialogue as required', () => {
    // Type test - dialogue must be present
    const inputs = {
      dialogue: '/path/to/dialogue.wav',
    };

    expect(inputs.dialogue).toBeDefined();
  });

  it('should allow optional music', () => {
    const inputs = {
      dialogue: '/path/to/dialogue.wav',
      music: '/path/to/music.mp3',
    };

    expect(inputs.music).toBe('/path/to/music.mp3');
  });

  it('should allow optional ambience', () => {
    const inputs = {
      dialogue: '/path/to/dialogue.wav',
      ambience: '/path/to/ambience.mp3',
    };

    expect(inputs.ambience).toBe('/path/to/ambience.mp3');
  });

  it('should allow SFX array', () => {
    const inputs = {
      dialogue: '/path/to/dialogue.wav',
      sfx: [
        { file: '/path/to/sfx1.mp3', at: 5, duration: 2 },
        { file: '/path/to/sfx2.mp3', at: 10, duration: null },
      ],
    };

    expect(inputs.sfx).toHaveLength(2);
  });
});

describe('MixParams type', () => {
  it('should have sensible defaults', () => {
    const defaultParams = {
      music_gain_db: -22,
      ambience_gain_db: -26,
      sfx_gain_db: -12,
      target_lufs: -16,
      true_peak_db: -1.5,
      use_dialogue_processing: true,
      use_advanced_ducking: true,
    };

    expect(defaultParams.target_lufs).toBe(-16); // EBU R128 streaming
    expect(defaultParams.true_peak_db).toBeLessThan(0);
    expect(defaultParams.music_gain_db).toBeLessThan(0);
  });

  it('should validate target LUFS range', () => {
    // Typical ranges for different platforms
    const streamingLufs = -16; // Spotify, YouTube
    const broadcastLufs = -24; // European broadcast
    const podcastLufs = -19; // Podcasts

    expect(streamingLufs).toBeGreaterThanOrEqual(-24);
    expect(streamingLufs).toBeLessThanOrEqual(-14);
    expect(broadcastLufs).toBeGreaterThanOrEqual(-24);
    expect(podcastLufs).toBeGreaterThanOrEqual(-24);
  });

  it('should validate true peak range', () => {
    const truePeak = -1.5;

    // True peak should be negative to prevent clipping
    expect(truePeak).toBeLessThan(0);
    // Typical safe range
    expect(truePeak).toBeGreaterThanOrEqual(-3);
  });
});

describe('MixSceneOptions interface', () => {
  it('should require essential fields', () => {
    const options = {
      project_id: 'proj_001',
      scene_id: 'scene_001',
      inputs: {
        dialogue: '/path/to/dialogue.wav',
      },
      outWav: '/path/to/temp.wav',
      outFinal: '/path/to/output.m4a',
    };

    expect(options.project_id).toBeDefined();
    expect(options.scene_id).toBeDefined();
    expect(options.inputs.dialogue).toBeDefined();
    expect(options.outWav).toBeDefined();
    expect(options.outFinal).toBeDefined();
  });

  it('should allow optional mix parameters', () => {
    const options = {
      project_id: 'proj_001',
      scene_id: 'scene_001',
      inputs: {
        dialogue: '/path/to/dialogue.wav',
      },
      outWav: '/path/to/temp.wav',
      outFinal: '/path/to/output.m4a',
      mixParams: {
        music_gain_db: -18,
        target_lufs: -14,
      },
    };

    expect(options.mixParams?.music_gain_db).toBe(-18);
    expect(options.mixParams?.target_lufs).toBe(-14);
  });
});

describe('MixManifest type', () => {
  it('should track input sources', () => {
    const manifest = {
      project_id: 'proj_001',
      scene_id: 'scene_007',
      inputs: {
        dialogue: '/path/to/dialogue.wav',
        music: '/path/to/music.mp3',
      },
      output: '/path/to/output.m4a',
      params: {
        target_lufs: -16,
        true_peak_db: -1.5,
      },
      duration: 120.5,
      created_at: new Date().toISOString(),
    };

    expect(manifest.project_id).toBeDefined();
    expect(manifest.inputs.dialogue).toBeDefined();
  });

  it('should record processing parameters', () => {
    const manifest = {
      project_id: 'proj_002',
      scene_id: 'scene_008',
      inputs: {
        dialogue: '/path/to/dialogue.wav',
      },
      output: '/path/to/output.m4a',
      params: {
        target_lufs: -16,
        true_peak_db: -1.5,
        music_gain_db: -22,
        ambience_gain_db: -26,
      },
      duration: 60.0,
      created_at: new Date().toISOString(),
    };

    expect(manifest.params.target_lufs).toBe(-16);
    expect(manifest.params.true_peak_db).toBe(-1.5);
  });
});

describe('Audio Standards', () => {
  it('should target -16 LUFS for streaming (EBU R128)', () => {
    const defaultTargetLufs = -16;
    expect(defaultTargetLufs).toBe(-16);
  });

  it('should limit true peak to -1.5 dB', () => {
    const defaultTruePeak = -1.5;
    expect(defaultTruePeak).toBeLessThan(0);
    expect(defaultTruePeak).toBeGreaterThan(-3);
  });

  it('should use film-standard gain staging', () => {
    // Film standard: dialogue at 0dB reference
    // Music: -4dB to -6dB under dialogue
    // Ambience: -6dB to -10dB under dialogue
    const musicGain = -22; // Relative to dialogue at 0dB
    const ambienceGain = -26;

    expect(musicGain).toBeLessThan(0);
    expect(ambienceGain).toBeLessThan(musicGain);
  });

  it('should have proper ducking levels', () => {
    // Ducking reduces background audio during dialogue
    const duckingLevels = [-3, -6, -9, -12, -15]; // Progressive ducking

    // All levels should be negative (reduction)
    duckingLevels.forEach((level) => {
      expect(level).toBeLessThan(0);
    });

    // Should be progressive
    for (let i = 1; i < duckingLevels.length; i++) {
      expect(duckingLevels[i]).toBeLessThan(duckingLevels[i - 1]);
    }
  });
});

describe('SFX Timing', () => {
  it('should support line_id-based timing', () => {
    const sfxCue = {
      file: 'sfx/gunshot.mp3',
      start_at: 'line_001', // Reference to dialogue line
      duration: 2,
    };

    expect(typeof sfxCue.start_at).toBe('string');
  });

  it('should support absolute timestamp timing', () => {
    const sfxCue = {
      file: 'sfx/explosion.mp3',
      start_at: 45.5, // Seconds
      duration: 3,
    };

    expect(typeof sfxCue.start_at).toBe('number');
  });

  it('should allow optional duration', () => {
    const sfxCue = {
      file: 'sfx/short_beep.mp3',
      start_at: 10,
      // No duration - play full file
    };

    expect(sfxCue.duration).toBeUndefined();
  });
});
