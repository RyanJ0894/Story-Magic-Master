/**
 * Hybrid Voice Search - Combines ElevenLabs API with local catalog
 *
 * Architecture:
 * 1. Primary: ElevenLabs API filtering (gender, age, accent)
 * 2. Fallback: Local voice catalog with attribute-based search
 * 3. Scoring: Match quality based on attribute priority
 *
 * Priority order (highest to lowest):
 * 1. Ethnicity/Style (African American, British, etc.)
 * 2. Age range (Teen, Young Adult, Older)
 * 3. Gender
 * 4. Tone/Quality
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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
  filtersRelaxed?: boolean;
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
 * Map age range to ElevenLabs label patterns
 */
function ageRangeToLabelPattern(ageRange: AgeRange, gender: 'Male' | 'Female'): string[] {
  switch (ageRange) {
    case 'child':
      return [gender === 'Male' ? 'Male Under 10' : 'Female Under 10', 'Child'];
    case 'teen':
      return [gender === 'Male' ? 'Male Teen' : 'Female Teen', 'Teen'];
    case 'young_adult':
      return [
        gender === 'Male' ? 'Male 20s to 30s' : 'Female - 20s to 30s',
        'Young Adult',
        '20s',
        '30s',
      ];
    case 'older':
      return [gender === 'Male' ? 'Older Male' : 'Older Female', 'Older', 'Mature', '40s', '50s', '60s'];
  }
}

/**
 * Check if a voice matches the given attributes
 */
export function matchVoiceAttributes(
  voice: Partial<VoiceMetadata>,
  criteria: {
    gender?: 'Male' | 'Female';
    ageRange?: AgeRange;
    style?: string;
    isNarrator?: boolean;
  }
): boolean {
  // Gender must match exactly if specified
  if (criteria.gender && voice.gender !== criteria.gender) {
    return false;
  }

  // Check narrator
  if (criteria.isNarrator) {
    const label = voice.label?.toLowerCase() || '';
    if (!label.includes('narrator')) {
      return false;
    }
  }

  // Check age range via label
  if (criteria.ageRange && criteria.gender) {
    const labelPatterns = ageRangeToLabelPattern(criteria.ageRange, criteria.gender);
    const label = voice.label?.toLowerCase() || '';

    const matchesAge = labelPatterns.some((pattern) => label.includes(pattern.toLowerCase()));
    if (!matchesAge) {
      return false;
    }
  }

  // Check style/ethnicity
  if (criteria.style) {
    const voiceStyle = voice.style?.toLowerCase() || '';
    const targetStyle = criteria.style.toLowerCase();

    if (voiceStyle !== targetStyle && !voiceStyle.includes(targetStyle)) {
      return false;
    }
  }

  return true;
}

/**
 * Score how well a voice matches the criteria (0-1)
 *
 * Scoring weights:
 * - Style/Ethnicity: 0.4 (highest priority)
 * - Age: 0.3
 * - Gender: 0.2
 * - Tone: 0.1
 */
export function scoreVoiceMatch(
  voice: Partial<VoiceMetadata>,
  criteria: {
    gender?: 'Male' | 'Female';
    ageRange?: AgeRange;
    style?: string;
    tone?: string;
    isNarrator?: boolean;
  }
): number {
  let score = 0;
  let maxScore = 0;

  // Gender match (weight: 0.2)
  if (criteria.gender) {
    maxScore += 0.2;
    if (voice.gender === criteria.gender) {
      score += 0.2;
    }
  }

  // Age match (weight: 0.3)
  if (criteria.ageRange && criteria.gender) {
    maxScore += 0.3;
    const labelPatterns = ageRangeToLabelPattern(criteria.ageRange, criteria.gender);
    const label = voice.label?.toLowerCase() || '';

    if (labelPatterns.some((pattern) => label.includes(pattern.toLowerCase()))) {
      score += 0.3;
    }
  }

  // Style/Ethnicity match (weight: 0.4 - highest priority)
  if (criteria.style) {
    maxScore += 0.4;
    const voiceStyle = voice.style?.toLowerCase() || '';
    const targetStyle = criteria.style.toLowerCase();

    if (voiceStyle === targetStyle) {
      score += 0.4;
    } else if (voiceStyle.includes(targetStyle)) {
      // Only partial match if voice style is MORE specific than requested
      // e.g., voice "African American" includes target "African" → partial credit
      // But NOT: voice "American" with target "African American" → no credit
      score += 0.2;
    }
    // Note: We intentionally don't give partial credit when targetStyle includes voiceStyle
    // e.g., target "African American" vs voice "American" should NOT match
  }

  // Tone match (weight: 0.1)
  if (criteria.tone) {
    maxScore += 0.1;
    const voiceTones = Array.isArray(voice.tone) ? voice.tone : [voice.tone || ''];
    const targetTone = criteria.tone.toLowerCase();

    if (voiceTones.some((t) => t?.toLowerCase().includes(targetTone))) {
      score += 0.1;
    }
  }

  // Narrator match
  if (criteria.isNarrator) {
    maxScore += 0.3;
    if (voice.label?.toLowerCase().includes('narrator')) {
      score += 0.3;
    }
  }

  // Normalize score to 0-1
  return maxScore > 0 ? score / maxScore : 0;
}

/**
 * Filter voices by attributes (local catalog search)
 */
export function filterVoicesByAttributes(
  voices: VoiceMetadata[],
  criteria: {
    gender?: 'Male' | 'Female';
    ageRange?: AgeRange;
    style?: string;
    isNarrator?: boolean;
  },
  excludeVoiceIds: string[] = []
): VoiceMetadata[] {
  return voices.filter((voice) => {
    // Exclude already used voices
    if (excludeVoiceIds.includes(voice.voice_id)) {
      return false;
    }

    return matchVoiceAttributes(voice, criteria);
  });
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
      console.log(`[HybridVoiceSearch] Loaded ${cachedVoiceCatalog!.length} voices from local catalog`);
      return cachedVoiceCatalog!;
    }
  } catch (err) {
    console.warn('[HybridVoiceSearch] Failed to load local catalog:', err);
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
    console.warn('[HybridVoiceSearch] No ELEVENLABS_API_KEY, skipping API search');
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
      console.warn(`[HybridVoiceSearch] ElevenLabs API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const voices = data.voices || [];

    // Transform to our format
    return voices.map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name,
      gender: v.labels?.gender || 'Male',
      label: v.labels?.age || v.labels?.use_case || 'General',
      style: v.labels?.accent || 'American',
      tone: v.labels?.descriptive ? Object.values(v.labels.descriptive) : [],
      description: v.description,
      preview_url: v.preview_url,
    }));
  } catch (err) {
    console.error('[HybridVoiceSearch] ElevenLabs API fetch failed:', err);
    return [];
  }
}

/**
 * Main hybrid search function
 *
 * Strategy:
 * 1. Try ElevenLabs API with filters
 * 2. If no results or API fails, use local catalog
 * 3. Score and rank results
 * 4. If still no results, relax filters progressively
 * 5. Ultimate fallback: return default voice
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

  console.log(`[HybridVoiceSearch] Searching for ${characterName}: gender=${gender}, age=${age}, ageRange=${ageRange}, style=${effectiveStyle}, isNarrator=${isNarrator}`);

  const criteria = {
    gender,
    ageRange,
    style: effectiveStyle,
    tone,
    isNarrator,
  };

  // Load local catalog
  const localVoices = loadLocalVoiceCatalog();

  // Step 1: Try local catalog first (faster, more reliable)
  let matchedVoices = filterVoicesByAttributes(localVoices, criteria, excludeVoiceIds);

  if (matchedVoices.length > 0) {
    // Score and sort
    const scored = matchedVoices.map((v) => ({
      voice: v,
      score: scoreVoiceMatch(v, criteria),
    }));
    scored.sort((a, b) => b.score - a.score);

    return {
      success: true,
      voices: scored.slice(0, topK).map((s) => s.voice),
      source: 'local_catalog',
      message: `Found ${matchedVoices.length} matching voices`,
    };
  }

  // Step 2: Try relaxing filters progressively
  const filterRelaxationOrder: (keyof typeof criteria)[] = ['tone', 'style', 'ageRange', 'gender'];

  let relaxedCriteria = { ...criteria };
  for (const filterToRelax of filterRelaxationOrder) {
    if (relaxedCriteria[filterToRelax]) {
      console.log(`[HybridVoiceSearch] Relaxing filter: ${filterToRelax}`);
      delete relaxedCriteria[filterToRelax];

      matchedVoices = filterVoicesByAttributes(localVoices, relaxedCriteria, excludeVoiceIds);

      if (matchedVoices.length > 0) {
        const scored = matchedVoices.map((v) => ({
          voice: v,
          score: scoreVoiceMatch(v, criteria), // Score against original criteria
        }));
        scored.sort((a, b) => b.score - a.score);

        return {
          success: true,
          voices: scored.slice(0, topK).map((s) => s.voice),
          source: 'local_catalog',
          filtersRelaxed: true,
          message: `Found ${matchedVoices.length} voices with relaxed filters`,
        };
      }
    }
  }

  // Step 3: Try ElevenLabs API as last resort
  const apiVoices = await fetchElevenLabsVoices({
    gender,
    age: ageRange,
    accent: effectiveStyle,
  });

  if (apiVoices.length > 0) {
    // Filter out excluded voices
    const filteredApiVoices = apiVoices.filter((v) => !excludeVoiceIds.includes(v.voice_id));

    if (filteredApiVoices.length > 0) {
      const scored = filteredApiVoices.map((v) => ({
        voice: v,
        score: scoreVoiceMatch(v, criteria),
      }));
      scored.sort((a, b) => b.score - a.score);

      return {
        success: true,
        voices: scored.slice(0, topK).map((s) => s.voice),
        source: 'elevenlabs_api',
        filtersRelaxed: true,
        message: `Found ${filteredApiVoices.length} voices from ElevenLabs API`,
      };
    }
  }

  // Step 4: Ultimate fallback - return default voice
  console.warn(`[HybridVoiceSearch] No matches found for ${characterName}, using fallback`);

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
    // Find any non-excluded voice from defaults
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
    filtersRelaxed: true,
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
