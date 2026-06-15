/**
 * Tests for buildLineTimingMap — the helper that converts the orchestrator's
 * per-scene whisper alignments into an absolute-time map keyed by line_id
 * for the Listen UI player. Closes #207.
 *
 * What we're locking in:
 *   1. Single-scene case: alignment offsets become absolute times verbatim
 *      (since sceneOffset starts at 0).
 *   2. Multi-scene case: each subsequent scene's offset adds the prior
 *      scene's max-end MINUS the 1.5s crossfade — matching the orchestrator's
 *      makePlaybackManifest math.
 *   3. The LAST scene doesn't subtract a crossfade (no downstream join).
 *   4. Missing alignment for a scene degrades gracefully (skipped, downstream
 *      scenes still align based on what data IS present).
 *   5. Lines without `line_id` in the stored alignment are skipped — never
 *      silently mapped to a different id.
 *   6. Empty scene list returns empty map without DB query.
 */

import { describe, it, expect, vi } from 'vitest';
import { buildLineTimingMap, LISTEN_CROSSFADE_SECONDS } from '@/lib/listen/alignment-mapper';

type Prisma = Parameters<typeof buildLineTimingMap>[0];

function makePrisma(rows: Array<{ sceneId: string; alignmentJson: unknown }>) {
  const findMany = vi.fn().mockResolvedValue(rows);
  return {
    prisma: { alignment: { findMany } } as unknown as Prisma,
    findMany,
  };
}

describe('buildLineTimingMap — #207', () => {
  it('returns empty map and skips the DB call when sceneOrder is empty', async () => {
    const { prisma, findMany } = makePrisma([]);
    const result = await buildLineTimingMap(prisma, 'p1', []);
    expect(result.size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('maps a single scene 1-to-1 (sceneOffset starts at 0)', async () => {
    const { prisma } = makePrisma([
      {
        sceneId: 'scene_001',
        alignmentJson: {
          scene_id: 'scene_001',
          lines: [
            { line_id: 'line_001', start: 0, end: 3.5 },
            { line_id: 'line_002', start: 3.7, end: 5.2 },
          ],
        },
      },
    ]);

    const result = await buildLineTimingMap(prisma, 'p1', ['scene_001']);

    expect(result.get('line_001')).toEqual({ start: 0, end: 3.5 });
    expect(result.get('line_002')).toEqual({ start: 3.7, end: 5.2 });
  });

  it('adds prior scene end minus 1.5s crossfade when advancing across scenes', async () => {
    // Scene 1: 0–10s local, max_end = 10
    // Scene 2: starts at sceneOffset = 10 - 1.5 = 8.5 (overlap during crossfade)
    //         Lines 0–4s local become absolute 8.5–12.5
    const { prisma } = makePrisma([
      {
        sceneId: 'scene_001',
        alignmentJson: { lines: [{ line_id: 'a', start: 0, end: 10 }] },
      },
      {
        sceneId: 'scene_002',
        alignmentJson: { lines: [{ line_id: 'b', start: 0, end: 4 }] },
      },
    ]);

    const result = await buildLineTimingMap(prisma, 'p1', ['scene_001', 'scene_002']);

    expect(result.get('a')).toEqual({ start: 0, end: 10 });
    expect(result.get('b')).toEqual({ start: 8.5, end: 12.5 });
  });

  it('accumulates correctly across 3+ scenes (crossfade compounds)', async () => {
    // Scene 1 max_end 5 → offset advances to 5 - 1.5 = 3.5
    // Scene 2 max_end 4 → offset advances to 3.5 + 4 - 1.5 = 6
    // Scene 3 max_end 2 → no further advance (last scene)
    const { prisma } = makePrisma([
      { sceneId: 's1', alignmentJson: { lines: [{ line_id: 'l1', start: 0, end: 5 }] } },
      { sceneId: 's2', alignmentJson: { lines: [{ line_id: 'l2', start: 0, end: 4 }] } },
      { sceneId: 's3', alignmentJson: { lines: [{ line_id: 'l3', start: 0, end: 2 }] } },
    ]);

    const result = await buildLineTimingMap(prisma, 'p1', ['s1', 's2', 's3']);

    expect(result.get('l1')).toEqual({ start: 0, end: 5 });
    expect(result.get('l2')).toEqual({ start: 3.5, end: 7.5 });
    expect(result.get('l3')).toEqual({ start: 6, end: 8 });
  });

  it('honours a custom crossfade duration override', async () => {
    const { prisma } = makePrisma([
      { sceneId: 's1', alignmentJson: { lines: [{ line_id: 'a', start: 0, end: 10 }] } },
      { sceneId: 's2', alignmentJson: { lines: [{ line_id: 'b', start: 0, end: 4 }] } },
    ]);

    const result = await buildLineTimingMap(prisma, 'p1', ['s1', 's2'], 2);

    expect(result.get('b')).toEqual({ start: 8, end: 12 });
  });

  it('skips scenes with no alignment row but continues mapping the rest', async () => {
    // Scene 2 has no alignment — downstream scene 3 starts late as a result.
    // We accept that drift; the player will char-estimate scene 2's lines.
    const { prisma } = makePrisma([
      { sceneId: 's1', alignmentJson: { lines: [{ line_id: 'l1', start: 0, end: 10 }] } },
      // s2 missing entirely
      { sceneId: 's3', alignmentJson: { lines: [{ line_id: 'l3', start: 0, end: 5 }] } },
    ]);

    const result = await buildLineTimingMap(prisma, 'p1', ['s1', 's2', 's3']);

    expect(result.get('l1')).toEqual({ start: 0, end: 10 });
    expect(result.has('l2')).toBe(false);
    // s3 advances from s1's offset (8.5) because s2 was skipped — known
    // drift of ~scene_2 duration, but degrades gracefully not catastrophically.
    expect(result.get('l3')).toEqual({ start: 8.5, end: 13.5 });
  });

  it('skips alignment lines that are missing line_id (never silently mis-maps)', async () => {
    const { prisma } = makePrisma([
      {
        sceneId: 's1',
        alignmentJson: {
          lines: [
            { line_id: 'good', start: 0, end: 3 },
            { start: 3, end: 5 }, // missing line_id
            { line_id: '', start: 5, end: 7 }, // empty line_id
            { line_id: 'also_good', start: 7, end: 9 },
          ],
        },
      },
    ]);

    const result = await buildLineTimingMap(prisma, 'p1', ['s1']);

    expect(result.get('good')).toEqual({ start: 0, end: 3 });
    expect(result.get('also_good')).toEqual({ start: 7, end: 9 });
    expect(result.size).toBe(2);
  });

  it('skips alignment lines with non-numeric start or end', async () => {
    const { prisma } = makePrisma([
      {
        sceneId: 's1',
        alignmentJson: {
          lines: [
            { line_id: 'a', start: 0, end: 3 },
            { line_id: 'b', start: '3' as unknown as number, end: 5 }, // malformed
            { line_id: 'c', start: 5, end: null as unknown as number }, // malformed
          ],
        },
      },
    ]);

    const result = await buildLineTimingMap(prisma, 'p1', ['s1']);

    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(false);
    expect(result.has('c')).toBe(false);
  });

  it('uses the LISTEN_CROSSFADE_SECONDS export by default — matches orchestrator', async () => {
    // This pins the default to the same 1.5s the orchestrator uses in
    // makePlaybackManifest. If someone changes one, the test forces them
    // to change the other.
    expect(LISTEN_CROSSFADE_SECONDS).toBe(1.5);
  });

  it('handles a 47-line scene (production-shape sanity check)', async () => {
    // Smoke against a realistic scene size from today's prod test job
    // (project a47ac2cd-…, scene_001, 47 lines).
    const lines = Array.from({ length: 47 }, (_, i) => ({
      line_id: `line_${String(i + 1).padStart(3, '0')}`,
      start: i * 3,
      end: i * 3 + 2.5,
    }));
    const { prisma } = makePrisma([
      { sceneId: 'scene_001', alignmentJson: { scene_id: 'scene_001', lines } },
    ]);

    const result = await buildLineTimingMap(prisma, 'p1', ['scene_001']);

    expect(result.size).toBe(47);
    expect(result.get('line_001')).toEqual({ start: 0, end: 2.5 });
    expect(result.get('line_047')).toEqual({ start: 138, end: 140.5 });
  });
});
