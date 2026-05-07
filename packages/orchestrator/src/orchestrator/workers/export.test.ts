/**
 * Tests for Export Worker — makePlaybackManifest
 *
 * Verifies that missing episode files throw instead of returning null public_url,
 * and that UUID validation blocks path traversal attempts.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    copyFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  },
}));

vi.mock('ffmpeg-static', () => ({ default: '/usr/local/bin/ffmpeg' }));

vi.mock('../../lib/env.js', () => ({
  getOutputDir: vi.fn(() => '/data/output'),
}));

vi.mock('../../lib/logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/audio.js', () => ({
  audioDurationSec: vi.fn(() => Promise.resolve(10.0)),
}));

vi.mock('execa', () => ({
  execa: vi.fn(() => Promise.resolve({ stdout: '', stderr: '' })),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import fs from 'fs';
import { makePlaybackManifest } from './export.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const SCENE_INPUTS = [
  { scene_id: 'scene-1', path: '/data/output/scene-1.m4a' },
  { scene_id: 'scene-2', path: '/data/output/scene-2.m4a' },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('makePlaybackManifest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fs.existsSync as Mock).mockReturnValue(true);
  });

  it('returns manifest with public_url when episode file exists', async () => {
    const manifest = await makePlaybackManifest(VALID_UUID, SCENE_INPUTS, 1.5);

    expect(manifest.public_url).toBe(`/audio/${VALID_UUID}/episode.m4a`);
    expect(manifest.project_id).toBe(VALID_UUID);
    expect(manifest.order).toHaveLength(2);
    expect(manifest.total).toBeGreaterThan(0);
  });

  it('throws when episode file does not exist after concatenation', async () => {
    (fs.existsSync as Mock).mockReturnValue(false);

    await expect(makePlaybackManifest(VALID_UUID, SCENE_INPUTS, 1.5)).rejects.toThrow(
      'Episode file not found after concatenation'
    );
  });

  it('throws for invalid (non-UUID) project_id', async () => {
    await expect(
      makePlaybackManifest('not-a-uuid', SCENE_INPUTS, 1.5)
    ).rejects.toThrow('Invalid project_id format');
  });

  it('throws for path traversal attempt in project_id', async () => {
    await expect(
      makePlaybackManifest('../../etc/passwd', SCENE_INPUTS, 1.5)
    ).rejects.toThrow('Invalid project_id format');
  });

  it('computes correct scene offsets accounting for crossfade overlap', async () => {
    const manifest = await makePlaybackManifest(VALID_UUID, SCENE_INPUTS, 1.5);

    // scene-1 at offset 0; scene-2 at offset (10 - 1.5) = 8.5
    expect(manifest.order[0].offset).toBe(0);
    expect(manifest.order[1].offset).toBeCloseTo(8.5, 5);
  });

  it('returns mp3_url as null (MP3 conversion skipped in main path)', async () => {
    const manifest = await makePlaybackManifest(VALID_UUID, SCENE_INPUTS, 1.5);
    expect(manifest.mp3_url).toBeNull();
  });
});
