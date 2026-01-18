/**
 * Tests for Timeline Worker
 * Validates timeline building and event generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Scene } from '../../schemas/director-json.js';
import type { SceneAlignment } from './align.js';
import type { SceneCues } from './cues.js';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => null),
}));

describe('buildTimeline', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should create dialogue events', async () => {
    const { buildTimeline } = await import('./timeline.js');

    const scene: Scene = {
      scene_id: 'scene_001',
      dialogue: [
        { line_id: 'line_001', character: 'John', text: 'Hello', voice_key: 'v1' },
        { line_id: 'line_002', character: 'Jane', text: 'Hi', voice_key: 'v2' },
      ],
    };

    const alignment: SceneAlignment = {
      lines: [
        { line_id: 'line_001', character: 'John', text: 'Hello', start: 0, end: 1.5, duration: 1.5 },
        { line_id: 'line_002', character: 'Jane', text: 'Hi', start: 2, end: 2.8, duration: 0.8 },
      ],
    };

    const cues: SceneCues = {};

    const timeline = await buildTimeline(scene, alignment, cues);

    // Should have dialogue_in and dialogue_out for each line
    const dialogueInEvents = timeline.events?.filter((e) => e.type === 'dialogue_in') || [];
    const dialogueOutEvents = timeline.events?.filter((e) => e.type === 'dialogue_out') || [];

    expect(dialogueInEvents).toHaveLength(2);
    expect(dialogueOutEvents).toHaveLength(2);
  });

  it('should create music events', async () => {
    const { buildTimeline } = await import('./timeline.js');

    const scene: Scene = {
      scene_id: 'scene_002',
      dialogue: [{ line_id: 'line_001', character: 'John', text: 'Hello', voice_key: 'v1' }],
    };

    const alignment: SceneAlignment = {
      lines: [{ line_id: 'line_001', character: 'John', text: 'Hello', start: 0, end: 2, duration: 2 }],
    };

    const cues: SceneCues = {
      music: [
        { file: 'music/epic.mp3', start_at: 0, volume: -20, fade_out: 2 },
      ],
    };

    const timeline = await buildTimeline(scene, alignment, cues);

    const musicInEvents = timeline.events?.filter((e) => e.type === 'music_in') || [];
    const musicOutEvents = timeline.events?.filter((e) => e.type === 'music_out') || [];

    expect(musicInEvents).toHaveLength(1);
    expect(musicOutEvents).toHaveLength(1);
  });

  it('should create ambience events', async () => {
    const { buildTimeline } = await import('./timeline.js');

    const scene: Scene = {
      scene_id: 'scene_003',
      dialogue: [{ line_id: 'line_001', character: 'John', text: 'Hello', voice_key: 'v1' }],
    };

    const alignment: SceneAlignment = {
      lines: [{ line_id: 'line_001', character: 'John', text: 'Hello', start: 0, end: 2, duration: 2 }],
    };

    const cues: SceneCues = {
      ambience: [{ file: 'ambience/forest.mp3', volume: -24 }],
    };

    const timeline = await buildTimeline(scene, alignment, cues);

    const ambienceInEvents = timeline.events?.filter((e) => e.type === 'ambience_in') || [];
    const ambienceOutEvents = timeline.events?.filter((e) => e.type === 'ambience_out') || [];

    expect(ambienceInEvents).toHaveLength(1);
    expect(ambienceOutEvents).toHaveLength(1);
  });

  it('should create SFX events with line_id timing', async () => {
    const { buildTimeline } = await import('./timeline.js');

    const scene: Scene = {
      scene_id: 'scene_004',
      dialogue: [
        { line_id: 'line_001', character: 'John', text: 'Bang!', voice_key: 'v1' },
      ],
      sfx: [
        { file: 'sfx/gunshot.mp3', start_at: 'line_001', duration: 2 },
      ],
    };

    const alignment: SceneAlignment = {
      lines: [{ line_id: 'line_001', character: 'John', text: 'Bang!', start: 5, end: 6, duration: 1 }],
    };

    const cues: SceneCues = {};

    const timeline = await buildTimeline(scene, alignment, cues);

    const sfxEvents = timeline.events?.filter((e) => e.type === 'sfx_at') || [];

    expect(sfxEvents).toHaveLength(1);
    expect(sfxEvents[0].at).toBe(5); // Should be at line start time
  });

  it('should sort events by time', async () => {
    const { buildTimeline } = await import('./timeline.js');

    const scene: Scene = {
      scene_id: 'scene_005',
      dialogue: [
        { line_id: 'line_001', character: 'John', text: 'First', voice_key: 'v1' },
        { line_id: 'line_002', character: 'Jane', text: 'Second', voice_key: 'v2' },
      ],
    };

    const alignment: SceneAlignment = {
      lines: [
        { line_id: 'line_001', character: 'John', text: 'First', start: 0, end: 2, duration: 2 },
        { line_id: 'line_002', character: 'Jane', text: 'Second', start: 3, end: 5, duration: 2 },
      ],
    };

    const cues: SceneCues = {};

    const timeline = await buildTimeline(scene, alignment, cues);

    // Verify events are sorted by 'at' time
    const events = timeline.events || [];
    for (let i = 0; i < events.length - 1; i++) {
      expect(events[i].at).toBeLessThanOrEqual(events[i + 1].at);
    }
  });

  it('should include scene_id in timeline', async () => {
    const { buildTimeline } = await import('./timeline.js');

    const scene: Scene = {
      scene_id: 'unique_scene_id',
      dialogue: [],
    };

    const alignment: SceneAlignment = { lines: [] };
    const cues: SceneCues = {};

    const timeline = await buildTimeline(scene, alignment, cues);

    expect(timeline.scene_id).toBe('unique_scene_id');
  });

  it('should handle scene with no events', async () => {
    const { buildTimeline } = await import('./timeline.js');

    const scene: Scene = {
      scene_id: 'scene_empty',
      dialogue: [],
    };

    const alignment: SceneAlignment = { lines: [] };
    const cues: SceneCues = {};

    const timeline = await buildTimeline(scene, alignment, cues);

    expect(timeline.scene_id).toBe('scene_empty');
    expect(timeline.events).toHaveLength(0);
  });

  it('should handle SFX with numeric start_at', async () => {
    const { buildTimeline } = await import('./timeline.js');

    const scene: Scene = {
      scene_id: 'scene_006',
      dialogue: [],
      sfx: [
        { file: 'sfx/explosion.mp3', start_at: 10.5, duration: 3 },
      ],
    };

    const alignment: SceneAlignment = { lines: [] };
    const cues: SceneCues = {};

    const timeline = await buildTimeline(scene, alignment, cues);

    const sfxEvents = timeline.events?.filter((e) => e.type === 'sfx_at') || [];

    expect(sfxEvents).toHaveLength(1);
    expect(sfxEvents[0].at).toBe(10.5);
  });
});

describe('Timeline Event Types', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should include correct properties for dialogue events', async () => {
    const { buildTimeline } = await import('./timeline.js');

    const scene: Scene = {
      scene_id: 'scene_007',
      dialogue: [{ line_id: 'line_001', character: 'John', text: 'Test', voice_key: 'v1' }],
    };

    const alignment: SceneAlignment = {
      lines: [{ line_id: 'line_001', character: 'John', text: 'Test', start: 0, end: 1, duration: 1 }],
    };

    const timeline = await buildTimeline(scene, alignment, {});

    const dialogueIn = timeline.events?.find((e) => e.type === 'dialogue_in');

    expect(dialogueIn).toHaveProperty('line_id');
    expect(dialogueIn).toHaveProperty('at');
  });

  it('should include gain_db for audio events', async () => {
    const { buildTimeline } = await import('./timeline.js');

    const scene: Scene = {
      scene_id: 'scene_008',
      dialogue: [{ line_id: 'line_001', character: 'John', text: 'Test', voice_key: 'v1' }],
    };

    const alignment: SceneAlignment = {
      lines: [{ line_id: 'line_001', character: 'John', text: 'Test', start: 0, end: 2, duration: 2 }],
    };

    const cues: SceneCues = {
      music: [{ file: 'music/test.mp3', volume: -22 }],
    };

    const timeline = await buildTimeline(scene, alignment, cues);

    const musicIn = timeline.events?.find((e) => e.type === 'music_in');

    expect(musicIn).toHaveProperty('gain_db');
  });
});
