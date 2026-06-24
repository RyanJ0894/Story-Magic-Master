/**
 * Tests for director-scene-cache.
 *
 * The cache is the "skip the ~330 s director step on the cross-project
 * re-upload path" feature. These tests pin down its three load-bearing
 * behaviors:
 *
 *  1. `hashScenes` deterministically splits + hashes; the same text + model
 *     always produces the same hashes, and a model change always changes them.
 *  2. `lookupCachedDirectorJson` is ALL-OR-NOTHING — a partial miss must
 *     return null so the pipeline runs DirectorAgent normally. Splicing
 *     cached + live scenes is explicitly NOT a feature.
 *  3. `persistDirectorJson` only writes when input/output scene counts match.
 *     A drift between our splitter and the agent's parse must NOT poison the
 *     cache with mis-aligned rows.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindMany, mockUpdateMany, mockCreateMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockUpdateMany: vi.fn().mockResolvedValue({ count: 0 }),
  mockCreateMany: vi.fn().mockResolvedValue({ count: 0 }),
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    directorSceneCache: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      createMany: (...args: unknown[]) => mockCreateMany(...args),
    },
  },
}));

vi.mock('../lib/logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  hashScenes,
  lookupCachedDirectorJson,
  persistDirectorJson,
} from './director-scene-cache.js';

const TWO_SCENE_SCRIPT = [
  'INT. KITCHEN - DAY',
  '',
  'A coffee pot whistles. ANNA enters.',
  '',
  '          ANNA',
  '     Morning.',
  '',
  'EXT. STREET - NIGHT',
  '',
  'Rain pours. BEN walks under a streetlamp.',
  '',
  '          BEN',
  '     I need a coffee.',
].join('\n');

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  mockFindMany.mockReset();
  mockUpdateMany.mockReset().mockResolvedValue({ count: 0 });
  mockCreateMany.mockReset().mockResolvedValue({ count: 0 });
});

describe('hashScenes', () => {
  it('splits a multi-scene script and produces one hash per scene', () => {
    const hashes = hashScenes(TWO_SCENE_SCRIPT, 'anthropic/claude-sonnet-4-6');
    expect(hashes).toHaveLength(2);
    expect(hashes[0].text).toContain('INT. KITCHEN');
    expect(hashes[1].text).toContain('EXT. STREET');
    expect(hashes[0].hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashes[1].hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashes[0].hash).not.toBe(hashes[1].hash);
  });

  it('produces stable hashes — same input twice yields identical output', () => {
    const a = hashScenes(TWO_SCENE_SCRIPT, 'sonnet');
    const b = hashScenes(TWO_SCENE_SCRIPT, 'sonnet');
    expect(a.map((s) => s.hash)).toEqual(b.map((s) => s.hash));
  });

  it('changes every hash when the model identifier changes', () => {
    // The whole point of including model in the hash: a model bump
    // naturally orphans old entries without a separate version column.
    const sonnet = hashScenes(TWO_SCENE_SCRIPT, 'sonnet');
    const haiku = hashScenes(TWO_SCENE_SCRIPT, 'haiku');
    expect(sonnet[0].hash).not.toBe(haiku[0].hash);
    expect(sonnet[1].hash).not.toBe(haiku[1].hash);
  });

  it('falls back to a single block for prose / no scene headings', () => {
    const prose = 'Just a paragraph with no slug lines at all.';
    const hashes = hashScenes(prose, 'sonnet');
    expect(hashes).toHaveLength(1);
    expect(hashes[0].text).toBe(prose);
  });

  it('returns an empty array on empty input (no rows to upsert)', () => {
    expect(hashScenes('', 'sonnet')).toEqual([]);
    expect(hashScenes('    \n\n  ', 'sonnet')).toEqual([]);
  });
});

describe('lookupCachedDirectorJson — all-or-nothing semantics', () => {
  it('returns null on a partial miss (no splicing)', async () => {
    // 2 scenes in script, only 1 cached: must return null so caller runs
    // DirectorAgent normally. If we ever returned 1 cached + 1 missing as
    // a "partial" result, the pipeline would silently produce a hybrid
    // parse with no source of truth for the gap.
    mockFindMany.mockResolvedValue([
      { contentHash: 'whatever', sceneJson: { scene_id: '001', dialogue: [] } },
    ]);
    const result = await lookupCachedDirectorJson(PROJECT_ID, TWO_SCENE_SCRIPT, 'sonnet');
    expect(result).toBeNull();
    // No hit-metadata bump on a miss — only paid for on full hits.
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('returns an assembled DirectorJSON when every scene is cached', async () => {
    const hashes = hashScenes(TWO_SCENE_SCRIPT, 'sonnet');
    mockFindMany.mockResolvedValue([
      { contentHash: hashes[0].hash, sceneJson: { scene_id: '001', dialogue: [{ character: 'ANNA', text: 'Morning.', voice_key: 'v1' }] } },
      { contentHash: hashes[1].hash, sceneJson: { scene_id: '002', dialogue: [{ character: 'BEN', text: 'I need a coffee.', voice_key: 'v2' }] } },
    ]);

    const result = await lookupCachedDirectorJson(PROJECT_ID, TWO_SCENE_SCRIPT, 'sonnet');

    expect(result).not.toBeNull();
    expect(result!.project_id).toBe(PROJECT_ID);
    expect(result!.scenes).toHaveLength(2);
    // Scenes assembled in script order regardless of DB result order.
    expect(result!.scenes[0].scene_id).toBe('001');
    expect(result!.scenes[1].scene_id).toBe('002');
  });

  it('preserves script order even if findMany returns rows in arbitrary order', async () => {
    // Postgres returns rows in undefined order without ORDER BY. Caller
    // must reassemble by hash — pin that behavior here.
    const hashes = hashScenes(TWO_SCENE_SCRIPT, 'sonnet');
    mockFindMany.mockResolvedValue([
      { contentHash: hashes[1].hash, sceneJson: { scene_id: 'second', dialogue: [] } },
      { contentHash: hashes[0].hash, sceneJson: { scene_id: 'first', dialogue: [] } },
    ]);
    const result = await lookupCachedDirectorJson(PROJECT_ID, TWO_SCENE_SCRIPT, 'sonnet');
    expect(result!.scenes.map((s) => s.scene_id)).toEqual(['first', 'second']);
  });

  it('returns null on DB error (cache is best-effort, never blocks)', async () => {
    mockFindMany.mockRejectedValue(new Error('boom'));
    const result = await lookupCachedDirectorJson(PROJECT_ID, TWO_SCENE_SCRIPT, 'sonnet');
    expect(result).toBeNull();
  });
});

describe('persistDirectorJson — drift protection', () => {
  it('persists scenes when input/output counts match', async () => {
    const directorJson = {
      project_id: PROJECT_ID,
      scenes: [
        { scene_id: '001', dialogue: [] },
        { scene_id: '002', dialogue: [] },
      ],
    } as never;
    await persistDirectorJson(TWO_SCENE_SCRIPT, 'sonnet', directorJson);
    expect(mockCreateMany).toHaveBeenCalledTimes(1);
    const arg = mockCreateMany.mock.calls[0][0];
    expect(arg.skipDuplicates).toBe(true);
    expect(arg.data).toHaveLength(2);
    expect(arg.data[0].model).toBe('sonnet');
    expect(arg.data[0].contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses to persist when output scene count differs from input', async () => {
    // If the agent collapsed two scenes into one, we have no way to map
    // them back to input hashes safely. Skip the write rather than risk
    // associating the wrong sceneJson with a hash.
    const directorJson = {
      project_id: PROJECT_ID,
      scenes: [{ scene_id: '001', dialogue: [] }],
    } as never;
    await persistDirectorJson(TWO_SCENE_SCRIPT, 'sonnet', directorJson);
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it('swallows persist errors so a cache write failure cannot fail a job', async () => {
    mockCreateMany.mockRejectedValue(new Error('db down'));
    const directorJson = {
      project_id: PROJECT_ID,
      scenes: [
        { scene_id: '001', dialogue: [] },
        { scene_id: '002', dialogue: [] },
      ],
    } as never;
    await expect(
      persistDirectorJson(TWO_SCENE_SCRIPT, 'sonnet', directorJson),
    ).resolves.toBeUndefined();
  });
});
