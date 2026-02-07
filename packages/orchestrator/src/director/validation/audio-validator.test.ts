/**
 * Unit tests for SceneAudioValidator
 *
 * Tests audio selection validation logic including:
 * - Valid SceneAudioJSON passes validation
 * - Missing music/ambience/sfx arrays are detected
 * - Scene ID mismatch between audio and director JSON
 * - autoCorrect adds missing arrays
 * - Mood contradiction detection
 * - Interior/exterior ambience mismatch
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SceneAudioValidator } from './audio-validator.js';
import { AudioValidationErrorTypes } from './validation-error.js';
import type { DirectorJSON, SceneAudioJSON } from '../../schemas/director-json.js';

// Suppress console output during tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// ---- Test Fixtures ----

function makeDirectorJSON(overrides: Partial<DirectorJSON> = {}): DirectorJSON {
  return {
    project_id: '123e4567-e89b-12d3-a456-426614174000',
    scenes: [
      {
        scene_id: 'scene_001',
        summary: 'Opening scene in the forest',
        mood: 'tense',
        dialogue: [
          {
            line_id: 'line_001',
            character: 'Narrator',
            text: 'EXT. FOREST - NIGHT',
            voice_key: 'pNInz6obpgDQGcFmaJgB',
          },
          {
            line_id: 'line_002',
            character: 'Jake',
            text: 'Did you hear that?',
            voice_key: '29vD33N1CtxCmqQRPOHJ',
          },
        ],
      },
      {
        scene_id: 'scene_002',
        summary: 'Interior office conversation',
        mood: 'calm',
        dialogue: [
          {
            line_id: 'line_003',
            character: 'Narrator',
            text: 'INT. OFFICE - DAY',
            voice_key: 'pNInz6obpgDQGcFmaJgB',
          },
          {
            line_id: 'line_004',
            character: 'Emma',
            text: 'Let us begin the meeting.',
            voice_key: '21m00Tcm4TlvDq8ikWAM',
          },
        ],
      },
    ],
    ...overrides,
  };
}

function makeValidSceneAudioJSON(overrides: Partial<SceneAudioJSON> = {}): SceneAudioJSON {
  return {
    project_id: '123e4567-e89b-12d3-a456-426614174000',
    scenes: [
      {
        scene_id: 'scene_001',
        music: [{ file: 'music/m_tense_orchestral_01.mp3', reasoning: 'Tense mood' }],
        ambience: [{ file: 'ambience/a_forest_calm_01.mp3', reasoning: 'Forest setting' }],
        sfx: [{ file: 'sfx/s_twig_snap_01.mp3', reasoning: 'Twig snap', start_at: 'line_002' }],
      },
      {
        scene_id: 'scene_002',
        music: [{ file: 'music/m_corporate_calm_01.mp3', reasoning: 'Office setting' }],
        ambience: [{ file: 'ambience/a_office_cubicles_01.mp3', reasoning: 'Office ambience' }],
        sfx: [],
      },
    ],
    ...overrides,
  };
}

// ---- Tests ----

describe('SceneAudioValidator', () => {
  let validator: SceneAudioValidator;

  beforeEach(() => {
    validator = new SceneAudioValidator();
  });

  describe('validate()', () => {
    it('should pass validation for valid SceneAudioJSON', () => {
      const directorJson = makeDirectorJSON();
      const audioJson = makeValidSceneAudioJSON();

      const result = validator.validate(audioJson, directorJson);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing music array on a scene', () => {
      const directorJson = makeDirectorJSON();
      const audioJson = makeValidSceneAudioJSON({
        scenes: [
          {
            scene_id: 'scene_001',
            music: [],
            ambience: [{ file: 'ambience/a_forest_calm_01.mp3' }],
            sfx: [],
          },
          {
            scene_id: 'scene_002',
            music: [{ file: 'music/m_corporate_calm_01.mp3' }],
            ambience: [{ file: 'ambience/a_office_cubicles_01.mp3' }],
            sfx: [],
          },
        ],
      });

      const result = validator.validate(audioJson, directorJson);

      expect(result.isValid).toBe(false);
      const missingMusic = result.errors.find(
        (e) => e.errorType === AudioValidationErrorTypes.MISSING_MUSIC
      );
      expect(missingMusic).toBeDefined();
      expect(missingMusic!.message).toContain('scene_001');
    });

    it('should detect missing ambience for scenes at mandatory locations (FOREST)', () => {
      const directorJson = makeDirectorJSON();
      const audioJson = makeValidSceneAudioJSON({
        scenes: [
          {
            scene_id: 'scene_001',
            music: [{ file: 'music/m_tense_orchestral_01.mp3' }],
            ambience: [], // Missing -- forest requires ambience
            sfx: [],
          },
          {
            scene_id: 'scene_002',
            music: [{ file: 'music/m_corporate_calm_01.mp3' }],
            ambience: [{ file: 'ambience/a_office_cubicles_01.mp3' }],
            sfx: [],
          },
        ],
      });

      const result = validator.validate(audioJson, directorJson);

      expect(result.isValid).toBe(false);
      const missingAmbience = result.errors.find(
        (e) => e.errorType === AudioValidationErrorTypes.MISSING_AMBIENCE
      );
      expect(missingAmbience).toBeDefined();
      expect(missingAmbience!.fixData.expected_ambience).toBeDefined();
    });

    it('should skip validation for audio scenes that have no matching director scene', () => {
      const directorJson = makeDirectorJSON({
        scenes: [
          {
            scene_id: 'scene_001',
            dialogue: [
              {
                line_id: 'line_001',
                character: 'Narrator',
                text: 'EXT. FOREST - NIGHT',
                voice_key: 'pNInz6obpgDQGcFmaJgB',
              },
            ],
          },
        ],
      });

      // Audio JSON references scene_999 which does not exist in director JSON
      const audioJson: SceneAudioJSON = {
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        scenes: [
          {
            scene_id: 'scene_999',
            music: [{ file: 'music/m_tense_01.mp3' }],
            ambience: [],
            sfx: [],
          },
        ],
      };

      // Should not crash; the mismatched scene is simply skipped
      const result = validator.validate(audioJson, directorJson);
      expect(result.isValid).toBe(true);
    });

    it('should detect SFX missing start_at trigger reference', () => {
      const directorJson = makeDirectorJSON();
      const audioJson = makeValidSceneAudioJSON({
        scenes: [
          {
            scene_id: 'scene_001',
            music: [{ file: 'music/m_tense_orchestral_01.mp3' }],
            ambience: [{ file: 'ambience/a_forest_calm_01.mp3' }],
            sfx: [
              {
                file: 'sfx/s_twig_snap_01.mp3',
                reasoning: 'Twig snap',
                // Missing start_at
              },
            ],
          },
          {
            scene_id: 'scene_002',
            music: [{ file: 'music/m_corporate_calm_01.mp3' }],
            ambience: [{ file: 'ambience/a_office_cubicles_01.mp3' }],
            sfx: [],
          },
        ],
      });

      const result = validator.validate(audioJson, directorJson);

      expect(result.isValid).toBe(false);
      const sfxError = result.errors.find(
        (e) => e.errorType === AudioValidationErrorTypes.INVALID_SFX_TRIGGER
      );
      expect(sfxError).toBeDefined();
    });

    it('should detect mood contradiction (sad scene with uplifting music)', () => {
      const directorJson = makeDirectorJSON({
        scenes: [
          {
            scene_id: 'scene_001',
            mood: 'sad',
            dialogue: [
              {
                line_id: 'line_001',
                character: 'Narrator',
                text: 'INT. BEDROOM - NIGHT',
                voice_key: 'pNInz6obpgDQGcFmaJgB',
              },
            ],
          },
        ],
      });

      const audioJson: SceneAudioJSON = {
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        scenes: [
          {
            scene_id: 'scene_001',
            music: [{ file: 'music/m_uplifting_pop_01.mp3' }],
            ambience: [],
            sfx: [],
          },
        ],
      };

      const result = validator.validate(audioJson, directorJson);

      expect(result.isValid).toBe(false);
      const moodError = result.errors.find(
        (e) => e.errorType === AudioValidationErrorTypes.MOOD_CONTRADICTION
      );
      expect(moodError).toBeDefined();
    });

    it('should handle empty scenes arrays in both director and audio JSON', () => {
      const directorJson = makeDirectorJSON({ scenes: [] });
      const audioJson: SceneAudioJSON = {
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        scenes: [],
      };

      const result = validator.validate(audioJson, directorJson);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('autoCorrect()', () => {
    it('should add default music to scenes missing music', () => {
      const directorJson = makeDirectorJSON({
        scenes: [
          {
            scene_id: 'scene_001',
            mood: 'neutral',
            dialogue: [
              {
                line_id: 'line_001',
                character: 'Narrator',
                text: 'INT. BEDROOM - DAY',
                voice_key: 'pNInz6obpgDQGcFmaJgB',
              },
            ],
          },
        ],
      });

      const audioJson: SceneAudioJSON = {
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        scenes: [
          {
            scene_id: 'scene_001',
            music: [],
            ambience: [],
            sfx: [],
          },
        ],
      };

      const corrected = validator.autoCorrect(audioJson, directorJson);

      expect(corrected.scenes[0].music).toBeDefined();
      expect(corrected.scenes[0].music!.length).toBeGreaterThan(0);
      expect(corrected.scenes[0].music![0].file).toContain('music/');
    });

    it('should add required ambience for mandatory locations', () => {
      const directorJson = makeDirectorJSON({
        scenes: [
          {
            scene_id: 'scene_001',
            mood: 'tense',
            dialogue: [
              {
                line_id: 'line_001',
                character: 'Narrator',
                text: 'EXT. FOREST - NIGHT',
                voice_key: 'pNInz6obpgDQGcFmaJgB',
              },
            ],
          },
        ],
      });

      const audioJson: SceneAudioJSON = {
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        scenes: [
          {
            scene_id: 'scene_001',
            music: [{ file: 'music/m_tense_01.mp3' }],
            ambience: [], // Missing forest ambience
            sfx: [],
          },
        ],
      };

      const corrected = validator.autoCorrect(audioJson, directorJson);

      expect(corrected.scenes[0].ambience).toBeDefined();
      expect(corrected.scenes[0].ambience!.length).toBeGreaterThan(0);
      expect(corrected.scenes[0].ambience![0].file).toContain('ambience/');
    });

    it('should not modify already valid SceneAudioJSON', () => {
      const directorJson = makeDirectorJSON();
      const audioJson = makeValidSceneAudioJSON();

      const corrected = validator.autoCorrect(audioJson, directorJson);

      // Music and ambience should remain unchanged
      expect(corrected.scenes[0].music![0].file).toBe('music/m_tense_orchestral_01.mp3');
      expect(corrected.scenes[0].ambience![0].file).toBe('ambience/a_forest_calm_01.mp3');
    });

    it('should handle empty scenes in autoCorrect without throwing', () => {
      const directorJson = makeDirectorJSON({ scenes: [] });
      const audioJson: SceneAudioJSON = {
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        scenes: [],
      };

      const corrected = validator.autoCorrect(audioJson, directorJson);
      expect(corrected.scenes).toHaveLength(0);
    });
  });
});
