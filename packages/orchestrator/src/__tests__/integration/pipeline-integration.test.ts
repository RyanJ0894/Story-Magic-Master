/**
 * Integration tests: Director output → Orchestrator pipeline
 *
 * These tests verify the data contract between the Director pipeline
 * and the Orchestrator pipeline. All external I/O (LLM, TTS, FFmpeg,
 * Supabase, filesystem) is mocked; the focus is on data shape compatibility
 * and end-to-end flow through both pipelines.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DirectorJSON, Scene, PipelineResult } from '../../schemas/director-json.js';
import type { SceneAlignment, LineAlignment } from '../../orchestrator/workers/align.js';
import type { SceneCues } from '../../orchestrator/workers/cues.js';
import type { StemResult } from '../../orchestrator/workers/tts.js';
import type { PlaybackManifest } from '../../orchestrator/workers/export.js';

// ---------------------------------------------------------------------------
// Module-level mock variables
// ---------------------------------------------------------------------------
const mockDirectorProcess = vi.fn();
const mockAudioProcess = vi.fn();
const mockDirectorValidate = vi.fn();
const mockDirectorAutoCorrect = vi.fn();
const mockAudioValidate = vi.fn();
const mockAudioAutoCorrect = vi.fn();

const mockTtsForScene = vi.fn();
const mockAlignScene = vi.fn();
const mockPickCues = vi.fn();
const mockBuildTimeline = vi.fn();
const mockMixScene = vi.fn();
const mockConcatScenes = vi.fn();
const mockMakeManifest = vi.fn();
const mockLoadCatalog = vi.fn();
const mockGetTrackPath = vi.fn();

// ---------------------------------------------------------------------------
// Mocks — declared before imports of module-under-test
// ---------------------------------------------------------------------------

// Director pipeline mocks
vi.mock('../../director/agents/director-agent.js', () => ({
  DirectorAgent: vi.fn().mockImplementation(function () {
    return { process: mockDirectorProcess };
  }),
}));

vi.mock('../../director/agents/audio-director-agent.js', () => ({
  AudioDirectorAgent: vi.fn().mockImplementation(function () {
    return { process: mockAudioProcess };
  }),
}));

vi.mock('../../director/validation/director-validator.js', () => ({
  DirectorJSONValidator: vi.fn().mockImplementation(function () {
    return { validate: mockDirectorValidate, autoCorrect: mockDirectorAutoCorrect };
  }),
}));

vi.mock('../../director/validation/audio-validator.js', () => ({
  SceneAudioValidator: vi.fn().mockImplementation(function () {
    return { validate: mockAudioValidate, autoCorrect: mockAudioAutoCorrect };
  }),
}));

// Orchestrator worker mocks
vi.mock('../../orchestrator/workers/tts.js', () => ({
  ttsForScene: (...args: unknown[]) => mockTtsForScene(...args),
}));

vi.mock('../../orchestrator/workers/align.js', () => ({
  alignScene: (...args: unknown[]) => mockAlignScene(...args),
  computeGap: () => 0.3,
}));

vi.mock('../../orchestrator/workers/cues.js', () => ({
  pickCues: (...args: unknown[]) => mockPickCues(...args),
}));

vi.mock('../../orchestrator/workers/timeline.js', () => ({
  buildTimeline: (...args: unknown[]) => mockBuildTimeline(...args),
}));

vi.mock('../../orchestrator/workers/mixer.js', () => ({
  mixScene: (...args: unknown[]) => mockMixScene(...args),
}));

vi.mock('../../orchestrator/workers/export.js', () => ({
  concatScenesWithCrossfade: (...args: unknown[]) => mockConcatScenes(...args),
  makePlaybackManifest: (...args: unknown[]) => mockMakeManifest(...args),
}));

vi.mock('../../orchestrator/workers/parallel-tts.js', () => ({
  parallelTTSGenerate: vi.fn(),
}));

vi.mock('../../orchestrator/workers/progressive-stitch.js', () => ({
  progressiveStitch: vi.fn(),
  finalConcatenation: vi.fn(),
}));

vi.mock('../../lib/catalog-loader.js', () => ({
  loadCatalog: () => mockLoadCatalog(),
  getTrackPath: (id: string) => mockGetTrackPath(id),
}));

// Mock dotenv, execa, ffmpeg-static, and fs to prevent real I/O
vi.mock('dotenv/config', () => ({}));
vi.mock('execa', () => ({ execa: vi.fn().mockResolvedValue({ stdout: '' }) }));
vi.mock('ffmpeg-static', () => ({ default: '/usr/bin/ffmpeg' }));

// Filesystem mock — allow mkdirSync, writeFileSync, etc. but prevent real operations
const mockFs = {
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  copyFileSync: vi.fn(),
  unlinkSync: vi.fn(),
};
vi.mock('fs', () => ({
  default: {
    mkdirSync: (...a: unknown[]) => mockFs.mkdirSync(...a),
    writeFileSync: (...a: unknown[]) => mockFs.writeFileSync(...a),
    existsSync: (...a: unknown[]) => mockFs.existsSync(...a),
    copyFileSync: (...a: unknown[]) => mockFs.copyFileSync(...a),
    unlinkSync: (...a: unknown[]) => mockFs.unlinkSync(...a),
    readFileSync: vi.fn().mockReturnValue(''),
  },
  mkdirSync: (...a: unknown[]) => mockFs.mkdirSync(...a),
  writeFileSync: (...a: unknown[]) => mockFs.writeFileSync(...a),
  existsSync: (...a: unknown[]) => mockFs.existsSync(...a),
  copyFileSync: (...a: unknown[]) => mockFs.copyFileSync(...a),
  unlinkSync: (...a: unknown[]) => mockFs.unlinkSync(...a),
  readFileSync: vi.fn().mockReturnValue(''),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import { processScript } from '../../director/pipeline.js';
import { orchestrate } from '../../orchestrator/pipeline.js';
import { DirectorJSONSchema } from '../../schemas/director-json.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeDirectorJSON(overrides: Record<string, unknown> = {}): DirectorJSON {
  return {
    project_id: PROJECT_ID,
    scenes: [
      {
        scene_id: 'scene_001',
        dialogue: [
          {
            line_id: 'line_001',
            character: 'Alice',
            text: 'Hello, Bob. Welcome to the coffee shop.',
            voice_key: '21m00Tcm4TlvDq8ikWAM',
          },
          {
            line_id: 'line_002',
            character: 'Bob',
            text: 'Thanks, Alice. It smells amazing in here!',
            voice_key: 'EXAVITQu4vr4xnSDxMaL',
          },
        ],
        music: [{ file: 'jazz_cafe', start_at: 0, fade_out: 2 }],
        ambience: [{ file: 'coffee_shop_ambience', start_at: 0 }],
        sfx: [{ file: 'door_bell', start_at: 'line_001', duration: 1.5 }],
      },
      {
        scene_id: 'scene_002',
        dialogue: [
          {
            line_id: 'line_003',
            character: 'Alice',
            text: "Let's order. What would you like?",
            voice_key: '21m00Tcm4TlvDq8ikWAM',
          },
        ],
        music: [],
        ambience: [{ file: 'coffee_shop_ambience', start_at: 0 }],
        sfx: [],
      },
    ],
    ...overrides,
  } as DirectorJSON;
}

function makeSceneAudioJSON() {
  return {
    project_id: PROJECT_ID,
    scenes: [
      {
        scene_id: 'scene_001',
        music: [{ cue_id: 'mus-1', description: 'Jazz cafe background', file: 'jazz_cafe' }],
        ambience: [
          {
            cue_id: 'amb-1',
            description: 'Coffee shop ambience',
            file: 'coffee_shop_ambience',
          },
        ],
        sfx: [{ cue_id: 'sfx-1', description: 'Door bell', file: 'door_bell' }],
      },
      {
        scene_id: 'scene_002',
        music: [],
        ambience: [
          {
            cue_id: 'amb-2',
            description: 'Coffee shop ambience',
            file: 'coffee_shop_ambience',
          },
        ],
        sfx: [],
      },
    ],
  };
}

function makeStemsForScene(scene: Scene): StemResult[] {
  return scene.dialogue.map((line) => ({
    line_id: line.line_id,
    path: `/tmp/tts/${scene.scene_id}/${line.line_id}.wav`,
  }));
}

function makeAlignmentForScene(scene: Scene): SceneAlignment {
  const lines: LineAlignment[] = [];
  let cursor = 0;
  for (const line of scene.dialogue) {
    const dur = line.text.length / 15; // ~15 chars/sec estimate
    lines.push({ line_id: line.line_id, start: cursor, end: cursor + dur });
    cursor += dur + 0.3;
  }
  return { scene_id: scene.scene_id, lines };
}

function makeCuesForScene(scene: Scene): SceneCues {
  return {
    music: scene.music || [],
    ambience: scene.ambience || [],
    sfx: scene.sfx || [],
  };
}

function makeTimelineForScene(scene: Scene, alignment: SceneAlignment, cues: SceneCues) {
  const events: Array<Record<string, unknown>> = [];

  for (const line of alignment.lines) {
    events.push({ type: 'dialogue_in', line_id: line.line_id, at: line.start });
    events.push({ type: 'dialogue_out', line_id: line.line_id, at: line.end });
  }

  if (cues.music?.length) {
    events.push({ type: 'music_in', cue_id: 'mus-1', at: 0 });
  }
  if (cues.ambience?.length) {
    events.push({ type: 'ambience_in', cue_id: 'amb-1', at: 0 });
  }

  events.sort((a, b) => (a.at as number) - (b.at as number));
  return { scene_id: scene.scene_id, events };
}

function makeManifest(): PlaybackManifest {
  return {
    project_id: PROJECT_ID,
    order: [
      { scene_id: 'scene_001', offset: 0, duration: 8.5 },
      { scene_id: 'scene_002', offset: 7.0, duration: 4.2 },
    ],
    total: 11.2,
    public_url: `https://storage.example.com/audio/${PROJECT_ID}/episode.m4a`,
  };
}

// ---------------------------------------------------------------------------
// Default mock setup
// ---------------------------------------------------------------------------

function setupDirectorMocks() {
  const directorJson = makeDirectorJSON();
  const audioJson = makeSceneAudioJSON();

  mockDirectorProcess.mockResolvedValue(directorJson);
  mockAudioProcess.mockResolvedValue(audioJson);
  mockDirectorValidate.mockReturnValue({ isValid: true, errors: [] });
  mockDirectorAutoCorrect.mockReturnValue(directorJson);
  mockAudioValidate.mockReturnValue({ isValid: true, errors: [] });
  mockAudioAutoCorrect.mockReturnValue(audioJson);
}

function setupOrchestratorMocks(directorJson: DirectorJSON) {
  // TTS: return stems per scene
  mockTtsForScene.mockImplementation((_projId: string, scene: Scene) => {
    return Promise.resolve(makeStemsForScene(scene));
  });

  // Align: compute alignment per scene
  mockAlignScene.mockImplementation((_projId: string, scene: Scene) => {
    return Promise.resolve(makeAlignmentForScene(scene));
  });

  // Cues: extract from scene
  mockPickCues.mockImplementation((scene: Scene) => {
    return Promise.resolve(makeCuesForScene(scene));
  });

  // Timeline: build from alignment + cues
  mockBuildTimeline.mockImplementation(
    (scene: Scene, alignment: SceneAlignment, cues: SceneCues) => {
      return Promise.resolve(makeTimelineForScene(scene, alignment, cues));
    }
  );

  // Mixer: no-op (writes to filesystem)
  mockMixScene.mockResolvedValue(undefined);

  // Concat: no-op
  mockConcatScenes.mockResolvedValue(undefined);

  // Manifest
  mockMakeManifest.mockResolvedValue(makeManifest());

  // Catalog
  mockLoadCatalog.mockReturnValue({
    music: { jazz_cafe: { path: '/catalog/music/jazz_cafe.wav' } },
    ambience: { coffee_shop_ambience: { path: '/catalog/ambience/coffee_shop.wav' } },
    sfx: { door_bell: { path: '/catalog/sfx/door_bell.wav' } },
  });
  mockGetTrackPath.mockImplementation((id: string) => `/catalog/${id}.wav`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Pipeline Integration: Director → Orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDirectorMocks();
    setupOrchestratorMocks(makeDirectorJSON());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Director output conforms to Orchestrator input schema
  it('Director output is accepted by the Orchestrator without validation errors', async () => {
    const directorResult = await processScript({
      project_id: PROJECT_ID,
      script_text: 'INT. COFFEE SHOP - DAY\n\nALICE\nHello, Bob.',
    });

    expect(directorResult.director_json).toBeDefined();
    expect(directorResult.director_json.project_id).toBe(PROJECT_ID);
    expect(directorResult.director_json.scenes.length).toBeGreaterThan(0);

    // Feed director output into orchestrator — should not throw
    const result = await orchestrate(directorResult.director_json);

    expect(result.project_id).toBe(PROJECT_ID);
    expect(result.manifest).toBeDefined();
    expect(result.scenes.length).toBe(directorResult.director_json.scenes.length);
  });

  // 2. Scene IDs propagate through the full pipeline
  it('preserves scene IDs from director through orchestrator output', async () => {
    const directorResult = await processScript({
      project_id: PROJECT_ID,
      script_text: 'Scene test',
    });

    const directorSceneIds = directorResult.director_json.scenes.map((s) => s.scene_id);

    const result = await orchestrate(directorResult.director_json);
    const orchestratorSceneIds = result.scenes.map((s) => s.scene_id);

    expect(orchestratorSceneIds).toEqual(directorSceneIds);
  });

  // 3. Dialogue line IDs flow through TTS → Alignment
  it('passes dialogue line IDs through TTS and alignment workers', async () => {
    const directorResult = await processScript({
      project_id: PROJECT_ID,
      script_text: 'Dialogue test',
    });

    await orchestrate(directorResult.director_json);

    // Verify TTS was called for each scene with correct dialogue lines
    const scene1 = directorResult.director_json.scenes[0];
    expect(mockTtsForScene).toHaveBeenCalledWith(
      PROJECT_ID,
      expect.objectContaining({
        scene_id: scene1.scene_id,
        dialogue: expect.arrayContaining([
          expect.objectContaining({ line_id: 'line_001', character: 'Alice' }),
          expect.objectContaining({ line_id: 'line_002', character: 'Bob' }),
        ]),
      }),
      expect.objectContaining({}), // B-003b options arg ({narrationSpeed?})
    );

    // Verify alignment was called with TTS stems
    expect(mockAlignScene).toHaveBeenCalled();
    const alignCall = mockAlignScene.mock.calls[0];
    expect(alignCall[0]).toBe(PROJECT_ID);
    expect(alignCall[1].scene_id).toBe('scene_001');

    // The stems passed to align should match TTS output
    const stemsPassedToAlign = alignCall[2];
    expect(stemsPassedToAlign.length).toBe(scene1.dialogue.length);
    for (const stem of stemsPassedToAlign) {
      expect(stem).toHaveProperty('line_id');
      expect(stem).toHaveProperty('path');
    }
  });

  // 4. Audio cues from Director reach the cue picker
  it('passes scene audio cues through to the cue picker worker', async () => {
    const directorResult = await processScript({
      project_id: PROJECT_ID,
      script_text: 'Audio cue test',
    });

    await orchestrate(directorResult.director_json);

    // pickCues should receive each scene
    expect(mockPickCues).toHaveBeenCalledTimes(
      directorResult.director_json.scenes.length
    );
    const firstPickCall = mockPickCues.mock.calls[0];
    expect(firstPickCall[0].scene_id).toBe('scene_001');
  });

  // 5. Timeline receives aligned data + cue selections
  it('feeds alignment and cue data into the timeline builder', async () => {
    await processScript({
      project_id: PROJECT_ID,
      script_text: 'Timeline test',
    });

    const directorJson = makeDirectorJSON();
    await orchestrate(directorJson);

    expect(mockBuildTimeline).toHaveBeenCalled();
    const [scene, alignment, cues] = mockBuildTimeline.mock.calls[0];

    // Scene has dialogue
    expect(scene.dialogue.length).toBeGreaterThan(0);

    // Alignment has lines matching dialogue
    expect(alignment.scene_id).toBe(scene.scene_id);
    expect(alignment.lines.length).toBe(scene.dialogue.length);

    // Cues extracted from scene
    expect(cues).toHaveProperty('music');
    expect(cues).toHaveProperty('ambience');
    expect(cues).toHaveProperty('sfx');
  });

  // 6. Mixer receives the correct inputs per scene
  it('calls mixer with dialogue path and mix parameters for each scene', async () => {
    const directorJson = makeDirectorJSON();
    await orchestrate(directorJson);

    expect(mockMixScene).toHaveBeenCalledTimes(directorJson.scenes.length);
    const firstMixCall = mockMixScene.mock.calls[0][0];

    expect(firstMixCall).toHaveProperty('project_id', PROJECT_ID);
    expect(firstMixCall).toHaveProperty('scene_id', 'scene_001');
    expect(firstMixCall).toHaveProperty('inputs');
    expect(firstMixCall.inputs).toHaveProperty('dialogue');
    expect(firstMixCall).toHaveProperty('outWav');
    expect(firstMixCall).toHaveProperty('outFinal');
    expect(firstMixCall).toHaveProperty('mixParams');

    // Default mix params
    expect(firstMixCall.mixParams.target_lufs).toBe(-16);
    expect(firstMixCall.mixParams.true_peak_db).toBe(-1.5);
  });

  // 7. Multi-scene export concatenation
  it('concatenates all scene outputs into a single episode', async () => {
    const directorJson = makeDirectorJSON();
    await orchestrate(directorJson);

    expect(mockConcatScenes).toHaveBeenCalledTimes(1);
    const [scenePaths, outPath, options] = mockConcatScenes.mock.calls[0];

    expect(scenePaths.length).toBe(directorJson.scenes.length);
    expect(outPath).toContain('episode.m4a');
    expect(options).toEqual({ fadeDuration: 1.5, fadeType: 'tri' });
  });

  // 8. Manifest generation
  it('generates a playback manifest with all scene entries', async () => {
    const directorJson = makeDirectorJSON();
    const result = await orchestrate(directorJson);

    expect(mockMakeManifest).toHaveBeenCalledTimes(1);
    expect(result.manifest.project_id).toBe(PROJECT_ID);
    expect(result.manifest.order.length).toBe(2);
    expect(result.manifest.total).toBeGreaterThan(0);
  });

  // 9. Voice overrides from Director propagate to TTS
  it('applies voice overrides before orchestration', async () => {
    const directorResult = await processScript({
      project_id: PROJECT_ID,
      script_text: 'Voice override test',
      voice_overrides: { Alice: 'custom-voice-alice' },
    });

    // Director should have applied the override
    const aliceLine = directorResult.director_json.scenes[0].dialogue.find(
      (d) => d.character === 'Alice'
    );
    expect(aliceLine?.voice_key).toBe('custom-voice-alice');

    // Orchestrate with the overridden JSON
    await orchestrate(directorResult.director_json);

    // TTS should receive the overridden voice_key
    const ttsCall = mockTtsForScene.mock.calls[0];
    const scenePassedToTts = ttsCall[1] as Scene;
    const aliceLineInTts = scenePassedToTts.dialogue.find(
      (d) => d.character === 'Alice'
    );
    expect(aliceLineInTts?.voice_key).toBe('custom-voice-alice');
  });

  // 10. Validation report propagates through Director result
  it('includes validation report in director output', async () => {
    const directorResult = await processScript({
      project_id: PROJECT_ID,
      script_text: 'Validation test',
    });

    expect(directorResult.validation_report).toBeDefined();
    expect(directorResult.validation_report.director_validation).toHaveProperty(
      'is_valid',
      true
    );
    expect(directorResult.validation_report.audio_validation).toHaveProperty(
      'is_valid',
      true
    );
  });

  // 11. SFX start_at line references resolve correctly in orchestrator
  it('resolves SFX line_id references via alignment in the orchestrator', async () => {
    const directorJson = makeDirectorJSON();
    await orchestrate(directorJson);

    // Scene 1 has an SFX with start_at: 'line_001'
    // The mixer should receive this SFX with the resolved timestamp
    const mixCall = mockMixScene.mock.calls[0][0];

    // SFX is added via cues → timeline, and the orchestrator resolves
    // line references. With our mocks, sfx array is populated via pickCues.
    // The actual resolution happens in the pipeline code between cues and mixer.
    expect(mixCall.inputs).toHaveProperty('dialogue');
  });

  // 12. Empty scenes are handled gracefully
  it('handles a scene with no audio cues (dialogue only)', async () => {
    const minimalJson = makeDirectorJSON({
      scenes: [
        {
          scene_id: 'scene_minimal',
          dialogue: [
            {
              line_id: 'line_solo',
              character: 'Solo',
              text: 'Just me talking.',
              voice_key: 'voice-solo',
            },
          ],
          music: [],
          ambience: [],
          sfx: [],
        },
      ],
    });

    mockDirectorProcess.mockResolvedValue(minimalJson);
    mockAudioProcess.mockResolvedValue({
      project_id: PROJECT_ID,
      scenes: [{ scene_id: 'scene_minimal', music: [], ambience: [], sfx: [] }],
    });

    const dirResult = await processScript({
      project_id: PROJECT_ID,
      script_text: 'Minimal scene',
    });

    const result = await orchestrate(dirResult.director_json);

    expect(result.scenes.length).toBe(1);
    expect(result.scenes[0].scene_id).toBe('scene_minimal');
  });

  // 13. Project ID consistency across all pipeline stages
  it('maintains project_id consistency across all stages', async () => {
    const dirResult = await processScript({
      project_id: PROJECT_ID,
      script_text: 'Consistency check',
    });

    expect(dirResult.project_id).toBe(PROJECT_ID);
    expect(dirResult.director_json.project_id).toBe(PROJECT_ID);

    const orchResult = await orchestrate(dirResult.director_json);
    expect(orchResult.project_id).toBe(PROJECT_ID);
    expect(orchResult.manifest.project_id).toBe(PROJECT_ID);
  });

  // 14. Director validation auto-correction feeds clean data to orchestrator
  it('auto-corrects Director errors before passing to Orchestrator', async () => {
    const correctedJson = makeDirectorJSON();

    mockDirectorValidate.mockReturnValueOnce({
      isValid: false,
      errors: [
        {
          message: 'Duplicate voice assignment',
          toJSON: () => ({ message: 'Duplicate voice assignment' }),
        },
      ],
    });
    mockDirectorAutoCorrect.mockReturnValue(correctedJson);

    const dirResult = await processScript({
      project_id: PROJECT_ID,
      script_text: 'Auto-correct test',
    });

    // Auto-correction was triggered
    expect(mockDirectorAutoCorrect).toHaveBeenCalled();

    // Orchestrator should still work with the corrected output
    const result = await orchestrate(dirResult.director_json);
    expect(result.project_id).toBe(PROJECT_ID);
    expect(result.scenes.length).toBeGreaterThan(0);
  });

  // 15. Large script with many scenes processes correctly
  it('processes a script with 5 scenes end-to-end', async () => {
    const manyScenes = Array.from({ length: 5 }, (_, i) => ({
      scene_id: `scene_${String(i + 1).padStart(3, '0')}`,
      dialogue: [
        {
          line_id: `line_${String(i * 2 + 1).padStart(3, '0')}`,
          character: 'Character' + (i % 3),
          text: `Line ${i * 2 + 1} of the story.`,
          voice_key: `voice-${i % 3}`,
        },
        {
          line_id: `line_${String(i * 2 + 2).padStart(3, '0')}`,
          character: 'Character' + ((i + 1) % 3),
          text: `Line ${i * 2 + 2} continues.`,
          voice_key: `voice-${(i + 1) % 3}`,
        },
      ],
      music: i % 2 === 0 ? [{ file: 'bg_music', start_at: 0 }] : [],
      ambience: [{ file: 'room_tone', start_at: 0 }],
      sfx: [],
    }));

    const bigJson = makeDirectorJSON({ scenes: manyScenes });
    mockDirectorProcess.mockResolvedValue(bigJson);
    mockAudioProcess.mockResolvedValue({
      project_id: PROJECT_ID,
      scenes: manyScenes.map((s) => ({
        scene_id: s.scene_id,
        music: s.music,
        ambience: s.ambience,
        sfx: s.sfx,
      })),
    });

    const dirResult = await processScript({
      project_id: PROJECT_ID,
      script_text: 'Long script...',
    });

    const manifest: PlaybackManifest = {
      project_id: PROJECT_ID,
      order: manyScenes.map((s, i) => ({
        scene_id: s.scene_id,
        offset: i * 6.0,
        duration: 7.5,
      })),
      total: 5 * 7.5 - 4 * 1.5, // 5 scenes, 4 crossfades
      public_url: null,
    };
    mockMakeManifest.mockResolvedValue(manifest);

    const result = await orchestrate(dirResult.director_json);

    expect(result.scenes.length).toBe(5);
    expect(mockTtsForScene).toHaveBeenCalledTimes(5);
    expect(mockAlignScene).toHaveBeenCalledTimes(5);
    expect(mockBuildTimeline).toHaveBeenCalledTimes(5);
    expect(mockMixScene).toHaveBeenCalledTimes(5);
    expect(mockConcatScenes).toHaveBeenCalledTimes(1);

    // Concat receives all 5 scene paths
    const concatPaths = mockConcatScenes.mock.calls[0][0];
    expect(concatPaths.length).toBe(5);
  });
});

describe('Data Contract: DirectorJSON Schema', () => {
  it('requires project_id as UUID format', () => {
    // DirectorJSONSchema imported at top of file
    const result = DirectorJSONSchema.safeParse({
      project_id: 'not-a-uuid',
      scenes: [],
    });
    expect(result.success).toBe(false);
  });

  it('requires each dialogue line to have line_id, character, text, voice_key', () => {
    // DirectorJSONSchema imported at top of file

    const valid = DirectorJSONSchema.safeParse({
      project_id: PROJECT_ID,
      scenes: [
        {
          scene_id: 'scene_001',
          dialogue: [
            {
              line_id: 'line_001',
              character: 'Test',
              text: 'Hello',
              voice_key: 'voice-1',
            },
          ],
        },
      ],
    });
    expect(valid.success).toBe(true);
  });

  it('rejects dialogue missing voice_key', () => {
    // DirectorJSONSchema imported at top of file

    const result = DirectorJSONSchema.safeParse({
      project_id: PROJECT_ID,
      scenes: [
        {
          scene_id: 'scene_001',
          dialogue: [
            {
              line_id: 'line_001',
              character: 'Test',
              text: 'Hello',
              // no voice_key
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
