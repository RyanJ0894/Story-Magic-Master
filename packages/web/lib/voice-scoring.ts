/**
 * Voice Scoring - Client-side scoring for voice suggestions
 *
 * Mirrors the orchestrator's single-pass soft scoring model:
 * - Gender: hard gate (mismatch = score 0)
 * - Age: proximity spectrum (adjacent ranges get partial credit)
 * - Style/Accent: soft weight
 * - Narrative: keyword matching against voice name/style/description
 * - Tone: light preference weight
 */

import type { Voice, DetectedCharacter } from '@/lib/types/voice';

type AgeRange = 'child' | 'teen' | 'young_adult' | 'adult' | 'senior';

// Age midpoints for proximity scoring
const AGE_MIDPOINTS: Record<AgeRange, number> = {
  child: 8,
  teen: 16,
  young_adult: 28,
  adult: 35,
  senior: 55,
};

const MAX_AGE_DISTANCE = Math.abs(AGE_MIDPOINTS.child - AGE_MIDPOINTS.senior);

/**
 * Calculate age proximity score (0-1)
 */
function ageProximity(target: AgeRange, voice: AgeRange): number {
  if (target === voice) return 1.0;
  const distance = Math.abs(AGE_MIDPOINTS[target] - AGE_MIDPOINTS[voice]);
  return Math.max(0, 1 - distance / MAX_AGE_DISTANCE);
}

/**
 * Infer an age range from a character's inferred_age string
 */
function parseCharacterAge(age: string | undefined): AgeRange | undefined {
  if (!age) return undefined;
  const lower = age.toLowerCase();
  if (lower.includes('child') || lower.includes('kid')) return 'child';
  if (lower.includes('teen')) return 'teen';
  if (lower.includes('young') || lower.includes('20') || lower.includes('30')) return 'young_adult';
  if (lower.includes('senior') || lower.includes('elder') || lower.includes('old')) return 'senior';
  if (lower.includes('adult') || lower.includes('middle')) return 'adult';
  return undefined;
}

export interface ScoredVoice {
  voice: Voice;
  score: number;
  matchLabel: string; // "Excellent", "Good", "Fair", "Low"
}

/**
 * Score a single voice against character criteria
 */
export function scoreVoice(
  voice: Voice,
  criteria: {
    gender?: 'male' | 'female' | 'unknown';
    age?: AgeRange;
    accent?: string;
    narrative?: string; // Character name + sample lines for keyword matching
    isNarrator?: boolean;
  }
): number {
  // Hard gate: gender mismatch = 0
  if (criteria.gender && criteria.gender !== 'unknown' && voice.gender !== 'neutral') {
    if (voice.gender !== criteria.gender) return 0;
  }

  let score = 0;
  let maxScore = 0;

  // Age proximity (0.30)
  if (criteria.age && voice.age) {
    maxScore += 0.30;
    score += 0.30 * ageProximity(criteria.age, voice.age);
  }

  // Accent/Style (0.25)
  if (criteria.accent) {
    maxScore += 0.25;
    const voiceAccent = (voice.accent || '').toLowerCase();
    const target = criteria.accent.toLowerCase();
    if (voiceAccent === target) {
      score += 0.25;
    } else if (voiceAccent.includes(target) || target.includes(voiceAccent)) {
      score += 0.125;
    }
  }

  // Narrative keyword matching (0.25)
  if (criteria.narrative && criteria.narrative.length > 3) {
    maxScore += 0.25;
    const words = criteria.narrative.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const voiceText = `${voice.name} ${voice.style || ''} ${voice.description || ''} ${voice.tone || ''}`.toLowerCase();
    const matchCount = words.filter(w => voiceText.includes(w)).length;
    if (matchCount > 0) {
      score += 0.25 * Math.min(1, matchCount / Math.max(1, words.length * 0.4));
    }
  }

  // Tone (0.10)
  if (criteria.narrative) {
    // Use narrative keywords to match against tone too
    maxScore += 0.10;
    const voiceTone = (voice.tone || '').toLowerCase();
    if (voiceTone && criteria.narrative.toLowerCase().includes(voiceTone)) {
      score += 0.10;
    }
  }

  // Narrator bonus (0.10)
  if (criteria.isNarrator) {
    maxScore += 0.10;
    const voiceName = voice.name.toLowerCase();
    const voiceTone = (voice.tone || '').toLowerCase();
    if (voiceTone.includes('narrat') || voiceName.includes('narrator') || voiceTone.includes('documentary')) {
      score += 0.10;
    }
  }

  return maxScore > 0 ? score / maxScore : 0;
}

/**
 * Get match quality label from score
 */
function getMatchLabel(score: number): string {
  if (score >= 0.8) return 'Excellent';
  if (score >= 0.6) return 'Good';
  if (score >= 0.35) return 'Fair';
  return 'Low';
}

/**
 * Score and sort all voices for a character
 */
export function getScoredVoices(
  voices: Voice[],
  character: DetectedCharacter,
  excludeVoiceIds: string[] = []
): ScoredVoice[] {
  const isNarrator = character.name.toLowerCase() === 'narrator';

  const criteria = {
    gender: character.inferred_gender,
    age: parseCharacterAge(character.inferred_age),
    narrative: [character.name, ...character.sample_lines].join(' '),
    isNarrator,
  };

  const scored = voices
    .filter(v => !excludeVoiceIds.includes(v.voice_id))
    .map(voice => {
      const score = scoreVoice(voice, criteria);
      return {
        voice,
        score,
        matchLabel: getMatchLabel(score),
      };
    });

  // Sort by score descending, then by custom voices first, then alphabetically
  scored.sort((a, b) => {
    // Score first
    if (Math.abs(a.score - b.score) > 0.01) return b.score - a.score;
    // Custom voices break ties
    if (a.voice.is_custom && !b.voice.is_custom) return -1;
    if (!a.voice.is_custom && b.voice.is_custom) return 1;
    // Then alphabetically
    return a.voice.name.localeCompare(b.voice.name);
  });

  return scored;
}
