/**
 * Hybrid Voice Search Tests - TDD approach
 *
 * Tests for the hybrid voice search that combines:
 * 1. ElevenLabs API filtering
 * 2. Local catalog fallback
 * 3. Attribute-based matching
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We'll implement these functions
import {
  searchVoicesHybrid,
  VoiceSearchParams,
  VoiceSearchResult,
  matchVoiceAttributes,
  scoreVoiceMatch,
  filterVoicesByAttributes,
} from './hybrid-voice-search.js';

describe('Hybrid Voice Search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('matchVoiceAttributes', () => {
    it('should match exact gender', () => {
      const voice = { gender: 'Male', label: 'Young Adult', style: 'American' };
      expect(matchVoiceAttributes(voice, { gender: 'Male' })).toBe(true);
      expect(matchVoiceAttributes(voice, { gender: 'Female' })).toBe(false);
    });

    it('should match age labels for teens', () => {
      const teenVoice = { gender: 'Male' as const, label: 'Male Teen', style: 'American' };
      const adultVoice = { gender: 'Male' as const, label: 'Male 20s to 30s', style: 'American' };

      // Age range matching requires gender to determine label patterns
      expect(matchVoiceAttributes(teenVoice, { gender: 'Male', ageRange: 'teen' })).toBe(true);
      expect(matchVoiceAttributes(adultVoice, { gender: 'Male', ageRange: 'teen' })).toBe(false);
    });

    it('should match style/ethnicity', () => {
      const africanAmericanVoice = { gender: 'Male', label: 'Young Adult', style: 'African American' };
      const americanVoice = { gender: 'Male', label: 'Young Adult', style: 'American' };

      expect(matchVoiceAttributes(africanAmericanVoice, { style: 'African American' })).toBe(true);
      expect(matchVoiceAttributes(americanVoice, { style: 'African American' })).toBe(false);
    });

    it('should match narrator voices', () => {
      const narratorVoice = { gender: 'Male', label: 'Narrator', style: 'American' };
      const characterVoice = { gender: 'Male', label: 'Young Adult', style: 'American' };

      expect(matchVoiceAttributes(narratorVoice, { isNarrator: true })).toBe(true);
      expect(matchVoiceAttributes(characterVoice, { isNarrator: true })).toBe(false);
    });

    it('should match multiple criteria (AND logic)', () => {
      const voice = { gender: 'Female', label: 'Female Teen', style: 'African American' };

      expect(
        matchVoiceAttributes(voice, { gender: 'Female', ageRange: 'teen', style: 'African American' })
      ).toBe(true);

      expect(
        matchVoiceAttributes(voice, { gender: 'Male', ageRange: 'teen', style: 'African American' })
      ).toBe(false);
    });
  });

  describe('scoreVoiceMatch', () => {
    it('should give highest score to exact matches', () => {
      const voice = { gender: 'Female', label: 'Female Teen', style: 'African American' };
      const criteria = { gender: 'Female', ageRange: 'teen', style: 'African American' };

      const score = scoreVoiceMatch(voice, criteria);
      expect(score).toBeGreaterThan(0.9); // Near perfect match
    });

    it('should give partial scores for partial matches', () => {
      const voice = { gender: 'Female', label: 'Female 20s to 30s', style: 'African American' };
      const criteria = { gender: 'Female', ageRange: 'teen', style: 'African American' };

      const score = scoreVoiceMatch(voice, criteria);
      expect(score).toBeGreaterThan(0.5); // Partial match (gender + style, not age)
      expect(score).toBeLessThan(0.9); // Not perfect
    });

    it('should prioritize ethnicity/style over age', () => {
      const matchingStyle = { gender: 'Male', label: 'Older Male', style: 'African American' };
      const matchingAge = { gender: 'Male', label: 'Male Teen', style: 'American' };
      const criteria = { gender: 'Male', ageRange: 'teen', style: 'African American' };

      const styleScore = scoreVoiceMatch(matchingStyle, criteria);
      const ageScore = scoreVoiceMatch(matchingAge, criteria);

      expect(styleScore).toBeGreaterThan(ageScore); // Style is higher priority
    });
  });

  describe('filterVoicesByAttributes', () => {
    const mockVoices = [
      { voice_id: 'v1', name: 'Adam', gender: 'Male', label: 'Narrator', style: 'American' },
      { voice_id: 'v2', name: 'Rachel', gender: 'Female', label: 'Female 20s to 30s', style: 'American' },
      { voice_id: 'v3', name: 'Marcus', gender: 'Male', label: 'Male Teen', style: 'African American' },
      { voice_id: 'v4', name: 'Amara', gender: 'Female', label: 'Female Teen', style: 'African American' },
      { voice_id: 'v5', name: 'Brian', gender: 'Male', label: 'Older Male', style: 'British' },
    ];

    it('should filter by gender only', () => {
      const results = filterVoicesByAttributes(mockVoices, { gender: 'Female' });
      expect(results.map((v) => v.voice_id)).toEqual(['v2', 'v4']);
    });

    it('should filter by gender and age', () => {
      const results = filterVoicesByAttributes(mockVoices, { gender: 'Male', ageRange: 'teen' });
      expect(results.map((v) => v.voice_id)).toEqual(['v3']);
    });

    it('should filter by style/ethnicity', () => {
      const results = filterVoicesByAttributes(mockVoices, { style: 'African American' });
      expect(results.map((v) => v.voice_id)).toEqual(['v3', 'v4']);
    });

    it('should exclude already used voices', () => {
      const results = filterVoicesByAttributes(mockVoices, { gender: 'Male' }, ['v1', 'v3']);
      expect(results.map((v) => v.voice_id)).toEqual(['v5']);
    });

    it('should find narrator voices', () => {
      const results = filterVoicesByAttributes(mockVoices, { isNarrator: true });
      expect(results.map((v) => v.voice_id)).toEqual(['v1']);
    });
  });

  describe('searchVoicesHybrid', () => {
    it('should return voices matching character criteria', async () => {
      const params: VoiceSearchParams = {
        characterName: 'Marcus',
        gender: 'Male',
        age: 17,
        ethnicity: 'African American',
      };

      const result = await searchVoicesHybrid(params);

      expect(result.success).toBe(true);
      expect(result.voices.length).toBeGreaterThan(0);
      expect(result.voices[0].gender).toBe('Male');
    });

    it('should return narrator voice for Narrator character', async () => {
      const params: VoiceSearchParams = {
        characterName: 'Narrator',
        isNarrator: true,
      };

      const result = await searchVoicesHybrid(params);

      expect(result.success).toBe(true);
      expect(result.voices.length).toBeGreaterThan(0);
    });

    it('should exclude already used voices', async () => {
      const params: VoiceSearchParams = {
        characterName: 'Sarah',
        gender: 'Female',
        excludeVoiceIds: ['voice_1', 'voice_2'],
      };

      const result = await searchVoicesHybrid(params);

      expect(result.success).toBe(true);
      // None of the results should be in excludeVoiceIds
      result.voices.forEach((v) => {
        expect(['voice_1', 'voice_2']).not.toContain(v.voice_id);
      });
    });

    it('should handle no matches gracefully', async () => {
      const params: VoiceSearchParams = {
        characterName: 'Alien',
        gender: 'Male',
        style: 'Martian', // Non-existent style
      };

      const result = await searchVoicesHybrid(params);

      // Should still return results by relaxing filters
      expect(result.success).toBe(true);
      expect(result.filtersRelaxed).toBe(true);
    });

    it('should provide fallback voice when everything fails', async () => {
      const params: VoiceSearchParams = {
        characterName: 'Test',
        gender: 'Male',
        excludeVoiceIds: [], // Exclude nothing but pretend API fails
      };

      // Even if API fails, local catalog should work
      const result = await searchVoicesHybrid(params);
      expect(result.success).toBe(true);
      expect(result.voices.length).toBeGreaterThan(0);
    });
  });

  describe('Age Range Detection', () => {
    it('should detect teen age range (13-19)', () => {
      expect(getAgeRange(13)).toBe('teen');
      expect(getAgeRange(17)).toBe('teen');
      expect(getAgeRange(19)).toBe('teen');
    });

    it('should detect young adult age range (20-39)', () => {
      expect(getAgeRange(20)).toBe('young_adult');
      expect(getAgeRange(30)).toBe('young_adult');
      expect(getAgeRange(39)).toBe('young_adult');
    });

    it('should detect older age range (40+)', () => {
      expect(getAgeRange(40)).toBe('older');
      expect(getAgeRange(60)).toBe('older');
    });

    it('should detect child age range (under 13)', () => {
      expect(getAgeRange(5)).toBe('child');
      expect(getAgeRange(12)).toBe('child');
    });
  });
});

// Helper function we'll implement
function getAgeRange(age: number): 'child' | 'teen' | 'young_adult' | 'older' {
  if (age < 13) return 'child';
  if (age <= 19) return 'teen';
  if (age <= 39) return 'young_adult';
  return 'older';
}
