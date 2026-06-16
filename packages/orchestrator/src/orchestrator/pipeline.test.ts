/**
 * Tests for Orchestrator Pipeline
 * Validates both sequential (orchestrate) and parallel (orchestrateParallel) pipelines
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ─── Mock dotenv/config (must come before pipeline import) ───
vi.mock('dotenv/config', () => ({}));

// ─── Mock execa (FFmpeg calls) ───
vi.mock('execa', () => ({
  execa: vi.fn(() => Promise.resolve({ stdout: '', stderr: '' })),
}));

// ─── Mock ffmpeg-static ───
vi.mock('ffmpeg-static', () => ({
  default: '/usr/bin/ffmpeg-mock',
}));

// ─── Mock fs ───
vi.mock('fs', () => ({
  default: {
    mkdirSync: vi.fn(),
    existsSync: vi.fn(() => false),
    writeFileSync: vi.fn(),
    copyFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    readFileSync: vi.fn(() => '{}'),
  },
}));

// ─── Mock Supabase ───
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => null),
}));

// ─── Mock TTS worker ───
vi.mock('./workers/tts.js', () => ({
  ttsForScene: vi.fn((_projectId: string, scene: { dialogue: Array<{ line_id: string }> }) =>
    Promise.resolve(
      scene.dialogue.map((d: { line_id: string }) => ({
        line_id: d.line_id,
        path: `/mock/stems/${d.line_id}.wav`,
      }))
    )
  ),
}));

// ─── Mock parallel TTS worker ───
vi.mock('./workers/parallel-tts.js', () => ({
  parallelTTSGenerate: vi.fn(
    (
      director: {
        scenes: Array<{ scene_id: string; dialogue: Array<{ line_id: string }> }>;
      },
      onProgress?: (p: unknown) => void,
    ) => {
      const stemsByScene: Record<string, Array<{ scene_id: string; line_id: string; path: string }>> = {};
      let totalLines = 0;
      for (const scene of director.scenes) {
        stemsByScene[scene.scene_id] = scene.dialogue.map(
          (d: { line_id: string }) => ({
            scene_id: scene.scene_id,
            line_id: d.line_id,
            path: `/mock/stems/${scene.scene_id}/${d.line_id}.wav`,
          })
        );
        totalLines += scene.dialogue.length;
      }
      if (onProgress) {
        onProgress({
          total_lines: totalLines,
          completed_lines: totalLines,
          current_scene: director.scenes[director.scenes.length - 1]?.scene_id || '',
          scenes_complete: director.scenes.length,
          total_scenes: director.scenes.length,
          percent: 100,
        });
      }
      return Promise.resolve({
        stems_by_scene: stemsByScene,
        total_lines: totalLines,
        cached_lines: 0,
        generated_lines: totalLines,
      });
    }
  ),
}));

// ─── Mock progressive-stitch worker ───
vi.mock('./workers/progressive-stitch.js', () => ({
  progressiveStitch: vi.fn(
    (
      director: {
        scenes: Array<{ scene_id: string; dialogue: Array<{ line_id: string }> }>;
      },
      _stemsByScene: unknown,
      projectDir: string,
      _sceneConcurrency?: number,
      onProgress?: (p: unknown) => void,
    ) => {
      const scenes = director.scenes.map(
        (s: { scene_id: string; dialogue: Array<{ line_id: string }> }, idx: number) => ({
          scene_id: s.scene_id,
          scene_index: idx,
          path: `${projectDir}/scene-${s.scene_id}.m4a`,
          timeline: {
            scene_id: s.scene_id,
            events: [
              { type: 'dialogue_in', line_id: s.dialogue[0]?.line_id || 'line_001', at: 0 },
            ],
          },
          alignment: {
            lines: s.dialogue.map((d: { line_id: string }, i: number) => ({
              line_id: d.line_id,
              start: i * 2.0,
              end: i * 2.0 + 1.5,
            })),
          },
          cues: { music: [], ambience: [], sfx: [] },
          duration_ms: s.dialogue.length * 2000,
        })
      );
      if (onProgress) {
        onProgress({
          phase: 'mixing',
          scenes_aligned: director.scenes.length,
          scenes_mixed: director.scenes.length,
          total_scenes: director.scenes.length,
          current_scene: director.scenes[director.scenes.length - 1]?.scene_id || '',
          percent: 100,
        });
      }
      return Promise.resolve({
        scenes,
        total_duration_ms: scenes.reduce(
          (sum: number, s: { duration_ms: number }) => sum + s.duration_ms,
          0
        ),
      });
    }
  ),
  finalConcatenation: vi.fn(() => Promise.resolve()),
}));

// ─── Mock align worker ───
vi.mock('./workers/align.js', () => ({
  alignScene: vi.fn(
    (
      _projectId: string,
      scene: { dialogue: Array<{ line_id: string }> },
      stems: Array<{ line_id: string }>,
    ) =>
      Promise.resolve({
        lines: stems.map((s: { line_id: string }, i: number) => ({
          line_id: s.line_id,
          start: i * 2.0,
          end: i * 2.0 + 1.5,
        })),
      })
  ),
}));

// ─── Mock cues worker ───
vi.mock('./workers/cues.js', () => ({
  pickCues: vi.fn(() =>
    Promise.resolve({
      music: [],
      ambience: [],
      sfx: [],
    })
  ),
}));

// ─── Mock timeline worker ───
vi.mock('./workers/timeline.js', () => ({
  buildTimeline: vi.fn(
    (scene: { scene_id: string }) =>
      Promise.resolve({
        scene_id: scene.scene_id,
        events: [{ type: 'dialogue_in', line_id: 'line_001', at: 0 }],
      })
  ),
}));

// ─── Mock mixer worker ───
vi.mock('./workers/mixer.js', () => ({
  mixScene: vi.fn(() => Promise.resolve()),
}));

// ─── Mock export worker ───
vi.mock('./workers/export.js', () => ({
  concatScenesWithCrossfade: vi.fn(() => Promise.resolve()),
  makePlaybackManifest: vi.fn(
    (projectId: string, scenes: Array<{ scene_id: string }>) =>
      Promise.resolve({
        project_id: projectId,
        order: scenes.map((s: { scene_id: string }, i: number) => ({
          scene_id: s.scene_id,
          offset: i * 30,
          duration: 30,
        })),
        total: scenes.length * 30,
        public_url: `https://storage.example.com/${projectId}/episode.m4a`,
      })
  ),
}));

// ─── Mock catalog-loader ───
vi.mock('../lib/catalog-loader.js', () => ({
  loadCatalog: vi.fn(() => ({
    music: [],
    ambience: [],
    sfx: [],
  })),
  getTrackPath: vi.fn(() => null),
}));

// ─── Helpers ───

function makeValidDirectorJSON(overrides: Record<string, unknown> = {}) {
  return {
    project_id: '00000000-0000-0000-0000-000000000001',
    scenes: [
      {
        scene_id: 'scene_001',
        dialogue: [
          {
            line_id: 'line_001',
            character: 'Narrator',
            text: 'It was a dark and stormy night.',
            voice_key: 'voice_narrator',
          },
          {
            line_id: 'line_002',
            character: 'John',
            text: 'Who goes there?',
            voice_key: 'voice_john',
          },
        ],
      },
    ],
    ...overrides,
  };
}

function makeMultiSceneDirectorJSON() {
  return {
    project_id: '00000000-0000-0000-0000-000000000002',
    scenes: [
      {
        scene_id: 'scene_001',
        dialogue: [
          {
            line_id: 'line_001',
            character: 'Alice',
            text: 'The adventure begins.',
            voice_key: 'voice_alice',
          },
        ],
      },
      {
        scene_id: 'scene_002',
        dialogue: [
          {
            line_id: 'line_001',
            character: 'Bob',
            text: 'Where are we going?',
            voice_key: 'voice_bob',
          },
          {
            line_id: 'line_002',
            character: 'Alice',
            text: 'To the mountain top.',
            voice_key: 'voice_alice',
          },
        ],
      },
      {
        scene_id: 'scene_003',
        dialogue: [
          {
            line_id: 'line_001',
            character: 'Narrator',
            text: 'And so it ended.',
            voice_key: 'voice_narrator',
          },
        ],
      },
    ],
  };
}

// ─── Tests ───

describe('orchestrate (sequential pipeline)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('should validate DirectorJSON schema and accept valid input', async () => {
    const { orchestrate } = await import('./pipeline.js');
    const input = makeValidDirectorJSON();

    const result = await orchestrate(input);

    expect(result).toBeDefined();
    expect(result.project_id).toBe('00000000-0000-0000-0000-000000000001');
  });

  it('should reject invalid DirectorJSON missing project_id', async () => {
    const { orchestrate } = await import('./pipeline.js');
    const input = { scenes: [] };

    await expect(orchestrate(input)).rejects.toThrow('Invalid Director JSON');
  });

  it('should reject DirectorJSON with non-UUID project_id', async () => {
    const { orchestrate } = await import('./pipeline.js');
    const input = { project_id: 'not-a-uuid', scenes: [] };

    await expect(orchestrate(input)).rejects.toThrow('Invalid Director JSON');
  });

  it('should generate TTS for each scene', async () => {
    const { orchestrate } = await import('./pipeline.js');
    const { ttsForScene } = await import('./workers/tts.js');
    const input = makeValidDirectorJSON();

    await orchestrate(input);

    expect(ttsForScene).toHaveBeenCalledTimes(1);
    expect(ttsForScene).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      expect.objectContaining({ scene_id: 'scene_001' }),
      expect.objectContaining({}), // B-003b options arg ({narrationSpeed?})
    );
  });

  it('should produce OrchestrationResult with correct structure', async () => {
    const { orchestrate } = await import('./pipeline.js');
    const input = makeValidDirectorJSON();

    const result = await orchestrate(input);

    // Verify all required fields
    expect(result).toHaveProperty('project_id');
    expect(result).toHaveProperty('output_dir');
    expect(result).toHaveProperty('episode_path');
    expect(result).toHaveProperty('manifest_path');
    expect(result).toHaveProperty('scenes');
    expect(result).toHaveProperty('audio_urls');
    expect(result).toHaveProperty('manifest');

    // Verify types
    expect(typeof result.project_id).toBe('string');
    expect(typeof result.output_dir).toBe('string');
    expect(typeof result.episode_path).toBe('string');
    expect(typeof result.manifest_path).toBe('string');
    expect(Array.isArray(result.scenes)).toBe(true);
    expect(Array.isArray(result.audio_urls)).toBe(true);
    expect(typeof result.manifest).toBe('object');
  });

  it('should handle single scene correctly', async () => {
    const { orchestrate } = await import('./pipeline.js');
    const { ttsForScene } = await import('./workers/tts.js');
    const { alignScene } = await import('./workers/align.js');
    const { pickCues } = await import('./workers/cues.js');
    const { buildTimeline } = await import('./workers/timeline.js');
    const { mixScene } = await import('./workers/mixer.js');

    const input = makeValidDirectorJSON({
      scenes: [
        {
          scene_id: 'solo_scene',
          dialogue: [
            {
              line_id: 'line_001',
              character: 'Narrator',
              text: 'A single scene story.',
              voice_key: 'voice_narrator',
            },
          ],
        },
      ],
    });

    const result = await orchestrate(input);

    expect(result.scenes).toHaveLength(1);
    expect(result.scenes[0].scene_id).toBe('solo_scene');
    expect(ttsForScene).toHaveBeenCalledTimes(1);
    expect(alignScene).toHaveBeenCalledTimes(1);
    expect(pickCues).toHaveBeenCalledTimes(1);
    expect(buildTimeline).toHaveBeenCalledTimes(1);
    expect(mixScene).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple scenes', async () => {
    const { orchestrate } = await import('./pipeline.js');
    const { ttsForScene } = await import('./workers/tts.js');
    const { concatScenesWithCrossfade } = await import('./workers/export.js');

    const input = makeMultiSceneDirectorJSON();
    const result = await orchestrate(input);

    expect(result.scenes).toHaveLength(3);
    expect(ttsForScene).toHaveBeenCalledTimes(3);
    expect(concatScenesWithCrossfade).toHaveBeenCalledTimes(1);

    // Verify scene order preserved
    expect(result.scenes[0].scene_id).toBe('scene_001');
    expect(result.scenes[1].scene_id).toBe('scene_002');
    expect(result.scenes[2].scene_id).toBe('scene_003');
  });

  it('should call workers in correct sequence per scene', async () => {
    const { orchestrate } = await import('./pipeline.js');
    const { ttsForScene } = await import('./workers/tts.js');
    const { alignScene } = await import('./workers/align.js');
    const { pickCues } = await import('./workers/cues.js');
    const { buildTimeline } = await import('./workers/timeline.js');
    const { mixScene } = await import('./workers/mixer.js');

    const callOrder: string[] = [];

    (ttsForScene as Mock).mockImplementation(async () => {
      callOrder.push('tts');
      return [{ line_id: 'line_001', path: '/mock/line_001.wav' }];
    });
    (alignScene as Mock).mockImplementation(async () => {
      callOrder.push('align');
      return { lines: [{ line_id: 'line_001', start: 0, end: 1.5 }] };
    });
    (pickCues as Mock).mockImplementation(async () => {
      callOrder.push('cues');
      return { music: [], ambience: [], sfx: [] };
    });
    (buildTimeline as Mock).mockImplementation(async () => {
      callOrder.push('timeline');
      return { scene_id: 'scene_001', events: [] };
    });
    (mixScene as Mock).mockImplementation(async () => {
      callOrder.push('mix');
    });

    const input = makeValidDirectorJSON({
      scenes: [
        {
          scene_id: 'scene_001',
          dialogue: [
            { line_id: 'line_001', character: 'A', text: 'Test.', voice_key: 'v1' },
          ],
        },
      ],
    });

    await orchestrate(input);

    expect(callOrder).toEqual(['tts', 'align', 'cues', 'timeline', 'mix']);
  });

  it('should create output directories', async () => {
    const { orchestrate } = await import('./pipeline.js');
    const fs = await import('fs');

    const input = makeValidDirectorJSON();
    await orchestrate(input);

    expect(fs.default.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('00000000-0000-0000-0000-000000000001'),
      { recursive: true }
    );
  });

  it('should write manifest file', async () => {
    const { orchestrate } = await import('./pipeline.js');
    const fs = await import('fs');

    const input = makeValidDirectorJSON();
    await orchestrate(input);

    expect(fs.default.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('manifest.json'),
      expect.any(String)
    );
  });

  it('should include manifest with public_url in audio_urls', async () => {
    const { orchestrate } = await import('./pipeline.js');

    const input = makeValidDirectorJSON();
    const result = await orchestrate(input);

    expect(result.audio_urls).toHaveLength(1);
    expect(result.audio_urls[0]).toContain('00000000-0000-0000-0000-000000000001');
  });

  it('should pass crossfade options to concatScenesWithCrossfade', async () => {
    const { orchestrate } = await import('./pipeline.js');
    const { concatScenesWithCrossfade } = await import('./workers/export.js');

    const input = makeMultiSceneDirectorJSON();
    await orchestrate(input);

    expect(concatScenesWithCrossfade).toHaveBeenCalledWith(
      expect.any(Array),
      expect.stringContaining('episode.m4a'),
      { fadeDuration: 1.5, fadeType: 'tri' }
    );
  });
});

describe('orchestrateParallel (parallel pipeline)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('should call parallelTTSGenerate instead of ttsForScene', async () => {
    const { orchestrateParallel } = await import('./pipeline.js');
    const { parallelTTSGenerate } = await import('./workers/parallel-tts.js');
    const { ttsForScene } = await import('./workers/tts.js');

    const input = makeValidDirectorJSON();
    await orchestrateParallel(input);

    expect(parallelTTSGenerate).toHaveBeenCalledTimes(1);
    expect(ttsForScene).not.toHaveBeenCalled();
  });

  it('should pass director data to parallelTTSGenerate', async () => {
    const { orchestrateParallel } = await import('./pipeline.js');
    const { parallelTTSGenerate } = await import('./workers/parallel-tts.js');

    const input = makeValidDirectorJSON();
    await orchestrateParallel(input);

    expect(parallelTTSGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: '00000000-0000-0000-0000-000000000001',
        scenes: expect.any(Array),
      }),
      expect.any(Function), // onProgress callback
      6, // default concurrency (from TTS_CONCURRENCY env or fallback)
      {}, // default empty emotion overrides
      expect.objectContaining({}), // B-003b options ({narrationSpeed?})
    );
  });

  it('should report progress via callback', async () => {
    const { orchestrateParallel } = await import('./pipeline.js');

    const progressUpdates: Array<{
      step: string;
      percent: number;
      message: string;
    }> = [];
    const onProgress = vi.fn((p: { step: string; percent: number; message: string }) => {
      progressUpdates.push({ step: p.step, percent: p.percent, message: p.message });
    });

    const input = makeValidDirectorJSON();
    await orchestrateParallel(input, onProgress);

    expect(onProgress).toHaveBeenCalled();

    // Extract the unique steps reported
    const steps = progressUpdates.map((p) => p.step);
    expect(steps).toContain('validating');
    expect(steps).toContain('tts');
    expect(steps).toContain('assembling');
    expect(steps).toContain('stitching');
    expect(steps).toContain('manifest');
    expect(steps).toContain('complete');
  });

  it('should receive all expected progress steps in order', async () => {
    const { orchestrateParallel } = await import('./pipeline.js');

    const stepsSeen: string[] = [];
    const onProgress = vi.fn((p: { step: string }) => {
      // Only track first occurrence of each step
      if (!stepsSeen.includes(p.step)) {
        stepsSeen.push(p.step);
      }
    });

    const input = makeValidDirectorJSON();
    await orchestrateParallel(input, onProgress);

    // Steps should progress in this order
    expect(stepsSeen).toEqual([
      'validating',
      'tts',
      'assembling',
      'stitching',
      'manifest',
      'complete',
    ]);
  });

  it('should report 100% completion at the end', async () => {
    const { orchestrateParallel } = await import('./pipeline.js');

    let lastProgress: { step: string; percent: number } | null = null;
    const onProgress = vi.fn((p: { step: string; percent: number }) => {
      lastProgress = { step: p.step, percent: p.percent };
    });

    const input = makeValidDirectorJSON();
    await orchestrateParallel(input, onProgress);

    expect(lastProgress).not.toBeNull();
    expect(lastProgress!.step).toBe('complete');
    expect(lastProgress!.percent).toBe(100);
  });

  it('should handle empty scenes array', async () => {
    const { orchestrateParallel } = await import('./pipeline.js');
    const { parallelTTSGenerate } = await import('./workers/parallel-tts.js');
    const { progressiveStitch } = await import('./workers/progressive-stitch.js');
    const { finalConcatenation } = await import('./workers/progressive-stitch.js');

    // Reset mocks to return empty-appropriate values
    (parallelTTSGenerate as Mock).mockResolvedValue({
      stems_by_scene: {},
      total_lines: 0,
      cached_lines: 0,
      generated_lines: 0,
    });

    (progressiveStitch as Mock).mockResolvedValue({
      scenes: [],
      total_duration_ms: 0,
    });

    const input = makeValidDirectorJSON({ scenes: [] });
    const result = await orchestrateParallel(input);

    expect(result.scenes).toHaveLength(0);
    expect(result.project_id).toBe('00000000-0000-0000-0000-000000000001');
  });

  it('should produce OrchestrationResult with correct structure', async () => {
    const { orchestrateParallel } = await import('./pipeline.js');

    const input = makeValidDirectorJSON();
    const result = await orchestrateParallel(input);

    expect(result).toHaveProperty('project_id');
    expect(result).toHaveProperty('output_dir');
    expect(result).toHaveProperty('episode_path');
    expect(result).toHaveProperty('manifest_path');
    expect(result).toHaveProperty('scenes');
    expect(result).toHaveProperty('audio_urls');
    expect(result).toHaveProperty('manifest');

    expect(result.project_id).toBe('00000000-0000-0000-0000-000000000001');
    expect(result.episode_path).toContain('episode.m4a');
    expect(result.manifest_path).toContain('manifest.json');
  });

  it('should validate schema and reject invalid input', async () => {
    const { orchestrateParallel } = await import('./pipeline.js');

    await expect(orchestrateParallel({})).rejects.toThrow('Invalid Director JSON');
    await expect(orchestrateParallel({ project_id: 'bad' })).rejects.toThrow('Invalid Director JSON');
    await expect(orchestrateParallel(null)).rejects.toThrow('Invalid Director JSON');
  });

  it('should work without onProgress callback', async () => {
    const { orchestrateParallel } = await import('./pipeline.js');

    const input = makeValidDirectorJSON();

    // No callback passed - should not throw
    const result = await orchestrateParallel(input);
    expect(result).toBeDefined();
    expect(result.project_id).toBe('00000000-0000-0000-0000-000000000001');
  });

  it('should use progressiveStitch for scene assembly', async () => {
    const { orchestrateParallel } = await import('./pipeline.js');
    const { progressiveStitch } = await import('./workers/progressive-stitch.js');

    const input = makeMultiSceneDirectorJSON();
    await orchestrateParallel(input);

    expect(progressiveStitch).toHaveBeenCalledTimes(1);
    expect(progressiveStitch).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: '00000000-0000-0000-0000-000000000002',
      }),
      expect.any(Object), // stems_by_scene
      expect.stringContaining('00000000-0000-0000-0000-000000000002'), // projectDir
      3, // sceneConcurrency
      expect.any(Function), // onProgress callback
      expect.objectContaining({}), // B-003b gain offsets
    );
  });

  it('should call finalConcatenation with scene results', async () => {
    const { orchestrateParallel } = await import('./pipeline.js');
    const { finalConcatenation } = await import('./workers/progressive-stitch.js');

    const input = makeMultiSceneDirectorJSON();
    await orchestrateParallel(input);

    expect(finalConcatenation).toHaveBeenCalledTimes(1);
    expect(finalConcatenation).toHaveBeenCalledWith(
      expect.any(Array), // scenes array
      expect.stringContaining('episode.m4a'),
      1.5 // crossfade duration
    );
  });
});

describe('shared pipeline behavior', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('should reject DirectorJSON with missing dialogue text', async () => {
    const { orchestrate } = await import('./pipeline.js');

    const input = {
      project_id: '00000000-0000-0000-0000-000000000001',
      scenes: [
        {
          scene_id: 'scene_001',
          dialogue: [
            {
              line_id: 'line_001',
              character: 'Narrator',
              text: '', // Empty text should fail (min 1 char)
              voice_key: 'voice_narrator',
            },
          ],
        },
      ],
    };

    await expect(orchestrate(input)).rejects.toThrow('Invalid Director JSON');
  });

  it('should accept DirectorJSON with optional fields', async () => {
    const { orchestrate } = await import('./pipeline.js');

    const input = {
      project_id: '00000000-0000-0000-0000-000000000003',
      script_id: 'script_abc',
      scenes: [
        {
          scene_id: 'scene_001',
          summary: 'Opening scene',
          mood: 'tense',
          intensity: 0.7,
          dialogue: [
            {
              line_id: 'line_001',
              character: 'Detective',
              text: 'Something is wrong here.',
              voice_key: 'voice_detective',
              character_age: 45,
              character_gender: 'Male' as const,
              character_ethnicity: 'Caucasian',
            },
          ],
          music: [{ file: 'suspense_track_01' }],
          ambience: [{ file: 'rain_heavy' }],
          sfx: [{ file: 'door_creak', start_at: 'line_001', duration: 2.0 }],
          mix: { target_lufs: -14, true_peak_db: -1 },
        },
      ],
    };

    const result = await orchestrate(input);
    expect(result.project_id).toBe('00000000-0000-0000-0000-000000000003');
  });

  it('should generate manifest with correct project_id', async () => {
    const { orchestrate } = await import('./pipeline.js');
    const { makePlaybackManifest } = await import('./workers/export.js');

    const input = makeValidDirectorJSON();
    await orchestrate(input);

    expect(makePlaybackManifest).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      expect.any(Array),
      1.5
    );
  });
});
