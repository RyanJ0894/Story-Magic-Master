/**
 * Tests for Align Worker
 * Validates dialogue alignment and gap computation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Scene } from '../../schemas/director-json.js';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => null),
}));

// Mock audio utilities
vi.mock('../../lib/audio.js', () => ({
  audioDurationSec: vi.fn((path: string) => {
    // Extract duration from mock stems based on path
    if (path.includes('line_001')) return Promise.resolve(1.5);
    if (path.includes('line_002')) return Promise.resolve(0.8);
    return Promise.resolve(1.0);
  }),
}));

// Mock whisper align (disable it for basic tests)
vi.mock('./whisper-align.js', () => ({
  whisperAlign: vi.fn(() => Promise.resolve([])),
  mapWordsToText: vi.fn(),
}));

describe('alignScene', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('should compute alignment from stems', async () => {
    const { audioDurationSec } = await import('../../lib/audio.js');
    vi.mocked(audioDurationSec).mockImplementation((path: string) => {
      if (path.includes('line_001')) return Promise.resolve(1.5);
      if (path.includes('line_002')) return Promise.resolve(0.8);
      return Promise.resolve(1.0);
    });

    const { alignScene } = await import('./align.js');

    const scene: Scene = {
      scene_id: 'scene_001',
      dialogue: [
        { line_id: 'line_001', character: 'John', text: 'Hello there.', voice_key: 'voice_john' },
        { line_id: 'line_002', character: 'Jane', text: 'Hi!', voice_key: 'voice_jane' },
      ],
    };

    // Stems must have line_id to match dialogue
    const stems = [
      { line_id: 'line_001', path: '/stems/line_001.wav' },
      { line_id: 'line_002', path: '/stems/line_002.wav' },
    ];

    const alignment = await alignScene('proj_001', scene, stems);

    expect(alignment.lines).toHaveLength(2);
    expect(alignment.lines[0].line_id).toBe('line_001');
    expect(alignment.lines[1].line_id).toBe('line_002');
  });

  it('should add gaps between lines', async () => {
    const { audioDurationSec } = await import('../../lib/audio.js');
    vi.mocked(audioDurationSec).mockResolvedValue(1.0);

    const { alignScene } = await import('./align.js');

    const scene: Scene = {
      scene_id: 'scene_002',
      dialogue: [
        { line_id: 'line_001', character: 'John', text: 'Question?', voice_key: 'voice_john' },
        { line_id: 'line_002', character: 'Jane', text: 'Answer.', voice_key: 'voice_jane' },
      ],
    };

    const stems = [
      { line_id: 'line_001', path: '/stems/line_001.wav' },
      { line_id: 'line_002', path: '/stems/line_002.wav' },
    ];

    const alignment = await alignScene('proj_001', scene, stems);

    // Second line should start after first + gap
    expect(alignment.lines[1].start).toBeGreaterThan(alignment.lines[0].end);
  });

  it('should handle single line scene', async () => {
    const { audioDurationSec } = await import('../../lib/audio.js');
    vi.mocked(audioDurationSec).mockResolvedValue(3.0);

    const { alignScene } = await import('./align.js');

    const scene: Scene = {
      scene_id: 'scene_003',
      dialogue: [
        { line_id: 'line_001', character: 'Narrator', text: 'Once upon a time...', voice_key: 'voice_narrator' },
      ],
    };

    const stems = [{ line_id: 'line_001', path: '/stems/line_001.wav' }];

    const alignment = await alignScene('proj_001', scene, stems);

    expect(alignment.lines).toHaveLength(1);
    expect(alignment.lines[0].start).toBe(0);
    expect(alignment.lines[0].end).toBe(3.0);
  });

  it('should handle empty scene', async () => {
    const { alignScene } = await import('./align.js');

    const scene: Scene = {
      scene_id: 'scene_004',
      dialogue: [],
    };

    const alignment = await alignScene('proj_001', scene, []);

    expect(alignment.lines).toHaveLength(0);
  });

  it('should preserve line metadata', async () => {
    const { audioDurationSec } = await import('../../lib/audio.js');
    vi.mocked(audioDurationSec).mockResolvedValue(2.0);

    const { alignScene } = await import('./align.js');

    const scene: Scene = {
      scene_id: 'scene_005',
      dialogue: [
        {
          line_id: 'line_001',
          character: 'John',
          text: 'Test line',
          voice_key: 'voice_john',
        },
      ],
    };

    const stems = [{ line_id: 'line_001', path: '/stems/line_001.wav' }];

    const alignment = await alignScene('proj_001', scene, stems);

    expect(alignment.lines[0].line_id).toBe('line_001');
  });
});

describe('computeGap', () => {
  it('should add longer gap for strong punctuation', async () => {
    const { computeGap } = await import('./align.js');

    const gapPeriod = computeGap(
      { text: 'End of sentence.' },
      { text: 'Next line', character: 'Jane' },
      0.5
    );

    const gapComma = computeGap(
      { text: 'Partial, pause' },
      { text: 'Next line', character: 'Jane' },
      0.5
    );

    expect(gapPeriod).toBeGreaterThan(gapComma);
  });

  it('should add gap for character change', async () => {
    const { computeGap } = await import('./align.js');

    const gapSameChar = computeGap(
      { text: 'Line one', character: 'John' },
      { text: 'Line two', character: 'John' },
      0.5
    );

    const gapDiffChar = computeGap(
      { text: 'Line one', character: 'John' },
      { text: 'Line two', character: 'Jane' },
      0.5
    );

    expect(gapDiffChar).toBeGreaterThan(gapSameChar);
  });

  it('should scale gap with intensity', async () => {
    const { computeGap } = await import('./align.js');

    const gapLowIntensity = computeGap(
      { text: 'Line one.' },
      { text: 'Line two', character: 'Jane' },
      0.2 // Low intensity = slower pacing
    );

    const gapHighIntensity = computeGap(
      { text: 'Line one.' },
      { text: 'Line two', character: 'Jane' },
      0.9 // High intensity = faster pacing
    );

    expect(gapLowIntensity).toBeGreaterThan(gapHighIntensity);
  });

  it('should return positive gap for all inputs', async () => {
    const { computeGap } = await import('./align.js');

    const gap = computeGap(
      { text: '', character: '' },
      { text: '', character: '' },
      0.5
    );

    expect(gap).toBeGreaterThanOrEqual(0);
  });
});

describe('SceneAlignment type', () => {
  it('should have correct structure', async () => {
    const { audioDurationSec } = await import('../../lib/audio.js');
    vi.mocked(audioDurationSec).mockResolvedValue(1.0);

    const { alignScene } = await import('./align.js');

    const scene: Scene = {
      scene_id: 'scene_006',
      dialogue: [
        { line_id: 'line_001', character: 'Test', text: 'Hello', voice_key: 'v1' },
      ],
    };

    const stems = [{ line_id: 'line_001', path: '/stems/line_001.wav' }];
    const alignment = await alignScene('proj_001', scene, stems);

    // Verify structure
    expect(alignment).toHaveProperty('lines');
    expect(alignment.lines[0]).toHaveProperty('line_id');
    expect(alignment.lines[0]).toHaveProperty('start');
    expect(alignment.lines[0]).toHaveProperty('end');
  });
});
