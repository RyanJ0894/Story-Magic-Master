/**
 * Voice Search Tool - LLM-callable tool for semantic voice search
 *
 * This tool allows the DirectorAgent to search for suitable voices
 * from the ElevenLabs voice catalog using semantic similarity.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { getVoiceStore, VoiceMetadata, SearchResult } from '../embeddings/embedding-store.js';
import { getQueryEmbedding } from '../embeddings/query-embedding.js';

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
 * Search for voices tool - callable by LLM agents
 */
export const searchVoicesTool = tool({
  description: `Search for voice profiles matching character descriptions.
Returns voice profiles with voice_id, name, label, gender, tone, and style.
IMPORTANT: Each voice can only be assigned to ONE character.

Filters:
- gender: "Male" or "Female" (REQUIRED for character voices)
- label: Age/category hint like "Teen", "Older", "Young Adult", "Narrator"
- style: Accent/ethnicity like "African American", "American", "British"
- tone: Voice quality like "Calm", "Energetic", "Deep"

Priority order when selecting voices:
1. Race/ethnicity (style) - HIGHEST priority
2. Age (label) - Must match for teens (17-19 years old)
3. Gender - Must match
4. Tone - Semantic search handles this`,

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
      // Get query embedding
      const queryEmbedding = await getQueryEmbedding(query);

      // Get voice store
      const voiceStore = getVoiceStore();

      // Search with filters, excluding already-used voices
      const results = voiceStore.search({
        queryEmbedding,
        topK: top_k,
        gender,
        label,
        style,
        tone,
        excludeVoiceIds: getUsedVoiceIds(),
      });

      if (results.length === 0) {
        // Try relaxing filters progressively
        const relaxedResults = await searchWithRelaxedFilters(
          queryEmbedding,
          { gender, label, style, tone },
          top_k
        );

        if (relaxedResults.length === 0) {
          return {
            status: 'error',
            message: 'No matching voices found. Try different search criteria.',
            voices: [],
          };
        }

        return {
          status: 'success',
          message: `Found ${relaxedResults.length} voices (some filters relaxed)`,
          voices: relaxedResults.map(formatVoiceResult),
          filters_relaxed: true,
        };
      }

      return {
        status: 'success',
        message: `Found ${results.length} matching voices`,
        voices: results.map(formatVoiceResult),
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
 * Format voice result for LLM consumption
 */
function formatVoiceResult(result: SearchResult<VoiceMetadata>) {
  return {
    voice_id: result.item.voice_id,
    name: result.item.name,
    label: result.item.label,
    gender: result.item.gender,
    tone: Array.isArray(result.item.tone) ? result.item.tone.join(', ') : result.item.tone,
    style: result.item.style,
    description: result.item.description,
    similarity_score: result.score.toFixed(3),
  };
}

/**
 * Search with progressively relaxed filters
 * Order: tone → style → label → gender (least to most important)
 */
async function searchWithRelaxedFilters(
  queryEmbedding: number[],
  filters: {
    gender?: 'Male' | 'Female';
    label?: string;
    style?: string;
    tone?: string;
  },
  topK: number
): Promise<SearchResult<VoiceMetadata>[]> {
  const voiceStore = getVoiceStore();
  const filterOrder = ['tone', 'style', 'label', 'gender'] as const;

  let activeFilters = { ...filters };

  for (const filterToRemove of filterOrder) {
    // Remove this filter
    if (activeFilters[filterToRemove]) {
      console.log(`[searchVoices] Relaxing filter: ${filterToRemove}`);
      delete activeFilters[filterToRemove];

      const results = voiceStore.search({
        queryEmbedding,
        topK,
        gender: activeFilters.gender,
        label: activeFilters.label,
        style: activeFilters.style,
        tone: activeFilters.tone,
        excludeVoiceIds: getUsedVoiceIds(),
      });

      if (results.length > 0) {
        return results;
      }
    }
  }

  // All filters removed, return whatever we can find
  return voiceStore.search({
    queryEmbedding,
    topK,
    excludeVoiceIds: getUsedVoiceIds(),
  });
}

/**
 * Get voice by ID tool - for verification
 */
export const getVoiceByIdTool = tool({
  description: 'Get a specific voice profile by its ID. Use this to verify a voice selection.',

  parameters: z.object({
    voice_id: z.string().describe('The ElevenLabs voice ID'),
  }),

  execute: async ({ voice_id }) => {
    const voiceStore = getVoiceStore();
    const voice = voiceStore.findById(voice_id);

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
        tone: Array.isArray(voice.tone) ? voice.tone.join(', ') : voice.tone,
        style: voice.style,
        description: voice.description,
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
    const voiceStore = getVoiceStore();
    const allVoices = voiceStore.getAllMetadata();

    // Extract unique labels
    const labels = [...new Set(allVoices.map((v) => v.label))].sort();

    // Group by gender
    const maleLabels = allVoices
      .filter((v) => v.gender === 'Male')
      .map((v) => v.label);
    const femaleLabels = allVoices
      .filter((v) => v.gender === 'Female')
      .map((v) => v.label);

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
