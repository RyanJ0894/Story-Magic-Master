/**
 * Voice Scoring Tests
 *
 * Tests the client-side voice scoring that powers
 * the Voice Chooser dropdown sorting.
 */

import { describe, it, expect } from 'vitest';
import { scoreVoice, getScoredVoices, type ScoredVoice } from '@/lib/voice-scoring';
import type { Voice, DetectedCharacter } from '@/lib/types/voice';

// Test voice fixtures
const voices: Voice[] = [
  { voice_id: 'v1', name: 'Roger - Laid-Back, Casual', gender: 'male', age: 'adult', accent: 'American', style: 'Laid-Back, Casual, Resonant', tone: 'classy' },
  { voice_id: 'v2', name: 'Sarah - Mature, Confident', gender: 'female', age: 'adult', accent: 'American', style: 'Mature, Reassuring', tone: 'professional' },
  { voice_id: 'v3', name: 'Harry - Fierce Warrior', gender: 'male', age: 'young_adult', accent: 'American', style: 'Fierce Warrior', tone: 'rough' },
  { voice_id: 'v4', name: 'Laura - Quirky Attitude', gender: 'female', age: 'young_adult', accent: 'American', style: 'Enthusiast, Quirky', tone: 'sassy' },
  { voice_id: 'v5', name: 'George - Warm Storyteller', gender: 'male', age: 'senior', accent: 'British', style: 'Warm, Captivating Storyteller', tone: 'mature' },
  { voice_id: 'v6', name: 'Lily - Warm, Gentle', gender: 'female', age: 'young_adult', accent: 'British', style: 'Warm, Gentle', tone: 'soft' },
  { voice_id: 'v7', name: 'Brian - Deep Narrative', gender: 'male', age: 'adult', accent: 'American', style: 'Deep, Narrative', tone: 'narration' },
];

describe('Voice Scoring', () => {
  describe('scoreVoice', () => {
    it('should return 0 for gender mismatch', () => {
      const score = scoreVoice(voices[0], { gender: 'female' }); // Roger is male
      expect(score).toBe(0);
    });

    it('should not penalize when no gender specified', () => {
      const score = scoreVoice(voices[0], { narrative: 'laid-back casual character' });
      expect(score).toBeGreaterThan(0);
    });

    it('should score higher for exact age match', () => {
      const exactAge = scoreVoice(voices[3], { gender: 'female', age: 'young_adult' }); // Laura, young_adult
      const wrongAge = scoreVoice(voices[1], { gender: 'female', age: 'young_adult' }); // Sarah, adult
      expect(exactAge).toBeGreaterThan(wrongAge);
    });

    it('should give partial credit for adjacent age', () => {
      // adult (35) searching for young_adult (28) = adjacent
      const score = scoreVoice(voices[1], { gender: 'female', age: 'young_adult' });
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });

    it('should score accent match higher', () => {
      const britishMatch = scoreVoice(voices[5], { gender: 'female', accent: 'British' }); // Lily, British
      const americanMismatch = scoreVoice(voices[3], { gender: 'female', accent: 'British' }); // Laura, American
      expect(britishMatch).toBeGreaterThan(americanMismatch);
    });

    it('should match narrative keywords against voice name/style', () => {
      const warriorVoice = scoreVoice(voices[2], { gender: 'male', narrative: 'fierce warrior commanding' });
      const casualVoice = scoreVoice(voices[0], { gender: 'male', narrative: 'fierce warrior commanding' });
      expect(warriorVoice).toBeGreaterThan(casualVoice);
    });

    it('should give narrator bonus for narration voices', () => {
      const narratorVoice = scoreVoice(voices[6], { gender: 'male', isNarrator: true }); // Brian, narration tone
      const regularVoice = scoreVoice(voices[0], { gender: 'male', isNarrator: true }); // Roger, classy tone
      expect(narratorVoice).toBeGreaterThan(regularVoice);
    });
  });

  describe('getScoredVoices', () => {
    it('should return all voices sorted by score', () => {
      const character: DetectedCharacter = {
        name: 'Fierce Commander',
        line_count: 10,
        first_appearance: 1,
        sample_lines: ['Attack the enemy!', 'Stand your ground!'],
        inferred_gender: 'male',
      };

      const scored = getScoredVoices(voices, character);

      // Should return all male voices (gender gate removes females)
      const maleVoices = scored.filter(sv => sv.voice.gender === 'male');
      const femaleVoices = scored.filter(sv => sv.voice.gender === 'female');

      expect(maleVoices.length).toBeGreaterThan(0);
      // Female voices should have score 0 and be at the bottom
      femaleVoices.forEach(sv => expect(sv.score).toBe(0));

      // Should be sorted descending
      for (let i = 1; i < scored.length; i++) {
        expect(scored[i - 1].score).toBeGreaterThanOrEqual(scored[i].score - 0.01);
      }
    });

    it('should exclude specified voice IDs', () => {
      const character: DetectedCharacter = {
        name: 'Test Character',
        line_count: 5,
        first_appearance: 1,
        sample_lines: ['Hello world'],
        inferred_gender: 'male',
      };

      const scored = getScoredVoices(voices, character, ['v1', 'v3']);

      const ids = scored.map(sv => sv.voice.voice_id);
      expect(ids).not.toContain('v1');
      expect(ids).not.toContain('v3');
    });

    it('should include match labels', () => {
      const character: DetectedCharacter = {
        name: 'Warrior',
        line_count: 5,
        first_appearance: 1,
        sample_lines: ['Fight!'],
        inferred_gender: 'male',
      };

      const scored = getScoredVoices(voices, character);

      scored.forEach(sv => {
        expect(['Excellent', 'Good', 'Fair', 'Low']).toContain(sv.matchLabel);
      });
    });

    it('should rank narrator-like voices first for Narrator character', () => {
      const narrator: DetectedCharacter = {
        name: 'Narrator',
        line_count: 20,
        first_appearance: 0,
        sample_lines: ['Once upon a time...'],
      };

      const scored = getScoredVoices(voices, narrator);

      // Brian (narration tone) should rank highly
      const brianIndex = scored.findIndex(sv => sv.voice.voice_id === 'v7');
      expect(brianIndex).toBeLessThan(scored.length / 2); // Should be in top half
    });
  });
});
