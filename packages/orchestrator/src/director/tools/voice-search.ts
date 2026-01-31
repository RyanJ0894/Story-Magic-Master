/**
 * Voice Search Tool - LLM-callable tool for voice search
 *
 * This tool allows the DirectorAgent to search for suitable voices
 * from the ElevenLabs voice catalog using attribute-based filtering.
 *
 * Uses hybrid search (no embeddings) for reliable voice matching.
 */

import { tool } from 'ai';
import { z } from 'zod';
import {
  searchVoicesHybrid,
  getAgeRange,
  type VoiceMetadata,
  type AgeRange,
} from './hybrid-voice-search.js';

// Track used voices to ensure uniqueness across characters
const usedVoiceIds = new Set<string>();

/**
 * Reset used voices (call at the start of each script)
 */
export function resetUsedVoices(): void {
  usedVoiceIds.clear();
}

/**
 * Mark a voice as used
 */
export function markVoiceUsed(voiceId: string): void {
  usedVoiceIds.add(voiceId);
}

/**
 * Get list of used voice IDs
 */
export function getUsedVoiceIds(): string[] {
  return Array.from(usedVoiceIds);
}

/**
 * Extract narrative personality keywords from voice metadata
 * Helps the LLM understand what kind of character this voice suits
 */
function extractVoicePersonality(voice: VoiceMetadata): string {
  const parts: string[] = [];

  // Extract descriptive words from name (e.g., "Roger - Laid-Back, Casual, Resonant")
  const nameParts = voice.name.split(' - ');
  if (nameParts.length > 1) {
    parts.push(nameParts[1]);
  }

  // Add tone info
  const tone = Array.isArray(voice.tone) ? voice.tone.join(', ') : voice.tone || '';
  if (tone && !parts.some(p => p.toLowerCase().includes(tone.toLowerCase()))) {
    parts.push(tone);
  }

  return parts.join('; ') || 'General purpose voice';
}

/**
 * Parse age range from label string
 */
function parseAgeRangeFromLabel(label: string | undefined): AgeRange | undefined {
  if (!label) return undefined;
  const lower = label.toLowerCase();

  if (lower.includes('teen')) return 'teen';
  if (lower.includes('child') || lower.includes('under 10')) return 'child';
  if (lower.includes('20s') || lower.includes('30s') || lower.includes('young')) return 'young_adult';
  if (lower.includes('older') || lower.includes('mature') || lower.includes('40s') || lower.includes('50s') || lower.includes('60s')) return 'older';

  return undefined;
}

/**
 * Search for voices tool - callable by LLM agents
 */
export const searchVoicesTool = tool({
  description: `Search for voice profiles matching character descriptions.
Returns voice profiles with voice_id, name, label, gender, tone, style, and description.
IMPORTANT: Each voice can only be assigned to ONE character.

The 'query' parameter is the MOST IMPORTANT field - use it to describe the character's
narrative role and vocal quality (e.g., "fierce warrior, commanding and deep" or
"warm motherly mentor, reassuring storyteller"). The search matches query keywords
against voice names and descriptions for story-driven casting.

Filters:
- gender: "Male" or "Female" (REQUIRED for character voices)
- label: Age/category hint like "Teen", "Older", "Young Adult", "Narrator"
- style: Accent/ethnicity like "African American", "American", "British"
- tone: Voice quality like "Calm", "Energetic", "Deep"

Casting priority:
1. Narrative fit (query) - Does the voice personality match the character's story role?
2. Race/ethnicity (style) - Must match when specified in script
3. Age (label) - Must match for teens (17-19 years old)
4. Gender - Must match
5. Tone - Voice quality preference`,

  parameters: z.object({
    query: z.string().describe('Natural language description of the desired voice'),
    gender: z.enum(['Male', 'Female']).optional().describe('Gender filter'),
    label: z.string().optional().describe('Age/category filter (e.g., "Teen", "Older Male", "Narrator")'),
    style: z.string().optional().describe('Accent/ethnicity filter (e.g., "African American", "British")'),
    tone: z.string().optional().describe('Voice quality filter (e.g., "Calm", "Energetic")'),
    top_k: z.number().min(1).max(10).default(3).describe('Number of results to return'),
  }),

  execute: async ({ query, gender, label, style, tone, top_k = 3 }) => {
    try {
      console.log(`[searchVoices] Searching: query="${query}", gender=${gender}, label=${label}, style=${style}`);

      // Determine if this is a narrator search
      const isNarrator = query.toLowerCase().includes('narrator') || label?.toLowerCase().includes('narrator');

      // Parse age range from label
      const ageRange = parseAgeRangeFromLabel(label);

      // Use hybrid search (attribute-based, no embeddings)
      const result = await searchVoicesHybrid({
        characterName: query,
        gender,
        ageRange,
        style,
        tone,
        isNarrator,
        excludeVoiceIds: getUsedVoiceIds(),
        topK: top_k,
      });

      if (!result.success || result.voices.length === 0) {
        return {
          status: 'error',
          message: 'No matching voices found. Try different search criteria.',
          voices: [],
        };
      }

      // Format voices for LLM consumption with rich narrative metadata
      const formattedVoices = result.voices.map((voice) => ({
        voice_id: voice.voice_id,
        name: voice.name,
        label: voice.label,
        gender: voice.gender,
        tone: Array.isArray(voice.tone) ? voice.tone.join(', ') : voice.tone || '',
        style: voice.style,
        description: voice.description || voice.name || '',
        // Help the LLM understand what this voice sounds like for narrative casting
        personality: extractVoicePersonality(voice),
      }));

      console.log(`[searchVoices] Found ${formattedVoices.length} voices from ${result.source}`);

      return {
        status: 'success',
        message: result.message || `Found ${formattedVoices.length} matching voices`,
        voices: formattedVoices,
        filters_relaxed: result.filtersRelaxed,
        source: result.source,
      };
    } catch (err) {
      console.error('[searchVoices] Error:', err);
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Search failed',
        voices: [],
      };
    }
  },
});

/**
 * Get voice by ID tool - for verification
 */
export const getVoiceByIdTool = tool({
  description: 'Get a specific voice profile by its ID. Use this to verify a voice selection.',

  parameters: z.object({
    voice_id: z.string().describe('The ElevenLabs voice ID'),
  }),

  execute: async ({ voice_id }) => {
    // Use hybrid search to find the voice
    const result = await searchVoicesHybrid({
      characterName: 'lookup',
      topK: 100, // Get all to find by ID
    });

    const voice = result.voices.find((v) => v.voice_id === voice_id);

    if (!voice) {
      return {
        status: 'error',
        message: `Voice not found: ${voice_id}`,
        voice: null,
      };
    }

    return {
      status: 'success',
      voice: {
        voice_id: voice.voice_id,
        name: voice.name,
        label: voice.label,
        gender: voice.gender,
        tone: Array.isArray(voice.tone) ? voice.tone.join(', ') : voice.tone || '',
        style: voice.style,
        description: voice.description || '',
        is_used: usedVoiceIds.has(voice_id),
      },
    };
  },
});

/**
 * List available voice labels tool
 */
export const listVoiceLabelsTool = tool({
  description: 'List all available voice labels/categories. Use this to understand what voice types are available.',

  parameters: z.object({}),

  execute: async () => {
    // Get all voices using hybrid search
    const result = await searchVoicesHybrid({
      characterName: 'list',
      topK: 100,
    });

    const allVoices = result.voices;

    // Extract unique labels
    const labels = [...new Set(allVoices.map((v) => v.label))].sort();

    // Group by gender
    const maleLabels = allVoices.filter((v) => v.gender === 'Male').map((v) => v.label);
    const femaleLabels = allVoices.filter((v) => v.gender === 'Female').map((v) => v.label);

    return {
      status: 'success',
      total_voices: allVoices.length,
      labels: {
        all: labels,
        male: [...new Set(maleLabels)].sort(),
        female: [...new Set(femaleLabels)].sort(),
      },
    };
  },
});
