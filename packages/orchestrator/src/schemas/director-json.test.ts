/**
 * Tests for Director JSON Schemas
 * Validates all Zod schemas used for data validation
 */

import { describe, it, expect } from 'vitest';
import {
  DialogueLineSchema,
  AudioCueSchema,
  SceneSchema,
  DirectorJSONSchema,
  OrchestrateRequestSchema,
  GenerateScenesRequestSchema,
  type DialogueLine,
  type Scene,
  type DirectorJSON,
} from './director-json.js';

describe('DialogueLineSchema', () => {
  it('should validate a complete dialogue line', () => {
    const validLine: DialogueLine = {
      line_id: 'line_001',
      character: 'John',
      text: 'Hello, world!',
      voice_key: 'voice_adam_001',
    };

    const result = DialogueLineSchema.safeParse(validLine);
    expect(result.success).toBe(true);
  });

  it('should validate dialogue line with optional fields', () => {
    const lineWithMetadata = {
      line_id: 'line_002',
      character: 'Sarah',
      text: 'How are you?',
      voice_key: 'voice_sarah_001',
      character_age: 25,
      character_gender: 'Female',
      character_ethnicity: 'African American',
    };

    const result = DialogueLineSchema.safeParse(lineWithMetadata);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.character_age).toBe(25);
      expect(result.data.character_gender).toBe('Female');
    }
  });

  it('should reject dialogue line missing required fields', () => {
    const invalidLine = {
      line_id: 'line_003',
      character: 'Mike',
      // missing text and voice_key
    };

    const result = DialogueLineSchema.safeParse(invalidLine);
    expect(result.success).toBe(false);
  });

  it('should reject invalid gender values', () => {
    const invalidGender = {
      line_id: 'line_004',
      character: 'Pat',
      text: 'Test',
      voice_key: 'voice_pat',
      character_gender: 'Other', // Invalid - must be Male or Female
    };

    const result = DialogueLineSchema.safeParse(invalidGender);
    expect(result.success).toBe(false);
  });
});

describe('AudioCueSchema', () => {
  it('should validate a minimal audio cue', () => {
    const cue = {
      file: 'music/epic_001.mp3',
    };

    const result = AudioCueSchema.safeParse(cue);
    expect(result.success).toBe(true);
  });

  it('should validate audio cue with all optional fields', () => {
    const fullCue = {
      file: 'ambience/forest_001.wav',
      reasoning: 'Forest ambience matches scene setting',
      start_at: 'line_005',
      end_at: 120.5,
      duration: 60,
      volume: -18,
      fade_out: 2.5,
    };

    const result = AudioCueSchema.safeParse(fullCue);
    expect(result.success).toBe(true);
  });

  it('should accept start_at as number', () => {
    const cue = {
      file: 'sfx/gunshot.wav',
      start_at: 45.2,
    };

    const result = AudioCueSchema.safeParse(cue);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.start_at).toBe(45.2);
    }
  });

  it('should accept start_at as line_id string', () => {
    const cue = {
      file: 'sfx/door_slam.wav',
      start_at: 'line_010',
    };

    const result = AudioCueSchema.safeParse(cue);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.start_at).toBe('line_010');
    }
  });

  it('should reject cue without file', () => {
    const invalidCue = {
      reasoning: 'Missing file field',
    };

    const result = AudioCueSchema.safeParse(invalidCue);
    expect(result.success).toBe(false);
  });
});

describe('SceneSchema', () => {
  it('should validate a minimal scene', () => {
    const scene: Scene = {
      scene_id: 'scene_001',
      dialogue: [
        {
          line_id: 'line_001',
          character: 'Narrator',
          text: 'Once upon a time...',
          voice_key: 'voice_narrator',
        },
      ],
    };

    const result = SceneSchema.safeParse(scene);
    expect(result.success).toBe(true);
  });

  it('should validate scene with all audio cues', () => {
    const fullScene = {
      scene_id: 'scene_002',
      summary: 'A tense confrontation in the forest',
      mood: 'tense',
      intensity: 0.8,
      dialogue: [
        {
          line_id: 'line_001',
          character: 'Hero',
          text: 'Who goes there?',
          voice_key: 'voice_hero',
        },
      ],
      music: [{ file: 'music/tense_001.mp3' }],
      ambience: [{ file: 'ambience/forest_night.wav' }],
      sfx: [{ file: 'sfx/footsteps.wav', start_at: 'line_001' }],
    };

    const result = SceneSchema.safeParse(fullScene);
    expect(result.success).toBe(true);
  });

  it('should reject scene without scene_id', () => {
    const invalidScene = {
      dialogue: [],
    };

    const result = SceneSchema.safeParse(invalidScene);
    expect(result.success).toBe(false);
  });

  it('should accept empty dialogue array', () => {
    const sceneNoDialogue = {
      scene_id: 'scene_003',
      dialogue: [],
    };

    const result = SceneSchema.safeParse(sceneNoDialogue);
    expect(result.success).toBe(true);
  });

  it('should validate intensity range (0-1)', () => {
    const validIntensity = {
      scene_id: 'scene_004',
      dialogue: [],
      intensity: 0.5,
    };

    const result = SceneSchema.safeParse(validIntensity);
    expect(result.success).toBe(true);
  });
});

describe('DirectorJSONSchema', () => {
  it('should validate complete Director JSON', () => {
    const directorJson: DirectorJSON = {
      project_id: '00000000-0000-0000-0000-000000000001',
      scenes: [
        {
          scene_id: 'scene_001',
          dialogue: [
            {
              line_id: 'line_001',
              character: 'Alice',
              text: 'Welcome!',
              voice_key: 'voice_alice',
            },
          ],
        },
      ],
    };

    const result = DirectorJSONSchema.safeParse(directorJson);
    expect(result.success).toBe(true);
  });

  it('should validate Director JSON with multiple scenes', () => {
    const multiScene = {
      project_id: '00000000-0000-0000-0000-000000000002',
      script_id: 'script_001',
      scenes: [
        {
          scene_id: 'scene_001',
          dialogue: [{ line_id: 'line_001', character: 'A', text: 'Hi', voice_key: 'v1' }],
        },
        {
          scene_id: 'scene_002',
          dialogue: [{ line_id: 'line_002', character: 'B', text: 'Hello', voice_key: 'v2' }],
        },
        {
          scene_id: 'scene_003',
          dialogue: [{ line_id: 'line_003', character: 'C', text: 'Hey', voice_key: 'v3' }],
        },
      ],
    };

    const result = DirectorJSONSchema.safeParse(multiScene);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scenes).toHaveLength(3);
    }
  });

  it('should reject Director JSON without project_id', () => {
    const invalid = {
      scenes: [],
    };

    const result = DirectorJSONSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should accept empty scenes array', () => {
    const emptyScenes = {
      project_id: '00000000-0000-0000-0000-000000000003',
      scenes: [],
    };

    const result = DirectorJSONSchema.safeParse(emptyScenes);
    expect(result.success).toBe(true);
  });
});

describe('OrchestrateRequestSchema', () => {
  it('should validate request with scenes', () => {
    const request = {
      project_id: '00000000-0000-0000-0000-000000000001',
      scenes: [
        {
          scene_id: 'scene_001',
          dialogue: [
            { line_id: 'line_001', character: 'Test', text: 'Hello', voice_key: 'voice_test' },
          ],
        },
      ],
    };

    const result = OrchestrateRequestSchema.safeParse(request);
    expect(result.success).toBe(true);
  });

  it('should validate request with script_text and empty scenes', () => {
    const request = {
      project_id: '00000000-0000-0000-0000-000000000002',
      script_text: 'FADE IN:\n\nINT. HOUSE - DAY\n\nJOHN\nHello there.',
      scenes: [], // scenes is required
    };

    const result = OrchestrateRequestSchema.safeParse(request);
    expect(result.success).toBe(true);
  });

  it('should validate request with both scenes and script_text', () => {
    const request = {
      project_id: '00000000-0000-0000-0000-000000000003',
      script_text: 'Some script...',
      scenes: [],
    };

    const result = OrchestrateRequestSchema.safeParse(request);
    expect(result.success).toBe(true);
  });

  it('should reject request without project_id', () => {
    const invalid = {
      scenes: [],
    };

    const result = OrchestrateRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('GenerateScenesRequestSchema', () => {
  it('should validate valid generate-scenes request', () => {
    const request = {
      project_id: '00000000-0000-0000-0000-000000000001',
      script_text: 'FADE IN:\n\nINT. OFFICE - DAY\n\nBOSS\nWelcome to the company.',
    };

    const result = GenerateScenesRequestSchema.safeParse(request);
    expect(result.success).toBe(true);
  });

  it('should reject request without script_text', () => {
    const invalid = {
      project_id: '00000000-0000-0000-0000-000000000002',
    };

    const result = GenerateScenesRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject empty script_text', () => {
    const emptyScript = {
      project_id: '00000000-0000-0000-0000-000000000003',
      script_text: '',
    };

    // Schema has min(1) so empty string should fail
    const result = GenerateScenesRequestSchema.safeParse(emptyScript);
    expect(result.success).toBe(false);
  });
});

describe('Schema Type Inference', () => {
  it('should correctly infer DialogueLine type', () => {
    const line: DialogueLine = {
      line_id: 'line_001',
      character: 'Test',
      text: 'Hello',
      voice_key: 'voice_test',
    };

    // TypeScript will error if types don't match
    expect(line.line_id).toBe('line_001');
    expect(line.character).toBe('Test');
  });

  it('should correctly infer Scene type', () => {
    const scene: Scene = {
      scene_id: 'scene_001',
      dialogue: [],
    };

    expect(scene.scene_id).toBe('scene_001');
    expect(scene.dialogue).toEqual([]);
  });

  it('should correctly infer DirectorJSON type', () => {
    const json: DirectorJSON = {
      project_id: '00000000-0000-0000-0000-000000000001',
      scenes: [],
    };

    expect(json.project_id).toBe('00000000-0000-0000-0000-000000000001');
    expect(json.scenes).toEqual([]);
  });
});
