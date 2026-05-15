import { describe, it, expect } from 'vitest';
import { chunkScenes, segmentProgressLabel, SCENES_PER_CHUNK } from '@/lib/generation/chunk-script';

describe('chunkScenes', () => {
  it('returns one chunk for empty scenes array', () => {
    const chunks = chunkScenes([]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].scenes).toHaveLength(0);
    expect(chunks[0].index).toBe(0);
  });

  it('returns one chunk when scenes fit within SCENES_PER_CHUNK', () => {
    const scenes = Array.from({ length: SCENES_PER_CHUNK }, (_, i) => ({ scene_id: `s${i}` }));
    const chunks = chunkScenes(scenes);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].scenes).toHaveLength(SCENES_PER_CHUNK);
    expect(chunks[0].startScene).toBe(0);
    expect(chunks[0].endScene).toBe(SCENES_PER_CHUNK - 1);
  });

  it('splits into two chunks when scenes exceed SCENES_PER_CHUNK', () => {
    const scenes = Array.from({ length: SCENES_PER_CHUNK + 5 }, (_, i) => ({ scene_id: `s${i}` }));
    const chunks = chunkScenes(scenes);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].scenes).toHaveLength(SCENES_PER_CHUNK);
    expect(chunks[1].scenes).toHaveLength(5);
    expect(chunks[0].index).toBe(0);
    expect(chunks[1].index).toBe(1);
  });

  it('assigns correct startScene/endScene for multi-chunk scripts', () => {
    const scenes = Array.from({ length: 30 }, (_, i) => ({ scene_id: `s${i}` }));
    const chunks = chunkScenes(scenes);
    expect(chunks[0].startScene).toBe(0);
    expect(chunks[0].endScene).toBe(SCENES_PER_CHUNK - 1);
    expect(chunks[1].startScene).toBe(SCENES_PER_CHUNK);
    expect(chunks[1].endScene).toBe(29);
  });

  it('preserves all scenes across all chunks', () => {
    const scenes = Array.from({ length: 42 }, (_, i) => ({ scene_id: `s${i}` }));
    const chunks = chunkScenes(scenes);
    const allScenes = chunks.flatMap((c) => c.scenes);
    expect(allScenes).toHaveLength(42);
    expect(allScenes).toEqual(scenes);
  });
});

describe('segmentProgressLabel', () => {
  it('returns generic label for single-segment jobs', () => {
    const chunks = chunkScenes(Array.from({ length: 5 }, (_, i) => ({ scene_id: `s${i}` })));
    expect(segmentProgressLabel(chunks[0], 1)).toBe('Generating audio…');
  });

  it('returns scene range label for multi-segment jobs', () => {
    const scenes = Array.from({ length: SCENES_PER_CHUNK + 3 }, (_, i) => ({ scene_id: `s${i}` }));
    const chunks = chunkScenes(scenes);
    const label = segmentProgressLabel(chunks[1], chunks.length);
    expect(label).toContain(`scenes ${SCENES_PER_CHUNK + 1}`);
    expect(label).not.toMatch(/\bchunk\b/i);
    expect(label).not.toMatch(/segment \d+ of \d+/i);
  });

  it('never uses "chunk" or "segment N of N" language', () => {
    const scenes = Array.from({ length: 50 }, (_, i) => ({ scene_id: `s${i}` }));
    const chunks = chunkScenes(scenes);
    for (const chunk of chunks) {
      const label = segmentProgressLabel(chunk, chunks.length);
      expect(label).not.toMatch(/\bchunk\b/i);
      expect(label).not.toMatch(/segment \d+ of \d+/i);
    }
  });
});
