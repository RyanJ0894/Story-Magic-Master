/**
 * Tests for TTS Workers
 * Validates single-scene TTS generation (tts.ts) and parallel multi-scene TTS (parallel-tts.ts)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Scene, DirectorJSON } from '../../schemas/director-json.js';

// ---------------------------------------------------------------------------
// Mocks - must be declared before any import that triggers module load
// ---------------------------------------------------------------------------

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => null),
}));

vi.mock('../../lib/db.js', () => ({
  getVoiceForCharacter: vi.fn(),
  upsertVoiceMap: vi.fn(),
}));

vi.mock('../../lib/storage.js', () => ({
  readStemByKey: vi.fn(),
  writeStem: vi.fn(),
}));

vi.mock('../../lib/audio.js', () => ({
  ttsGenerate: vi.fn(),
}));

vi.mock('../../lib/idempotency.js', () => ({
  ttsKey: vi.fn(
    (project_id: string, scene_id: string, line_id: string) =>
      `${project_id}_${scene_id}_${line_id}_vhash_thash`
  ),
  hash: vi.fn((s: string) => `hash_${s.substring(0, 8)}`),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    scene_id: 'scene_001',
    dialogue: [
      {
        line_id: 'line_001',
        character: 'John',
        text: 'Hello there, how are you doing today?',
        voice_key: 'voice_john_123',
      },
      {
        line_id: 'line_002',
        character: 'Jane',
        text: 'I am doing just fine, thank you.',
        voice_key: 'voice_jane_456',
      },
    ],
    ...overrides,
  };
}

function makeDirectorJSON(overrides: Partial<DirectorJSON> = {}): DirectorJSON {
  return {
    project_id: 'b1c2d3e4-f5a6-7890-abcd-ef1234567890',
    scenes: [
      makeScene({ scene_id: 'scene_001' }),
      makeScene({
        scene_id: 'scene_002',
        dialogue: [
          {
            line_id: 'line_003',
            character: 'Narrator',
            text: 'The sun was setting over the hills.',
            voice_key: 'voice_narrator_789',
          },
        ],
      }),
    ],
    ...overrides,
  };
}

const FAKE_WAV = Buffer.from('fake-wav-data');

// ---------------------------------------------------------------------------
// ttsForScene (single-scene TTS)
// ---------------------------------------------------------------------------

describe('ttsForScene', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Default mock implementations
    const { readStemByKey, writeStem } = await import('../../lib/storage.js');
    const { ttsGenerate } = await import('../../lib/audio.js');
    const { getVoiceForCharacter, upsertVoiceMap } = await import('../../lib/db.js');

    vi.mocked(readStemByKey).mockResolvedValue(null);
    vi.mocked(writeStem).mockImplementation(
      async (project_id, scene_id, line_id, _wav, _key) =>
        `/data/stems/${project_id}_${scene_id}_${line_id}.wav`
    );
    vi.mocked(ttsGenerate).mockResolvedValue(FAKE_WAV);
    vi.mocked(getVoiceForCharacter).mockResolvedValue(null);
    vi.mocked(upsertVoiceMap).mockResolvedValue({
      project_id: 'proj_001',
      character: 'Unknown',
      voice_id: '21m00Tcm4TlvDq8ikWAM',
      provider: 'elevenlabs',
      params_json: { stability: 0.4, similarity_boost: 0.7 },
    });
  });

  it('should generate TTS stems for all dialogue lines with correct paths', async () => {
    const { ttsForScene } = await import('./tts.js');
    const scene = makeScene();

    const results = await ttsForScene('proj_001', scene);

    expect(results).toHaveLength(2);
    expect(results[0].line_id).toBe('line_001');
    expect(results[0].path).toContain('proj_001');
    expect(results[0].path).toContain('line_001');
    expect(results[1].line_id).toBe('line_002');
    expect(results[1].path).toContain('line_002');
  });

  it('should use voice_key from dialogue line when present', async () => {
    const { ttsForScene } = await import('./tts.js');
    const { ttsGenerate } = await import('../../lib/audio.js');
    const { getVoiceForCharacter } = await import('../../lib/db.js');

    const scene = makeScene({
      dialogue: [
        {
          line_id: 'line_001',
          character: 'John',
          text: 'Hello there.',
          voice_key: 'custom_voice_id_abc',
        },
      ],
    });

    await ttsForScene('proj_001', scene);

    // Should NOT call getVoiceForCharacter when voice_key is present
    expect(getVoiceForCharacter).not.toHaveBeenCalled();

    // ttsGenerate should be called with the voice_key as voice_id
    expect(ttsGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        voice: expect.objectContaining({
          voice_id: 'custom_voice_id_abc',
        }),
        text: 'Hello there.',
      })
    );
  });

  it('should handle empty dialogue gracefully', async () => {
    const { ttsForScene } = await import('./tts.js');
    const { ttsGenerate } = await import('../../lib/audio.js');

    const scene = makeScene({ dialogue: [] });

    const results = await ttsForScene('proj_001', scene);

    expect(results).toHaveLength(0);
    expect(ttsGenerate).not.toHaveBeenCalled();
  });

  it('should return cached stem path when cache hit exists', async () => {
    const { ttsForScene } = await import('./tts.js');
    const { readStemByKey } = await import('../../lib/storage.js');
    const { ttsGenerate } = await import('../../lib/audio.js');

    vi.mocked(readStemByKey).mockResolvedValue({
      path: '/data/stems/cached_stem.wav',
    });

    const scene = makeScene({
      dialogue: [
        {
          line_id: 'line_001',
          character: 'John',
          text: 'Hello.',
          voice_key: 'voice_john',
        },
      ],
    });

    const results = await ttsForScene('proj_001', scene);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe('/data/stems/cached_stem.wav');
    expect(results[0].line_id).toBe('line_001');

    // ttsGenerate should NOT be called when cache exists
    expect(ttsGenerate).not.toHaveBeenCalled();
  });

  it('should fall back to upsertVoiceMap when no voice_key and no DB entry', async () => {
    const { ttsForScene } = await import('./tts.js');
    const { getVoiceForCharacter, upsertVoiceMap } = await import('../../lib/db.js');

    vi.mocked(getVoiceForCharacter).mockResolvedValue(null);
    vi.mocked(upsertVoiceMap).mockResolvedValue({
      project_id: 'proj_001',
      character: 'Bob',
      voice_id: 'fallback_voice_id',
      provider: 'elevenlabs',
      params_json: { stability: 0.4 },
    });

    const scene = makeScene({
      dialogue: [
        {
          line_id: 'line_001',
          character: 'Bob',
          text: 'Fallback test.',
          voice_key: '', // empty voice_key triggers DB lookup
        },
      ],
    });

    await ttsForScene('proj_001', scene);

    expect(getVoiceForCharacter).toHaveBeenCalledWith('proj_001', 'Bob');
    expect(upsertVoiceMap).toHaveBeenCalledWith('proj_001', 'Bob');
  });

  it('should call writeStem with the generated WAV buffer', async () => {
    const { ttsForScene } = await import('./tts.js');
    const { writeStem, readStemByKey } = await import('../../lib/storage.js');
    const { ttsGenerate } = await import('../../lib/audio.js');

    const generatedWav = Buffer.from('generated-audio-bytes');
    vi.mocked(ttsGenerate).mockResolvedValue(generatedWav);
    vi.mocked(readStemByKey).mockResolvedValue(null);

    const scene = makeScene({
      dialogue: [
        {
          line_id: 'line_001',
          character: 'Alice',
          text: 'Test line.',
          voice_key: 'voice_alice',
        },
      ],
    });

    await ttsForScene('proj_001', scene);

    expect(writeStem).toHaveBeenCalledWith(
      'proj_001',
      'scene_001',
      'line_001',
      generatedWav,
      expect.any(String) // the cache key
    );
  });

  it('should propagate errors when ttsGenerate fails', async () => {
    const { ttsForScene } = await import('./tts.js');
    const { ttsGenerate } = await import('../../lib/audio.js');

    vi.mocked(ttsGenerate).mockRejectedValue(
      new Error('ElevenLabs TTS failed 500: Internal Server Error')
    );

    const scene = makeScene({
      dialogue: [
        {
          line_id: 'line_001',
          character: 'John',
          text: 'This will fail.',
          voice_key: 'voice_john',
        },
      ],
    });

    await expect(ttsForScene('proj_001', scene)).rejects.toThrow(
      'ElevenLabs TTS failed 500'
    );
  });
});

// ---------------------------------------------------------------------------
// parallelTTSGenerate (multi-scene parallel TTS)
// ---------------------------------------------------------------------------

describe('parallelTTSGenerate', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Default mock implementations
    const { readStemByKey, writeStem } = await import('../../lib/storage.js');
    const { ttsGenerate } = await import('../../lib/audio.js');
    const { getVoiceForCharacter, upsertVoiceMap } = await import('../../lib/db.js');

    vi.mocked(readStemByKey).mockResolvedValue(null);
    vi.mocked(writeStem).mockImplementation(
      async (project_id, scene_id, line_id, _wav, _key) =>
        `/data/stems/${project_id}_${scene_id}_${line_id}.wav`
    );
    vi.mocked(ttsGenerate).mockResolvedValue(FAKE_WAV);
    vi.mocked(getVoiceForCharacter).mockResolvedValue(null);
    vi.mocked(upsertVoiceMap).mockResolvedValue({
      project_id: 'proj_001',
      character: 'Default',
      voice_id: '21m00Tcm4TlvDq8ikWAM',
      provider: 'elevenlabs',
      params_json: {},
    });
  });

  it('should process all scenes and return stems organized by scene', async () => {
    const { parallelTTSGenerate } = await import('./parallel-tts.js');
    const director = makeDirectorJSON();

    const result = await parallelTTSGenerate(director, undefined, 4);

    // 2 scenes: scene_001 with 2 lines, scene_002 with 1 line
    expect(result.total_lines).toBe(3);
    expect(result.generated_lines).toBe(3);
    expect(result.cached_lines).toBe(0);
    expect(Object.keys(result.stems_by_scene)).toHaveLength(2);
    expect(result.stems_by_scene['scene_001']).toHaveLength(2);
    expect(result.stems_by_scene['scene_002']).toHaveLength(1);
  });

  it('should process multiple scenes concurrently', async () => {
    const { parallelTTSGenerate } = await import('./parallel-tts.js');
    const { ttsGenerate } = await import('../../lib/audio.js');

    // Track call order to verify concurrency
    const callOrder: string[] = [];
    vi.mocked(ttsGenerate).mockImplementation(async (opts) => {
      callOrder.push(opts.text);
      // Simulate varying processing times
      await new Promise((r) => setTimeout(r, 10));
      return FAKE_WAV;
    });

    const director = makeDirectorJSON();
    const result = await parallelTTSGenerate(director, undefined, 12);

    // All 3 lines should have been processed
    expect(callOrder).toHaveLength(3);
    expect(result.total_lines).toBe(3);
    expect(result.generated_lines).toBe(3);
  });

  it('should report progress via callback', async () => {
    const { parallelTTSGenerate } = await import('./parallel-tts.js');

    const progressUpdates: Array<{ percent: number; completed_lines: number }> = [];
    const onProgress = vi.fn((progress) => {
      progressUpdates.push({
        percent: progress.percent,
        completed_lines: progress.completed_lines,
      });
    });

    const director = makeDirectorJSON();
    await parallelTTSGenerate(director, onProgress, 1);

    // onProgress should have been called at least once for each line + final
    expect(onProgress).toHaveBeenCalled();

    // Last progress callback should be 100%
    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
    expect(lastCall.percent).toBe(100);
    expect(lastCall.total_lines).toBe(3);
    expect(lastCall.completed_lines).toBe(3);
    expect(lastCall.total_scenes).toBe(2);
  });

  it('should count cached lines separately from generated lines', async () => {
    const { parallelTTSGenerate } = await import('./parallel-tts.js');
    const { readStemByKey } = await import('../../lib/storage.js');
    const { ttsGenerate } = await import('../../lib/audio.js');

    // Make first line cached, rest generated
    let callCount = 0;
    vi.mocked(readStemByKey).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { path: '/data/stems/cached_line_001.wav' };
      }
      return null;
    });

    const director = makeDirectorJSON();
    const result = await parallelTTSGenerate(director, undefined, 4);

    expect(result.total_lines).toBe(3);
    expect(result.cached_lines).toBe(1);
    expect(result.generated_lines).toBe(2);

    // ttsGenerate should only be called for non-cached lines
    expect(ttsGenerate).toHaveBeenCalledTimes(2);
  });

  it('should handle director JSON with no scenes gracefully', async () => {
    const { parallelTTSGenerate } = await import('./parallel-tts.js');

    const director = makeDirectorJSON({ scenes: [] });
    const result = await parallelTTSGenerate(director);

    expect(result.total_lines).toBe(0);
    expect(result.cached_lines).toBe(0);
    expect(result.generated_lines).toBe(0);
    expect(Object.keys(result.stems_by_scene)).toHaveLength(0);
  });

  it('should propagate errors when TTS fails for a line', async () => {
    const { parallelTTSGenerate } = await import('./parallel-tts.js');
    const { ttsGenerate } = await import('../../lib/audio.js');

    vi.mocked(ttsGenerate).mockRejectedValue(
      new Error('ElevenLabs TTS failed 429: Rate limit exceeded')
    );

    const director = makeDirectorJSON();

    await expect(parallelTTSGenerate(director, undefined, 4)).rejects.toThrow(
      'ElevenLabs TTS failed 429'
    );
  });

  it('should sort stems by line_id within each scene', async () => {
    const { parallelTTSGenerate } = await import('./parallel-tts.js');

    // Create scene with out-of-order line IDs to test sorting
    const director = makeDirectorJSON({
      scenes: [
        {
          scene_id: 'scene_001',
          dialogue: [
            { line_id: 'line_003', character: 'A', text: 'Third.', voice_key: 'v1' },
            { line_id: 'line_001', character: 'B', text: 'First.', voice_key: 'v2' },
            { line_id: 'line_002', character: 'C', text: 'Second.', voice_key: 'v3' },
          ],
        },
      ],
    });

    const result = await parallelTTSGenerate(director, undefined, 4);

    const stems = result.stems_by_scene['scene_001'];
    expect(stems).toHaveLength(3);
    // Should be sorted by numeric part of line_id
    expect(stems[0].line_id).toBe('line_001');
    expect(stems[1].line_id).toBe('line_002');
    expect(stems[2].line_id).toBe('line_003');
  });
});

// ---------------------------------------------------------------------------
// Helper utilities: getStemsForScene, isSceneComplete
// ---------------------------------------------------------------------------

describe('getStemsForScene', () => {
  it('should return stems for a specific scene', async () => {
    const { getStemsForScene } = await import('./parallel-tts.js');

    const result = {
      stems_by_scene: {
        scene_001: [
          { scene_id: 'scene_001', line_id: 'line_001', path: '/stems/a.wav' },
          { scene_id: 'scene_001', line_id: 'line_002', path: '/stems/b.wav' },
        ],
        scene_002: [
          { scene_id: 'scene_002', line_id: 'line_003', path: '/stems/c.wav' },
        ],
      },
      total_lines: 3,
      cached_lines: 0,
      generated_lines: 3,
    };

    const stems = getStemsForScene(result, 'scene_001');
    expect(stems).toHaveLength(2);
    expect(stems[0].line_id).toBe('line_001');
  });

  it('should return empty array for unknown scene', async () => {
    const { getStemsForScene } = await import('./parallel-tts.js');

    const result = {
      stems_by_scene: {},
      total_lines: 0,
      cached_lines: 0,
      generated_lines: 0,
    };

    const stems = getStemsForScene(result, 'nonexistent_scene');
    expect(stems).toHaveLength(0);
  });
});

describe('isSceneComplete', () => {
  it('should return true when all dialogue lines have stems', async () => {
    const { isSceneComplete } = await import('./parallel-tts.js');

    const scene = makeScene({
      dialogue: [
        { line_id: 'line_001', character: 'A', text: 'Hi.', voice_key: 'v1' },
        { line_id: 'line_002', character: 'B', text: 'Bye.', voice_key: 'v2' },
      ],
    });

    const result = {
      stems_by_scene: {
        scene_001: [
          { scene_id: 'scene_001', line_id: 'line_001', path: '/a.wav' },
          { scene_id: 'scene_001', line_id: 'line_002', path: '/b.wav' },
        ],
      },
      total_lines: 2,
      cached_lines: 0,
      generated_lines: 2,
    };

    expect(isSceneComplete(result, scene)).toBe(true);
  });

  it('should return false when stems are missing', async () => {
    const { isSceneComplete } = await import('./parallel-tts.js');

    const scene = makeScene({
      dialogue: [
        { line_id: 'line_001', character: 'A', text: 'Hi.', voice_key: 'v1' },
        { line_id: 'line_002', character: 'B', text: 'Bye.', voice_key: 'v2' },
      ],
    });

    const result = {
      stems_by_scene: {
        scene_001: [
          { scene_id: 'scene_001', line_id: 'line_001', path: '/a.wav' },
          // line_002 missing
        ],
      },
      total_lines: 2,
      cached_lines: 0,
      generated_lines: 1,
    };

    expect(isSceneComplete(result, scene)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyEmotionTag (emotion override text transformation)
// ---------------------------------------------------------------------------

describe('applyEmotionTag', () => {
  it('prepends ElevenLabs audio tag for WHISPERED emotion', async () => {
    const { applyEmotionTag } = await import('./parallel-tts.js');
    expect(applyEmotionTag('Hello.', 'WHISPERED')).toBe('[whispers] Hello.');
  });

  it('prepends audio tag for NERVOUS emotion', async () => {
    const { applyEmotionTag } = await import('./parallel-tts.js');
    expect(applyEmotionTag('Not sure.', 'NERVOUS')).toBe('[nervously] Not sure.');
  });

  it('returns unchanged text for unknown emotion', async () => {
    const { applyEmotionTag } = await import('./parallel-tts.js');
    expect(applyEmotionTag('Hello.', 'NEUTRAL')).toBe('Hello.');
  });

  it('returns unchanged text for empty emotion', async () => {
    const { applyEmotionTag } = await import('./parallel-tts.js');
    expect(applyEmotionTag('Hello.', '')).toBe('Hello.');
  });
});

// ---------------------------------------------------------------------------
// parallelTTSGenerate with emotion overrides
// ---------------------------------------------------------------------------

describe('parallelTTSGenerate with emotionOverrides', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { readStemByKey, writeStem } = await import('../../lib/storage.js');
    const { ttsGenerate } = await import('../../lib/audio.js');
    const { getVoiceForCharacter, upsertVoiceMap } = await import('../../lib/db.js');

    vi.mocked(readStemByKey).mockResolvedValue(null);
    vi.mocked(writeStem).mockImplementation(
      async (project_id: string, scene_id: string, line_id: string) =>
        `/data/stems/${project_id}_${scene_id}_${line_id}.wav`
    );
    vi.mocked(ttsGenerate).mockResolvedValue(Buffer.from('fake-wav'));
    vi.mocked(getVoiceForCharacter).mockResolvedValue(null);
    vi.mocked(upsertVoiceMap).mockResolvedValue({
      project_id: 'proj_001',
      character: 'Unknown',
      voice_id: '21m00Tcm4TlvDq8ikWAM',
      provider: 'elevenlabs',
      params_json: {},
    });
  });

  it('applies emotion tag to TTS text when override provided', async () => {
    const { parallelTTSGenerate } = await import('./parallel-tts.js');
    const { ttsGenerate } = await import('../../lib/audio.js');

    const director = makeDirectorJSON({
      scenes: [makeScene({
        scene_id: 'scene_001',
        dialogue: [
          { line_id: 'line_001', character: 'John', text: 'I know nothing.', voice_key: 'v1' },
        ],
      })],
    });

    await parallelTTSGenerate(director, undefined, 1, { line_001: 'WHISPERED' });

    expect(vi.mocked(ttsGenerate)).toHaveBeenCalledWith(
      expect.objectContaining({ text: '[whispers] I know nothing.' }),
    );
  });

  it('leaves text unchanged for lines without an override', async () => {
    const { parallelTTSGenerate } = await import('./parallel-tts.js');
    const { ttsGenerate } = await import('../../lib/audio.js');

    const director = makeDirectorJSON({
      scenes: [makeScene({
        scene_id: 'scene_001',
        dialogue: [
          { line_id: 'line_001', character: 'John', text: 'Normal speech.', voice_key: 'v1' },
        ],
      })],
    });

    await parallelTTSGenerate(director, undefined, 1, {});

    expect(vi.mocked(ttsGenerate)).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Normal speech.' }),
    );
  });
});
