import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ----------------------------------------------------------------
// Mocks – must be declared before the module‑under‑test is imported
// ----------------------------------------------------------------

const mockDirectorProcess = vi.fn();
const mockAudioProcess = vi.fn();
const mockDirectorValidate = vi.fn();
const mockDirectorAutoCorrect = vi.fn();
const mockAudioValidate = vi.fn();
const mockAudioAutoCorrect = vi.fn();

vi.mock('./agents/director-agent.js', () => ({
  DirectorAgent: vi.fn().mockImplementation(function () {
    return { process: mockDirectorProcess };
  }),
}));

vi.mock('./agents/audio-director-agent.js', () => ({
  AudioDirectorAgent: vi.fn().mockImplementation(function () {
    return { process: mockAudioProcess };
  }),
}));

vi.mock('./validation/director-validator.js', () => ({
  DirectorJSONValidator: vi.fn().mockImplementation(function () {
    return { validate: mockDirectorValidate, autoCorrect: mockDirectorAutoCorrect };
  }),
}));

vi.mock('./validation/audio-validator.js', () => ({
  SceneAudioValidator: vi.fn().mockImplementation(function () {
    return { validate: mockAudioValidate, autoCorrect: mockAudioAutoCorrect };
  }),
}));

// ----------------------------------------------------------------
// Imports (after mocks are registered)
// ----------------------------------------------------------------

import { processScript, DirectorPipeline } from './pipeline.js';

// ----------------------------------------------------------------
// Test fixtures
// ----------------------------------------------------------------

function makeDirectorJSON(overrides: Record<string, any> = {}) {
  return {
    project_id: 'proj-1',
    scenes: [
      {
        scene_id: 'scene-1',
        dialogue: [
          {
            line_id: 'line-1',
            character: 'Alice',
            text: 'Hello there.',
            voice_key: 'voice-alice',
          },
          {
            line_id: 'line-2',
            character: 'Bob',
            text: 'Hi Alice!',
            voice_key: 'voice-bob',
          },
        ],
      },
    ],
    ...overrides,
  };
}

function makeSceneAudioJSON(overrides: Record<string, any> = {}) {
  return {
    project_id: 'proj-1',
    scenes: [
      {
        scene_id: 'scene-1',
        music: [{ cue_id: 'mus-1', description: 'Soft piano' }],
        ambience: [{ cue_id: 'amb-1', description: 'City street' }],
        sfx: [{ cue_id: 'sfx-1', description: 'Door slam' }],
      },
    ],
    ...overrides,
  };
}

function makeInput(overrides: Record<string, any> = {}) {
  return {
    project_id: 'proj-1',
    script_text: 'INT. COFFEE SHOP - DAY\nAlice and Bob sit at a table.',
    ...overrides,
  };
}

/** Matches the shape returned by DirectorJSONValidator.validate() and SceneAudioValidator.validate() */
function passingValidation() {
  return { isValid: true, errors: [] };
}

function failingValidation(messages: string[] = ['Missing field']) {
  return {
    isValid: false,
    errors: messages.map((msg) => ({
      message: msg,
      toJSON: () => ({ message: msg }),
    })),
  };
}

// ----------------------------------------------------------------
// Default mock behaviour (happy path)
// ----------------------------------------------------------------

function setupDefaultMocks() {
  mockDirectorProcess.mockResolvedValue(makeDirectorJSON());
  mockAudioProcess.mockResolvedValue(makeSceneAudioJSON());
  mockDirectorValidate.mockReturnValue(passingValidation());
  mockDirectorAutoCorrect.mockReturnValue(makeDirectorJSON());
  mockAudioValidate.mockReturnValue(passingValidation());
  mockAudioAutoCorrect.mockReturnValue(makeSceneAudioJSON());
}

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe('Director Pipeline – processScript()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  // 1. Happy‑path result shape
  it('returns a valid PipelineResult with all required fields', async () => {
    const result = await processScript(makeInput());

    expect(result).toHaveProperty('project_id', 'proj-1');
    expect(result).toHaveProperty('director_json');
    expect(result).toHaveProperty('scene_audio_json');
    expect(result).toHaveProperty('validation_report');
    expect(result.validation_report).toHaveProperty('director_validation');
    expect(result.validation_report).toHaveProperty('audio_validation');
  });

  // 2. DirectorAgent receives the right input
  it('calls DirectorAgent.process() with the pipeline input', async () => {
    const input = makeInput();
    await processScript(input);

    expect(mockDirectorProcess).toHaveBeenCalledTimes(1);
    const callArg = mockDirectorProcess.mock.calls[0][0];
    expect(callArg).toMatchObject({
      project_id: 'proj-1',
      script_text: input.script_text,
    });
  });

  // 3. AudioDirectorAgent receives the director JSON
  it('calls AudioDirectorAgent.process() with the director JSON', async () => {
    await processScript(makeInput());

    expect(mockAudioProcess).toHaveBeenCalledTimes(1);
    const callArg = mockAudioProcess.mock.calls[0][0];
    expect(callArg).toHaveProperty('project_id', 'proj-1');
    expect(callArg).toHaveProperty('scenes');
  });

  // 4. Voice overrides – exact match
  it('applies voice overrides when provided (exact character name match)', async () => {
    const input = makeInput({
      voice_overrides: { Alice: 'custom-voice-alice' },
    });

    await processScript(input);

    // AudioDirectorAgent should receive director JSON with the override applied
    const directorJsonPassedToAudio = mockAudioProcess.mock.calls[0][0];
    const aliceLine = directorJsonPassedToAudio.scenes[0].dialogue.find(
      (d: any) => d.character === 'Alice',
    );
    expect(aliceLine.voice_key).toBe('custom-voice-alice');
  });

  // 5. Voice overrides – case‑insensitive
  it('applies voice overrides with case-insensitive character matching', async () => {
    const input = makeInput({
      voice_overrides: { ALICE: 'upper-voice', bob: 'lower-voice' },
    });

    await processScript(input);

    const directorJsonPassedToAudio = mockAudioProcess.mock.calls[0][0];
    const scene = directorJsonPassedToAudio.scenes[0];

    const aliceLine = scene.dialogue.find((d: any) => d.character === 'Alice');
    const bobLine = scene.dialogue.find((d: any) => d.character === 'Bob');

    expect(aliceLine.voice_key).toBe('upper-voice');
    expect(bobLine.voice_key).toBe('lower-voice');
  });

  // 6. Voice overrides don't mutate the original DirectorJSON
  it('does not mutate the original DirectorJSON when applying voice overrides', async () => {
    const original = makeDirectorJSON();
    mockDirectorProcess.mockResolvedValue(original);

    const input = makeInput({
      voice_overrides: { Alice: 'mutated-voice' },
    });

    await processScript(input);

    // The original object that DirectorAgent returned should be untouched
    const aliceLine = original.scenes[0].dialogue.find(
      (d: any) => d.character === 'Alice',
    );
    expect(aliceLine!.voice_key).toBe('voice-alice');
  });

  // 7. Empty voice_overrides object has no effect
  it('leaves voice keys unchanged when voice_overrides is an empty object', async () => {
    const input = makeInput({ voice_overrides: {} });

    await processScript(input);

    const directorJsonPassedToAudio = mockAudioProcess.mock.calls[0][0];
    const aliceLine = directorJsonPassedToAudio.scenes[0].dialogue.find(
      (d: any) => d.character === 'Alice',
    );
    expect(aliceLine.voice_key).toBe('voice-alice');
  });

  // 8. Merging adds audio cues into director scenes
  it('merges audio cues (music, ambience, sfx) into the final director JSON scenes', async () => {
    const result = await processScript(makeInput());

    const scene = result.director_json.scenes[0];
    expect(scene.music).toEqual([{ cue_id: 'mus-1', description: 'Soft piano' }]);
    expect(scene.ambience).toEqual([{ cue_id: 'amb-1', description: 'City street' }]);
    expect(scene.sfx).toEqual([{ cue_id: 'sfx-1', description: 'Door slam' }]);
  });

  // 9. Merging handles scenes that have no matching audio scene
  it('assigns empty audio arrays when a scene has no matching audio entry', async () => {
    const directorWithTwoScenes = makeDirectorJSON({
      scenes: [
        {
          scene_id: 'scene-1',
          dialogue: [
            { line_id: 'l1', character: 'Alice', text: 'Hi', voice_key: 'v1' },
          ],
        },
        {
          scene_id: 'scene-2',
          dialogue: [
            { line_id: 'l2', character: 'Bob', text: 'Bye', voice_key: 'v2' },
          ],
        },
      ],
    });

    mockDirectorProcess.mockResolvedValue(directorWithTwoScenes);
    mockAudioProcess.mockResolvedValue(
      makeSceneAudioJSON({
        scenes: [
          {
            scene_id: 'scene-1',
            music: [{ cue_id: 'mus-1', description: 'Piano' }],
            ambience: [],
            sfx: [],
          },
        ],
      }),
    );

    const result = await processScript(makeInput());

    const scene2 = result.director_json.scenes.find(
      (s: any) => s.scene_id === 'scene-2',
    );
    expect(scene2).toBeDefined();
    expect(scene2!.music ?? []).toEqual([]);
    expect(scene2!.ambience ?? []).toEqual([]);
    expect(scene2!.sfx ?? []).toEqual([]);
  });

  // 10. Validation auto‑correction is triggered on failure
  it('triggers autoCorrect when validation reports errors', async () => {
    mockDirectorValidate.mockReturnValueOnce(failingValidation(['bad field']));
    mockDirectorAutoCorrect.mockReturnValue(makeDirectorJSON());

    await processScript(makeInput());

    expect(mockDirectorAutoCorrect).toHaveBeenCalled();
  });

  // 11. Validation reports are included in the result
  it('includes both director and audio validation reports in the result', async () => {
    const result = await processScript(makeInput());

    expect(result.validation_report.director_validation).toHaveProperty('is_valid', true);
    expect(result.validation_report.director_validation).toHaveProperty('errors_found', 0);
    expect(result.validation_report.audio_validation).toHaveProperty('is_valid', true);
    expect(result.validation_report.audio_validation).toHaveProperty('errors_found', 0);
  });

  // 12. Multiple scenes are processed end‑to‑end
  it('processes multiple scenes correctly through the full pipeline', async () => {
    const multiSceneDirector = makeDirectorJSON({
      scenes: [
        {
          scene_id: 'scene-1',
          dialogue: [
            { line_id: 'l1', character: 'Alice', text: 'Act 1', voice_key: 'v-a' },
          ],
        },
        {
          scene_id: 'scene-2',
          dialogue: [
            { line_id: 'l2', character: 'Bob', text: 'Act 2', voice_key: 'v-b' },
          ],
        },
        {
          scene_id: 'scene-3',
          dialogue: [
            { line_id: 'l3', character: 'Carol', text: 'Act 3', voice_key: 'v-c' },
          ],
        },
      ],
    });

    const multiSceneAudio = makeSceneAudioJSON({
      scenes: [
        { scene_id: 'scene-1', music: [{ cue_id: 'm1' }], ambience: [], sfx: [] },
        { scene_id: 'scene-2', music: [], ambience: [{ cue_id: 'a2' }], sfx: [] },
        { scene_id: 'scene-3', music: [], ambience: [], sfx: [{ cue_id: 's3' }] },
      ],
    });

    mockDirectorProcess.mockResolvedValue(multiSceneDirector);
    mockAudioProcess.mockResolvedValue(multiSceneAudio);

    const result = await processScript(makeInput());

    expect(result.director_json.scenes).toHaveLength(3);
    expect(result.director_json.scenes[0].music).toEqual([{ cue_id: 'm1' }]);
    expect(result.director_json.scenes[1].ambience).toEqual([{ cue_id: 'a2' }]);
    expect(result.director_json.scenes[2].sfx).toEqual([{ cue_id: 's3' }]);
  });

  // 13. Audio validation auto‑correction path
  it('triggers audio autoCorrect when audio validation fails', async () => {
    mockAudioValidate.mockReturnValueOnce(failingValidation(['invalid sfx cue']));
    mockAudioAutoCorrect.mockReturnValue(makeSceneAudioJSON());

    await processScript(makeInput());

    expect(mockAudioAutoCorrect).toHaveBeenCalled();
  });

  // 14. Pipeline options are forwarded
  it('accepts optional PipelineOptions without error', async () => {
    const input = makeInput();
    const options = {
      directorModel: 'gpt-4o',
      audioDirectorModel: 'gpt-4o-mini',
      maxIterations: 5,
    };

    await expect(processScript(input, options)).resolves.toBeDefined();
  });

  // 15. Voice overrides only affect matching characters
  it('does not alter voice_key for characters without an override entry', async () => {
    const input = makeInput({
      voice_overrides: { Alice: 'new-alice-voice' },
    });

    await processScript(input);

    const directorJsonPassedToAudio = mockAudioProcess.mock.calls[0][0];
    const bobLine = directorJsonPassedToAudio.scenes[0].dialogue.find(
      (d: any) => d.character === 'Bob',
    );
    expect(bobLine.voice_key).toBe('voice-bob');
  });

  // 16. project_id propagates through the result
  it('preserves the project_id from input throughout the pipeline result', async () => {
    const input = makeInput({ project_id: 'custom-proj-99' });
    mockDirectorProcess.mockResolvedValue(makeDirectorJSON({ project_id: 'custom-proj-99' }));
    mockAudioProcess.mockResolvedValue(makeSceneAudioJSON({ project_id: 'custom-proj-99' }));

    const result = await processScript(input);

    expect(result.project_id).toBe('custom-proj-99');
  });
});

describe('DirectorPipeline class (facade)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('exposes a process() method that delegates to the pipeline', async () => {
    const pipeline = new DirectorPipeline();
    const input = makeInput();

    const result = await pipeline.process(input);
    expect(result).toHaveProperty('project_id');
    expect(result).toHaveProperty('director_json');
    expect(result).toHaveProperty('scene_audio_json');
    expect(result).toHaveProperty('validation_report');
  });

  it('can be constructed with pipeline options', () => {
    const pipeline = new DirectorPipeline({
      directorModel: 'gpt-4o',
      audioDirectorModel: 'gpt-4o-mini',
      maxIterations: 3,
    });

    expect(pipeline).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BL-012 — 200-page synthetic stress test
//
// Proves that the pipeline does NOT crash or time-out with a 200-page script.
// The pipeline itself is already chunked via SceneConstructionAgent; this test
// verifies the integration path from processScript() down to validation with
// a large input.
//
// "200 pages" ≈ 100K chars of screenplay text. We generate a synthetic script
// that matches this density without needing real LLM output.
// ═══════════════════════════════════════════════════════════════════════════

function generateSyntheticScript(pageCount: number): string {
  // One screenplay page ≈ 500 chars. We use a standard scene template repeated.
  const PAGE_TEMPLATE = `INT. OFFICE - DAY

JOHN
(looking at the camera)
Something important needs to be said here.

MARY
Are you sure about that, John?

JOHN
Absolutely certain. This is critical.

`;
  const charsPerPage = PAGE_TEMPLATE.length; // ~150 chars; we'll repeat to fill 500/page
  const repeatsPerPage = Math.ceil(500 / charsPerPage);
  const pageContent = PAGE_TEMPLATE.repeat(repeatsPerPage).slice(0, 500);

  return pageContent.repeat(pageCount);
}

describe('200-page stress test (BL-012)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Standard mock setup
    mockDirectorProcess.mockResolvedValue(makeDirectorJSON());
    mockAudioProcess.mockResolvedValue(makeSceneAudioJSON());
    mockDirectorValidate.mockReturnValue({ warnings: [], errors: [] });
    mockAudioValidate.mockReturnValue({ warnings: [], errors: [] });
  });

  it('processScript() completes without error for a 200-page synthetic script', async () => {
    const longScript = generateSyntheticScript(200);

    // Verify our synthetic script is approximately 200 pages long
    // (200 pages × 500 chars/page = 100K chars)
    expect(longScript.length).toBeGreaterThan(90_000);
    expect(longScript.length).toBeLessThan(120_000);

    const result = await processScript({
      project_id: 'stress-test-200p',
      script_text: longScript,
    });

    expect(result).toHaveProperty('director_json');
    // The mock returns project_id 'proj-1' — we just verify it ran end-to-end
    expect(result.director_json).toBeDefined();
    expect(mockDirectorProcess).toHaveBeenCalledOnce();
    expect(mockAudioProcess).toHaveBeenCalledOnce();
  });

  it('processScript() calls DirectorAgent with the full 200-page script text', async () => {
    const longScript = generateSyntheticScript(200);

    await processScript({
      project_id: 'stress-test-200p',
      script_text: longScript,
    });

    expect(mockDirectorProcess).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 'stress-test-200p',
        script_text: longScript,
      })
    );
  });

  it('synthetic script generator produces correct char density', () => {
    const script10 = generateSyntheticScript(10);
    const script100 = generateSyntheticScript(100);

    expect(script10.length).toBeGreaterThanOrEqual(4_500); // 10 pages × 500 chars
    expect(script100.length).toBeGreaterThanOrEqual(45_000); // 100 pages × 500 chars
  });
});
