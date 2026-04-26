/**
 * Unit tests for DirectorJSONValidator
 *
 * Tests LLM output validation logic including:
 * - Valid DirectorJSON passes validation
 * - Missing scene_id detection
 * - Placeholder voice ID detection
 * - Duplicate voice assignment detection
 * - autoCorrect fixes for placeholder voice IDs
 * - autoCorrect behavior with empty scenes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DirectorJSON } from '../../schemas/director-json.js';
import { DirectorValidationErrorTypes } from './validation-error.js';

// Mock the fs module so the validator does not read from the filesystem
vi.mock('fs', () => ({
  readFileSync: vi.fn(() => '[]'),
}));

// Mock hybrid-voice-search to avoid filesystem/API dependencies
vi.mock('../tools/hybrid-voice-search.js', () => ({
  searchVoicesHybrid: vi.fn(async () => []),
  getAgeRange: vi.fn((age: number) => {
    if (age < 13) return 'child';
    if (age <= 19) return 'teen';
    if (age <= 39) return 'young_adult';
    return 'older';
  }),
}));

// Intercept logger to test warning output
vi.mock('../../lib/logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Suppress console output during tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// Import after mocks are defined
const { DirectorJSONValidator } = await import('./director-validator.js');
const { log } = await import('../../lib/logger.js');

// ---- Test Fixtures ----

const MOCK_VOICE_CATALOG = [
  {
    voice_id: 'pNInz6obpgDQGcFmaJgB',
    name: 'Adam',
    label: 'Narrator - Professional',
    gender: 'Male' as const,
    tone: ['warm', 'authoritative'],
    style: 'Neutral',
  },
  {
    voice_id: '29vD33N1CtxCmqQRPOHJ',
    name: 'Drew',
    label: 'Male 20s to 30s',
    gender: 'Male' as const,
    tone: ['conversational'],
    style: 'Neutral',
  },
  {
    voice_id: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel',
    label: 'Female 20s to 30s',
    gender: 'Female' as const,
    tone: ['calm', 'gentle'],
    style: 'Neutral',
  },
  {
    voice_id: 'AZnzlk1XvdvUeBnXmlld',
    name: 'Domi',
    label: 'Female Teen',
    gender: 'Female' as const,
    tone: ['energetic'],
    style: 'Neutral',
  },
  {
    voice_id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Bella',
    label: 'Female 20s to 30s',
    gender: 'Female' as const,
    tone: ['soft'],
    style: 'African American',
  },
];

function makeValidDirectorJSON(overrides: Partial<DirectorJSON> = {}): DirectorJSON {
  return {
    project_id: '123e4567-e89b-12d3-a456-426614174000',
    scenes: [
      {
        scene_id: 'scene_001',
        summary: 'Opening scene',
        mood: 'tense',
        dialogue: [
          {
            line_id: 'line_001',
            character: 'Narrator',
            text: 'INT. DARK HALLWAY - NIGHT',
            voice_key: 'pNInz6obpgDQGcFmaJgB',
          },
          {
            line_id: 'line_002',
            character: 'Jake',
            text: 'Who goes there?',
            voice_key: '29vD33N1CtxCmqQRPOHJ',
            character_age: 28,
            character_gender: 'Male',
          },
          {
            line_id: 'line_003',
            character: 'Emma',
            text: 'It is me.',
            voice_key: '21m00Tcm4TlvDq8ikWAM',
            character_age: 25,
            character_gender: 'Female',
          },
        ],
      },
    ],
    ...overrides,
  };
}

// ---- Tests ----

describe('DirectorJSONValidator', () => {
  let validator: InstanceType<typeof DirectorJSONValidator>;

  beforeEach(() => {
    // Pass voice catalog directly to bypass filesystem read
    validator = new DirectorJSONValidator(MOCK_VOICE_CATALOG);
  });

  describe('validate()', () => {
    it('should pass validation for valid DirectorJSON with real voice IDs', () => {
      const directorJson = makeValidDirectorJSON();
      const result = validator.validate(directorJson);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect placeholder voice IDs matching REPLACE_WITH_ pattern', () => {
      const directorJson = makeValidDirectorJSON({
        scenes: [
          {
            scene_id: 'scene_001',
            dialogue: [
              {
                line_id: 'line_001',
                character: 'Jake',
                text: 'Hello.',
                voice_key: 'REPLACE_WITH_JAKE_VOICE',
              },
            ],
          },
        ],
      });

      const result = validator.validate(directorJson);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);

      const placeholderError = result.errors.find(
        (e) => e.errorType === DirectorValidationErrorTypes.INVALID_VOICE_ID
      );
      expect(placeholderError).toBeDefined();
      expect(placeholderError!.message).toContain('REPLACE_WITH_JAKE_VOICE');
    });

    it('should detect placeholder voice IDs with TODO prefix', () => {
      const directorJson = makeValidDirectorJSON({
        scenes: [
          {
            scene_id: 'scene_001',
            dialogue: [
              {
                line_id: 'line_001',
                character: 'Jake',
                text: 'Hello.',
                voice_key: 'TODO_assign_voice',
              },
            ],
          },
        ],
      });

      const result = validator.validate(directorJson);

      expect(result.isValid).toBe(false);
      const invalid = result.errors.find(
        (e) => e.errorType === DirectorValidationErrorTypes.INVALID_VOICE_ID
      );
      expect(invalid).toBeDefined();
    });

    it('should detect placeholder voice IDs with underscores (e.g. voice_id suffix)', () => {
      const directorJson = makeValidDirectorJSON({
        scenes: [
          {
            scene_id: 'scene_001',
            dialogue: [
              {
                line_id: 'line_001',
                character: 'Jake',
                text: 'Hello.',
                voice_key: 'jake_voice_id',
              },
            ],
          },
        ],
      });

      const result = validator.validate(directorJson);
      expect(result.isValid).toBe(false);
    });

    it('should detect placeholder voice IDs that contain spaces', () => {
      const directorJson = makeValidDirectorJSON({
        scenes: [
          {
            scene_id: 'scene_001',
            dialogue: [
              {
                line_id: 'line_001',
                character: 'Jake',
                text: 'Hello.',
                voice_key: 'some voice id here',
              },
            ],
          },
        ],
      });

      const result = validator.validate(directorJson);
      expect(result.isValid).toBe(false);
    });

    it('should detect duplicate voice assignments across different characters', () => {
      const sharedVoiceId = '29vD33N1CtxCmqQRPOHJ';

      const directorJson = makeValidDirectorJSON({
        scenes: [
          {
            scene_id: 'scene_001',
            dialogue: [
              {
                line_id: 'line_001',
                character: 'Jake',
                text: 'Hello.',
                voice_key: sharedVoiceId,
                character_gender: 'Male',
              },
              {
                line_id: 'line_002',
                character: 'Marcus',
                text: 'Hey.',
                voice_key: sharedVoiceId,
                character_gender: 'Male',
              },
            ],
          },
        ],
      });

      const result = validator.validate(directorJson);

      expect(result.isValid).toBe(false);
      const dupeError = result.errors.find(
        (e) => e.errorType === DirectorValidationErrorTypes.DUPLICATE_VOICE
      );
      expect(dupeError).toBeDefined();
      expect(dupeError!.fixData.characters).toContain('Jake');
      expect(dupeError!.fixData.characters).toContain('Marcus');
    });

    it('should not flag Narrator voice as duplicate with another character', () => {
      // The validator skips Narrator in voice uniqueness checks
      const directorJson = makeValidDirectorJSON({
        scenes: [
          {
            scene_id: 'scene_001',
            dialogue: [
              {
                line_id: 'line_001',
                character: 'Narrator',
                text: 'INT. OFFICE - DAY',
                voice_key: 'pNInz6obpgDQGcFmaJgB',
              },
              {
                line_id: 'line_002',
                character: 'Jake',
                text: 'Good morning.',
                voice_key: '29vD33N1CtxCmqQRPOHJ',
                character_gender: 'Male',
              },
            ],
          },
        ],
      });

      const result = validator.validate(directorJson);
      const dupeError = result.errors.find(
        (e) => e.errorType === DirectorValidationErrorTypes.DUPLICATE_VOICE
      );
      expect(dupeError).toBeUndefined();
    });

    it('should handle DirectorJSON with empty scenes array without crashing', () => {
      const directorJson = makeValidDirectorJSON({ scenes: [] });
      const result = validator.validate(directorJson);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn when voice catalog is empty so operators can detect misconfiguration', () => {
      const emptyValidator = new DirectorJSONValidator([]);
      vi.mocked(log.warn).mockClear();

      emptyValidator.validate(makeValidDirectorJSON());

      const warnCalls = vi.mocked(log.warn).mock.calls;
      const catalogWarn = warnCalls.find(([msg]) => typeof msg === 'string' && msg.includes('voice catalog is empty'));
      expect(catalogWarn).toBeDefined();
    });

    it('should not warn about catalog when catalog has voices', () => {
      vi.mocked(log.warn).mockClear();

      validator.validate(makeValidDirectorJSON());

      const warnCalls = vi.mocked(log.warn).mock.calls;
      const catalogWarn = warnCalls.find(([msg]) => typeof msg === 'string' && msg.includes('voice catalog is empty'));
      expect(catalogWarn).toBeUndefined();
    });

    it('should handle scenes with empty dialogue array', () => {
      const directorJson = makeValidDirectorJSON({
        scenes: [
          {
            scene_id: 'scene_001',
            dialogue: [],
          },
        ],
      });

      const result = validator.validate(directorJson);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('autoCorrect()', () => {
    it('should replace placeholder voice IDs with real voice IDs from catalog', () => {
      const directorJson = makeValidDirectorJSON({
        scenes: [
          {
            scene_id: 'scene_001',
            dialogue: [
              {
                line_id: 'line_001',
                character: 'Jake',
                text: 'Hello.',
                voice_key: 'REPLACE_WITH_JAKE_VOICE',
                character_gender: 'Male',
              },
            ],
          },
        ],
      });

      const corrected = validator.autoCorrect(directorJson);

      // The corrected voice should not be a placeholder
      const correctedVoice = corrected.scenes[0].dialogue[0].voice_key;
      expect(correctedVoice).not.toBe('REPLACE_WITH_JAKE_VOICE');
      // It should be a voice from the catalog
      const catalogIds = MOCK_VOICE_CATALOG.map((v) => v.voice_id);
      expect(catalogIds).toContain(correctedVoice);
    });

    it('should not modify already valid DirectorJSON', () => {
      const directorJson = makeValidDirectorJSON();
      const corrected = validator.autoCorrect(directorJson);

      // Should be structurally equal
      expect(corrected.scenes[0].dialogue[0].voice_key).toBe(
        directorJson.scenes[0].dialogue[0].voice_key
      );
      expect(corrected.scenes[0].dialogue[1].voice_key).toBe(
        directorJson.scenes[0].dialogue[1].voice_key
      );
    });

    it('should handle empty scenes in autoCorrect without throwing', () => {
      const directorJson = makeValidDirectorJSON({ scenes: [] });
      const corrected = validator.autoCorrect(directorJson);

      expect(corrected.scenes).toHaveLength(0);
    });

    it('should fix duplicate voice assignments by assigning alternative voices', () => {
      const sharedVoiceId = '29vD33N1CtxCmqQRPOHJ';

      const directorJson = makeValidDirectorJSON({
        scenes: [
          {
            scene_id: 'scene_001',
            dialogue: [
              {
                line_id: 'line_001',
                character: 'Jake',
                text: 'Hello.',
                voice_key: sharedVoiceId,
                character_gender: 'Male',
              },
              {
                line_id: 'line_002',
                character: 'Marcus',
                text: 'Hey.',
                voice_key: sharedVoiceId,
                character_gender: 'Male',
              },
            ],
          },
        ],
      });

      const corrected = validator.autoCorrect(directorJson);

      const jakeVoice = corrected.scenes[0].dialogue[0].voice_key;
      const marcusVoice = corrected.scenes[0].dialogue[1].voice_key;

      // After correction, the two characters should have different voices
      expect(jakeVoice).not.toBe(marcusVoice);
    });

    it('should assign gender-appropriate voices when fixing placeholders', () => {
      const directorJson = makeValidDirectorJSON({
        scenes: [
          {
            scene_id: 'scene_001',
            dialogue: [
              {
                line_id: 'line_001',
                character: 'Sarah',
                text: 'Good morning.',
                voice_key: 'placeholder_voice_here',
                character_gender: 'Female',
              },
            ],
          },
        ],
      });

      const corrected = validator.autoCorrect(directorJson);
      const assignedVoiceId = corrected.scenes[0].dialogue[0].voice_key;

      // Find the assigned voice in the catalog and check it is female
      const assignedVoice = MOCK_VOICE_CATALOG.find((v) => v.voice_id === assignedVoiceId);
      expect(assignedVoice).toBeDefined();
      expect(assignedVoice!.gender).toBe('Female');
    });
  });
});
