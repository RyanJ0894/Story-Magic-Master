import { describe, it, expect } from 'vitest';
import {
  chunkScenes,
  segmentProgressLabel,
  SCENES_PER_CHUNK,
  FIRST_CHUNK_SCENES,
} from '@/lib/generation/chunk-script';

const mkScenes = (n: number) => Array.from({ length: n }, (_, i) => ({ scene_id: `s${i}` }));

describe('chunkScenes — small-first-chunk for fast time-to-first-audio', () => {
  it('returns one empty chunk for empty scenes array', () => {
    const chunks = chunkScenes([]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].scenes).toHaveLength(0);
    expect(chunks[0].index).toBe(0);
  });

  it('returns one chunk when scenes ≤ FIRST_CHUNK_SCENES (too short to bother splitting)', () => {
    const scenes = mkScenes(FIRST_CHUNK_SCENES);
    const chunks = chunkScenes(scenes);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].scenes).toHaveLength(FIRST_CHUNK_SCENES);
    expect(chunks[0].startScene).toBe(0);
    expect(chunks[0].endScene).toBe(FIRST_CHUNK_SCENES - 1);
  });

  it('first chunk holds exactly FIRST_CHUNK_SCENES (2) when script is longer', () => {
    const scenes = mkScenes(15);
    const chunks = chunkScenes(scenes);
    expect(chunks[0].scenes).toHaveLength(FIRST_CHUNK_SCENES);
    expect(chunks[0].startScene).toBe(0);
    expect(chunks[0].endScene).toBe(FIRST_CHUNK_SCENES - 1);
  });

  it('subsequent chunks hold SCENES_PER_CHUNK (7) each', () => {
    // 15 scenes → [2, 7, 6]
    const scenes = mkScenes(15);
    const chunks = chunkScenes(scenes);
    expect(chunks).toHaveLength(3);
    expect(chunks[0].scenes).toHaveLength(2);
    expect(chunks[1].scenes).toHaveLength(7);
    expect(chunks[2].scenes).toHaveLength(6);
  });

  it('30-scene script chunks to [2, 7, 7, 7, 7] — first audio at ~7%', () => {
    const chunks = chunkScenes(mkScenes(30));
    expect(chunks.map((c) => c.scenes.length)).toEqual([2, 7, 7, 7, 7]);
  });

  it('10-scene script chunks to [2, 7, 1] — first audio at ~20%', () => {
    const chunks = chunkScenes(mkScenes(10));
    expect(chunks.map((c) => c.scenes.length)).toEqual([2, 7, 1]);
  });

  it('5-scene script (short) chunks to [2, 3]', () => {
    const chunks = chunkScenes(mkScenes(5));
    expect(chunks.map((c) => c.scenes.length)).toEqual([2, 3]);
  });

  it('startScene/endScene track the original scene index correctly', () => {
    const scenes = mkScenes(15);
    const chunks = chunkScenes(scenes);
    // [2, 7, 6]
    expect(chunks[0].startScene).toBe(0);
    expect(chunks[0].endScene).toBe(1);
    expect(chunks[1].startScene).toBe(2);
    expect(chunks[1].endScene).toBe(8);
    expect(chunks[2].startScene).toBe(9);
    expect(chunks[2].endScene).toBe(14);
  });

  it('preserves all scenes across all chunks (no scene lost or duplicated)', () => {
    const scenes = mkScenes(42);
    const chunks = chunkScenes(scenes);
    const flat = chunks.flatMap((c) => c.scenes);
    expect(flat).toHaveLength(42);
    expect(flat).toEqual(scenes);
  });

  it('chunk indices are 0, 1, 2 … in order', () => {
    const chunks = chunkScenes(mkScenes(50));
    chunks.forEach((c, i) => expect(c.index).toBe(i));
  });
});

describe('segmentProgressLabel', () => {
  it('returns generic label for single-segment jobs', () => {
    const chunks = chunkScenes(mkScenes(FIRST_CHUNK_SCENES));
    expect(segmentProgressLabel(chunks[0], 1)).toBe('Generating audio…');
  });

  it('returns scene range label for multi-segment jobs', () => {
    // 10-scene script → [2, 7, 1]; chunk 1 starts at scene 3 (1-indexed)
    const chunks = chunkScenes(mkScenes(10));
    const label = segmentProgressLabel(chunks[1], chunks.length);
    expect(label).toContain('scenes 3');
    expect(label).not.toMatch(/\bchunk\b/i);
    expect(label).not.toMatch(/segment \d+ of \d+/i);
  });

  it('never uses "chunk" or "segment N of N" language', () => {
    const chunks = chunkScenes(mkScenes(50));
    for (const chunk of chunks) {
      const label = segmentProgressLabel(chunk, chunks.length);
      expect(label).not.toMatch(/\bchunk\b/i);
      expect(label).not.toMatch(/segment \d+ of \d+/i);
    }
  });
});
