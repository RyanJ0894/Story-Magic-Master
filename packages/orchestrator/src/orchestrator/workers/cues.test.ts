/**
 * Tests for Cues Worker
 * Validates audio cue extraction from scenes
 */

import { describe, it, expect } from 'vitest';
import { pickCues, type SceneCues } from './cues.js';
import type { Scene } from '../../schemas/director-json.js';
import type { AudioCatalog } from '../../lib/catalog-loader.js';

const mockCatalog: AudioCatalog = {
  music: [
    { id: 'music/epic_001.mp3', path: '/catalog/music/epic_001.mp3', filename: 'epic_001.mp3' },
    { id: 'music/sad_001.mp3', path: '/catalog/music/sad_001.mp3', filename: 'sad_001.mp3' },
  ],
  ambience: [
    { id: 'ambience/forest.mp3', path: '/catalog/ambience/forest.mp3', filename: 'forest.mp3' },
    { id: 'ambience/city.mp3', path: '/catalog/ambience/city.mp3', filename: 'city.mp3' },
  ],
  sfx: [
    { id: 'sfx/gunshot.mp3', path: '/catalog/sfx/gunshot.mp3', filename: 'gunshot.mp3' },
    { id: 'sfx/explosion.mp3', path: '/catalog/sfx/explosion.mp3', filename: 'explosion.mp3' },
  ],
};

describe('pickCues', () => {
  it('should extract music cues from scene', async () => {
    const scene: Scene = {
      scene_id: 'scene_001',
      dialogue: [],
      music: [
        { file: 'music/epic_001.mp3', start_at: 0, volume: -20 },
      ],
    };

    const cues = await pickCues(scene, mockCatalog);

    expect(cues.music).toHaveLength(1);
    expect(cues.music?.[0].file).toBe('music/epic_001.mp3');
  });

  it('should extract ambience cues from scene', async () => {
    const scene: Scene = {
      scene_id: 'scene_002',
      dialogue: [],
      ambience: [
        { file: 'ambience/forest.mp3', volume: -24 },
      ],
    };

    const cues = await pickCues(scene, mockCatalog);

    expect(cues.ambience).toHaveLength(1);
    expect(cues.ambience?.[0].file).toBe('ambience/forest.mp3');
  });

  it('should extract SFX cues from scene', async () => {
    const scene: Scene = {
      scene_id: 'scene_003',
      dialogue: [
        { line_id: 'line_001', character: 'John', text: 'Bang!', voice_key: 'voice_john' },
      ],
      sfx: [
        { file: 'sfx/gunshot.mp3', start_at: 'line_001', duration: 2 },
      ],
    };

    const cues = await pickCues(scene, mockCatalog);

    expect(cues.sfx).toHaveLength(1);
    expect(cues.sfx?.[0].file).toBe('sfx/gunshot.mp3');
    expect(cues.sfx?.[0].start_at).toBe('line_001');
  });

  it('should handle scene with all audio types', async () => {
    const scene: Scene = {
      scene_id: 'scene_004',
      dialogue: [],
      music: [{ file: 'music/epic_001.mp3' }],
      ambience: [{ file: 'ambience/city.mp3' }],
      sfx: [{ file: 'sfx/explosion.mp3', start_at: 10 }],
    };

    const cues = await pickCues(scene, mockCatalog);

    expect(cues.music).toHaveLength(1);
    expect(cues.ambience).toHaveLength(1);
    expect(cues.sfx).toHaveLength(1);
  });

  it('should handle scene with no audio cues', async () => {
    const scene: Scene = {
      scene_id: 'scene_005',
      dialogue: [
        { line_id: 'line_001', character: 'Alice', text: 'Hello', voice_key: 'voice_alice' },
      ],
    };

    const cues = await pickCues(scene, mockCatalog);

    // Returns empty arrays, not undefined
    expect(cues.music).toHaveLength(0);
    expect(cues.ambience).toHaveLength(0);
    expect(cues.sfx).toHaveLength(0);
  });

  it('should handle empty audio arrays', async () => {
    const scene: Scene = {
      scene_id: 'scene_006',
      dialogue: [],
      music: [],
      ambience: [],
      sfx: [],
    };

    const cues = await pickCues(scene, mockCatalog);

    expect(cues.music).toHaveLength(0);
    expect(cues.ambience).toHaveLength(0);
    expect(cues.sfx).toHaveLength(0);
  });

  it('should preserve all cue properties', async () => {
    const scene: Scene = {
      scene_id: 'scene_007',
      dialogue: [],
      music: [
        {
          file: 'music/sad_001.mp3',
          reasoning: 'Sad mood for scene',
          start_at: 5,
          end_at: 120,
          volume: -22,
          fade_out: 3,
        },
      ],
    };

    const cues = await pickCues(scene, mockCatalog);

    expect(cues.music?.[0]).toEqual({
      file: 'music/sad_001.mp3',
      reasoning: 'Sad mood for scene',
      start_at: 5,
      end_at: 120,
      volume: -22,
      fade_out: 3,
    });
  });

  it('should handle multiple cues of same type', async () => {
    const scene: Scene = {
      scene_id: 'scene_008',
      dialogue: [],
      sfx: [
        { file: 'sfx/gunshot.mp3', start_at: 'line_001' },
        { file: 'sfx/explosion.mp3', start_at: 'line_002' },
        { file: 'sfx/gunshot.mp3', start_at: 'line_003' },
      ],
    };

    const cues = await pickCues(scene, mockCatalog);

    expect(cues.sfx).toHaveLength(3);
  });
});

describe('SceneCues type', () => {
  it('should have correct structure', () => {
    const cues: SceneCues = {
      music: [{ file: 'music/test.mp3' }],
      ambience: [{ file: 'ambience/test.mp3' }],
      sfx: [{ file: 'sfx/test.mp3', start_at: 0 }],
    };

    expect(cues.music).toBeDefined();
    expect(cues.ambience).toBeDefined();
    expect(cues.sfx).toBeDefined();
  });

  it('should allow undefined arrays', () => {
    const cues: SceneCues = {};

    expect(cues.music).toBeUndefined();
    expect(cues.ambience).toBeUndefined();
    expect(cues.sfx).toBeUndefined();
  });
});
