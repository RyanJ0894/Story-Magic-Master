/**
 * B-003b unit tests — confirm the per-user mix-gain offsets actually move
 * the gain_db values on emitted timeline events.
 *
 * Light-weight integration with the real buildTimeline rather than mocking
 * — the function is pure aside from a saveTimeline DB write which we mock.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/prisma.js', () => ({
  prisma: { $executeRaw: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../lib/logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { buildTimeline } from './timeline.js';
import type { Scene } from '../../schemas/director-json.js';
import type { SceneAlignment } from './align.js';
import type { SceneCues } from './cues.js';

const PROJECT_ID = '00000000-0000-0000-0000-000000000001';

const scene: Scene = {
  scene_id: 'scene_001',
  intensity: 0.5,
  dialogue: [
    { line_id: 'line_001', character: 'Narrator', voice_key: 'v_n', text: 'Interior.' },
  ],
  // SFX is sourced from scene.sfx (NOT cueChoices.sfx) per timeline.ts:130.
  sfx: [{ file: 's.mp3', volume: -22, start_at: 1 }],
} as unknown as Scene;

const alignment: SceneAlignment = {
  scene_id: 'scene_001',
  lines: [{ line_id: 'line_001', start: 0, end: 4 }],
};

const cues: SceneCues = {
  music: [{ file: 'm.mp3', volume: -22 }],
  ambience: [{ file: 'a.mp3', volume: -25 }],
} as unknown as SceneCues;

const findGainDb = (events: Array<{ type: string; gain_db?: number }>, type: string) =>
  events.find((e) => e.type === type)?.gain_db;

describe('buildTimeline — B-003b gain offsets', () => {
  it('with NO offsets, emits the raw cue volumes (back-compat)', async () => {
    const timeline = await buildTimeline(scene, alignment, cues, PROJECT_ID);
    expect(findGainDb(timeline.events, 'music_in')).toBe(-22);
    expect(findGainDb(timeline.events, 'ambience_in')).toBe(-25);
    expect(findGainDb(timeline.events, 'sfx_at')).toBe(-22);
  });

  it('adds musicGainOffsetDb to every music_in event', async () => {
    const timeline = await buildTimeline(scene, alignment, cues, PROJECT_ID, {
      musicGainOffsetDb: 3,
    });
    expect(findGainDb(timeline.events, 'music_in')).toBe(-19); // -22 + 3
  });

  it('adds ambienceGainOffsetDb to every ambience_in event', async () => {
    const timeline = await buildTimeline(scene, alignment, cues, PROJECT_ID, {
      ambienceGainOffsetDb: 5,
    });
    expect(findGainDb(timeline.events, 'ambience_in')).toBe(-20); // -25 + 5
  });

  it('adds sfxGainOffsetDb to every sfx_at event', async () => {
    const timeline = await buildTimeline(scene, alignment, cues, PROJECT_ID, {
      sfxGainOffsetDb: -2,
    });
    expect(findGainDb(timeline.events, 'sfx_at')).toBe(-24); // -22 + (-2)
  });

  it('applies all three offsets independently in one call', async () => {
    const timeline = await buildTimeline(scene, alignment, cues, PROJECT_ID, {
      musicGainOffsetDb: 2,
      ambienceGainOffsetDb: 3,
      sfxGainOffsetDb: -1,
    });
    expect(findGainDb(timeline.events, 'music_in')).toBe(-20);
    expect(findGainDb(timeline.events, 'ambience_in')).toBe(-22);
    expect(findGainDb(timeline.events, 'sfx_at')).toBe(-23);
  });

  it('treats undefined offsets as 0 (does not mutate)', async () => {
    const timeline = await buildTimeline(scene, alignment, cues, PROJECT_ID, {
      musicGainOffsetDb: undefined,
    });
    expect(findGainDb(timeline.events, 'music_in')).toBe(-22); // same as no-offsets case
  });
});
