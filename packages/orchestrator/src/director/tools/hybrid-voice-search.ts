/**
 * Hybrid Voice Search - Single-pass soft scoring with gender gate
 *
 * Architecture:
 * 1. Score every voice in catalog (gender mismatch = instant 0)
 * 2. Age uses proximity scoring (adjacent ranges get partial credit)
 * 3. Style, narrative, tone are weighted soft scores
 * 4. Fallback to ElevenLabs API if local catalog is empty
 * 5. Ultimate fallback: default voices
 *
 * Scoring model:
 * - Gender: hard gate (mismatch = score 0, match = no bonus, just eligible)
 * - Age proximity: 0.30 (closer age range = higher score)
 * - Style/Ethnicity: 0.25 (exact > partial > none)
 * - Narrative query: 0.25 (keyword match against voice name/description)
 * - Tone: 0.10 (voice quality preference)
 * - Narrator: 0.10 (bonus for narrator-labeled voices when searching for narrator)
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { log } from '../../lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to local voice catalog
const VOICE_CATALOG_PATH = join(__dirname, '../../../knowledge_bases/voice_embeddings_store/voices_metadata.json');

// Default fallback voices (always available)
const DEFAULT_VOICES = {
  narrator: { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', gender: 'Male' as const, label: 'Narrator', style: 'American' },
  male: { voice_id: '29vD33N1CtxCmqQRPOHJ', name: 'Drew', gender: 'Male' as const, label: 'Male 20s to 30s', style: 'American' },
  female: { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'Female' as const, label: 'Female 20s to 30s', style: 'American' },
};

// ElevenLabs API config
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Age range midpoints for proximity scoring
const AGE_MIDPOINTS: Record<AgeRange, number> = {
  child: 8,
  teen: 16,
  young_adult: 28,
  older: 50,
};

// Maximum age distance possible (child to older)
const MAX_AGE_DISTANCE = Math.abs(AGE_MIDPOINTS.child - AGE_MIDPOINTS.older);

export interface VoiceMetadata {
  voice_id: string;
  name: string;
  gender: 'Male' | 'Female';
  label: string;
  style: string;
  tone?: string | string[];
  description?: string;
  preview_url?: string;
}

export interface VoiceSearchParams {
  characterName: string;
  gender?: 'Male' | 'Female';
  age?: number;
  ageRange?: 'child' | 'teen' | 'young_adult' | 'older';
  ethnicity?: string;
  style?: string;
  tone?: string;
  isNarrator?: boolean;
  excludeVoiceIds?: string[];
  topK?: number;
}

export interface VoiceSearchResult {
  success: boolean;
  voices: VoiceMetadata[];
  source: 'elevenlabs_api' | 'local_catalog' | 'fallback';
  message?: string;
}

export type AgeRange = 'child' | 'teen' | 'young_adult' | 'older';

/**
 * Get age range category from numeric age
 */
export function getAgeRange(age: number): AgeRange {
  if (age < 13) return 'child';
  if (age <= 19) return 'teen';
  if (age <= 39) return 'young_adult';
  return 'older';
}

/**
 * Detect age range from a voice label string
 */
export function detectAgeRangeFromLabel(label: string | undefined): AgeRange | undefined {
  if (!label) return undefined;
  const lower = label.toLowerCase();

  if (lower.includes('teen')) return 'teen';
  if (lower.includes('child') || lower.includes('under 10')) return 'child';
  if (lower.includes('20s') || lower.includes('30s') || lower.includes('young')) return 'young_adult';
  if (lower.includes('older') || lower.includes('mature') || lower.includes('40s') || lower.includes('50s') || lower.includes('60s')) return 'older';

  return undefined;
}

/**
 * Calculate age proximity score (0-1)
 *
 * Exact match = 1.0
 * Adjacent range = ~0.7-0.8
 * Two ranges apart = ~0.4-0.5
 * Opposite ends = 0.0
 */
export function ageProximityScore(targetAge: AgeRange, voiceAge: AgeRange): number {
  if (targetAge === voiceAge) return 1.0;

  const distance = Math.abs(AGE_MIDPOINTS[targetAge] - AGE_MIDPOINTS[voiceAge]);
  return Math.max(0, 1 - (distance / MAX_AGE_DISTANCE));
}

/**
 * Score how well a voice matches the criteria (0-1)
 *
 * Gender is a hard gate: wrong gender = 0 score immediately.
 * Everything else is soft-weighted so the best available voice
 * always rises to the top, even in a small catalog.
 */
export function scoreVoiceMatch(
  voice: Partial<VoiceMetadata>,
  criteria: {
    query?: string;
    gender?: 'Male' | 'Female';
    ageRange?: AgeRange;
    style?: string;
    tone?: string;
    isNarrator?: boolean;
  }
): number {
  // Hard gate: gender mismatch = instant 0
  if (criteria.gender && voice.gender && voice.gender !== criteria.gender) {
    return 0;
  }

  let score = 0;
  let maxScore = 0;

  // Age proximity (weight: 0.30)
  if (criteria.ageRange) {
    maxScore += 0.30;
    const voiceAge = detectAgeRangeFromLabel(voice.label);
    if (voiceAge) {
      score += 0.30 * ageProximityScore(criteria.ageRange, voiceAge);
    }
    // No label = no age score (voice gets 0 for this dimension, not eliminated)
  }

  // Style/Ethnicity (weight: 0.25)
  if (criteria.style) {
    maxScore += 0.25;
    const voiceStyle = voice.style?.toLowerCase() || '';
    const targetStyle = criteria.style.toLowerCase();

    if (voiceStyle === targetStyle) {
      score += 0.25;
    } else if (voiceStyle.includes(targetStyle) || targetStyle.includes(voiceStyle)) {
      score += 0.125;
    }
  }

  // Narrative query (weight: 0.25)
  if (criteria.query && criteria.query.length > 3) {
    maxScore += 0.25;
    const queryWords = criteria.query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const voiceText = `${voice.name || ''} ${voice.description || ''} ${voice.tone || ''}`.toLowerCase();

    const matchCount = queryWords.filter(word => voiceText.includes(word)).length;
    if (matchCount > 0) {
      score += 0.25 * Math.min(1, matchCount / Math.max(1, queryWords.length * 0.5));
    }
  }

  // Tone (weight: 0.10)
  if (criteria.tone) {
    maxScore += 0.10;
    const voiceTones = Array.isArray(voice.tone) ? voice.tone : [voice.tone || ''];
    const targetTone = criteria.tone.toLowerCase();

    if (voiceTones.some((t) => t?.toLowerCase().includes(targetTone))) {
      score += 0.10;
    }
  }

  // Narrator bonus (weight: 0.10)
  if (criteria.isNarrator) {
    maxScore += 0.10;
    if (voice.label?.toLowerCase().includes('narrator')) {
      score += 0.10;
    }
  }

  return maxScore > 0 ? score / maxScore : 0;
}

/**
 * Load local voice catalog
 */
let cachedVoiceCatalog: VoiceMetadata[] | null = null;

function loadLocalVoiceCatalog(): VoiceMetadata[] {
  if (cachedVoiceCatalog) {
    return cachedVoiceCatalog;
  }

  try {
    if (existsSync(VOICE_CATALOG_PATH)) {
      const data = readFileSync(VOICE_CATALOG_PATH, 'utf-8');
      cachedVoiceCatalog = JSON.parse(data);
      log.info('HybridVoiceSearch loaded voices from local catalog', { count: cachedVoiceCatalog!.length });
      return cachedVoiceCatalog!;
    }
  } catch (err) {
    log.warn('HybridVoiceSearch failed to load local catalog', { error: err instanceof Error ? err.message : String(err) });
  }

  // Return default voices as fallback
  cachedVoiceCatalog = Object.values(DEFAULT_VOICES);
  return cachedVoiceCatalog;
}

/**
 * Fetch voices from ElevenLabs API with filters
 */
async function fetchElevenLabsVoices(params: {
  gender?: string;
  age?: string;
  accent?: string;
  search?: string;
}): Promise<VoiceMetadata[]> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    log.warn('HybridVoiceSearch no ELEVENLABS_API_KEY, skipping API search');
    return [];
  }

  try {
    // Use the voices endpoint (not shared-voices which requires different auth)
    const url = new URL(`${ELEVENLABS_API_URL}/voices`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      log.warn('HybridVoiceSearch ElevenLabs API error', { status: response.status });
      return [];
    }

    const data = await response.json();
    const voices = data.voices || [];

    interface ElevenLabsVoice {
      voice_id: string;
      name: string;
      labels?: {
        gender?: string;
        age?: string;
        use_case?: string;
        accent?: string;
        descriptive?: Record<string, string>;
      };
      description?: string;
      preview_url?: string;
    }

    // Transform to our format
    return (voices as ElevenLabsVoice[]).map((v) => ({
      voice_id: v.voice_id,
      name: v.name,
      gender: (v.labels?.gender === 'Female' ? 'Female' : 'Male') as 'Male' | 'Female',
      label: v.labels?.age || v.labels?.use_case || 'General',
      style: v.labels?.accent || 'American',
      tone: v.labels?.descriptive ? Object.values(v.labels.descriptive) : [],
      description: v.description,
      preview_url: v.preview_url,
    }));
  } catch (err) {
    log.error('HybridVoiceSearch ElevenLabs API fetch failed', err instanceof Error ? err : undefined);
    return [];
  }
}

/**
 * Main hybrid search function
 *
 * Single-pass approach:
 * 1. Score every voice in catalog (gender gate eliminates wrong gender)
 * 2. Sort by score, return top K
 * 3. If local catalog yields nothing, try ElevenLabs API
 * 4. Ultimate fallback: default voice
 */
export async function searchVoicesHybrid(params: VoiceSearchParams): Promise<VoiceSearchResult> {
  const {
    characterName,
    gender,
    age,
    ageRange: providedAgeRange,
    ethnicity,
    style,
    tone,
    isNarrator,
    excludeVoiceIds = [],
    topK = 3,
  } = params;

  // Determine age range
  const ageRange = providedAgeRange || (age ? getAgeRange(age) : undefined);
  const effectiveStyle = style || ethnicity;

  log.debug('HybridVoiceSearch searching', { characterName, gender, age, ageRange, style: effectiveStyle, isNarrator });

  const criteria = {
    query: characterName,
    gender,
    ageRange,
    style: effectiveStyle,
    tone,
    isNarrator,
  };

  // Load local catalog
  const localVoices = loadLocalVoiceCatalog();

  // Single-pass: score every non-excluded voice
  const candidates = localVoices.filter((v) => !excludeVoiceIds.includes(v.voice_id));

  const scored = candidates.map((v) => ({
    voice: v,
    score: scoreVoiceMatch(v, criteria),
  }));

  // Remove gender-gated voices (score === 0 when gender was specified)
  const eligible = scored.filter((s) => s.score > 0 || !criteria.gender);
  eligible.sort((a, b) => b.score - a.score);

  if (eligible.length > 0 && eligible[0].score > 0) {
    const topVoices = eligible.slice(0, topK).map((s) => s.voice);
    log.debug('HybridVoiceSearch found eligible voices', { eligibleCount: eligible.length, topScore: eligible[0].score.toFixed(3) });

    return {
      success: true,
      voices: topVoices,
      source: 'local_catalog',
      message: `Found ${eligible.length} eligible voices (top score: ${eligible[0].score.toFixed(2)})`,
    };
  }

  // Fallback: Try ElevenLabs API
  const apiVoices = await fetchElevenLabsVoices({
    gender,
    age: ageRange,
    accent: effectiveStyle,
  });

  if (apiVoices.length > 0) {
    const apiCandidates = apiVoices.filter((v) => !excludeVoiceIds.includes(v.voice_id));
    const apiScored = apiCandidates.map((v) => ({
      voice: v,
      score: scoreVoiceMatch(v, criteria),
    }));
    const apiEligible = apiScored.filter((s) => s.score > 0 || !criteria.gender);
    apiEligible.sort((a, b) => b.score - a.score);

    if (apiEligible.length > 0 && apiEligible[0].score > 0) {
      return {
        success: true,
        voices: apiEligible.slice(0, topK).map((s) => s.voice),
        source: 'elevenlabs_api',
        message: `Found ${apiEligible.length} voices from ElevenLabs API`,
      };
    }
  }

  // Ultimate fallback: default voice
  log.warn('HybridVoiceSearch no matches found, using fallback', { characterName });

  let fallbackVoice: VoiceMetadata;
  if (isNarrator) {
    fallbackVoice = DEFAULT_VOICES.narrator;
  } else if (gender === 'Female') {
    fallbackVoice = DEFAULT_VOICES.female;
  } else {
    fallbackVoice = DEFAULT_VOICES.male;
  }

  // Make sure fallback isn't excluded
  if (excludeVoiceIds.includes(fallbackVoice.voice_id)) {
    const availableDefault = Object.values(DEFAULT_VOICES).find(
      (v) => !excludeVoiceIds.includes(v.voice_id)
    );
    if (availableDefault) {
      fallbackVoice = availableDefault;
    }
  }

  return {
    success: true,
    voices: [fallbackVoice],
    source: 'fallback',
    message: `Using fallback voice for ${characterName}`,
  };
}

/**
 * Get the best voice for a character - convenience wrapper
 */
export async function getBestVoiceForCharacter(params: VoiceSearchParams): Promise<VoiceMetadata> {
  const result = await searchVoicesHybrid({ ...params, topK: 1 });
  return result.voices[0];
}

/**
 * Clear the voice catalog cache (for testing)
 */
export function clearVoiceCatalogCache(): void {
  cachedVoiceCatalog = null;
}
