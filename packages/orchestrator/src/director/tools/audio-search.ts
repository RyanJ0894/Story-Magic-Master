/**
 * Audio Search Tools - LLM-callable tools for semantic audio search
 *
 * These tools allow the AudioDirectorAgent to search for suitable:
 * - Music tracks
 * - Ambience sounds
 * - Sound effects (SFX)
 */

import { tool } from 'ai';
import { z } from 'zod';
import { log } from '../../lib/logger.js';
import { EmbeddingQuotaExhaustedError } from '../../lib/retry.js';
import {
  getMusicStore,
  getAmbienceStore,
  getSfxStore,
  AudioMetadata,
  SearchResult,
} from '../embeddings/embedding-store.js';
import { getQueryEmbedding } from '../embeddings/query-embedding.js';

/**
 * Format audio result for LLM consumption
 */
function formatAudioResult(result: SearchResult<AudioMetadata>) {
  return {
    id: result.item.id,
    file: result.item.file,
    title: result.item.title,
    group: result.item.group,
    style: result.item.style,
    mood: result.item.mood,
    intensity: result.item.intensity,
    loopable: result.item.loopable,
    tags: result.item.tags,
    similarity_score: result.score.toFixed(3),
  };
}

/**
 * Search for music tracks
 */
export const searchMusicTool = tool({
  description: `Search for music tracks matching scene mood and atmosphere.
Returns music files with id, title, group, style, mood, intensity, and file path.

IMPORTANT RULES:
- EVERY scene MUST have music
- Match the emotional tone of the scene
- Consider scene header for setting (INT/EXT, location)

Groups available: EPIC, UPLIFTING, CINEMATIC, THRILLER, DRAMA, EMOTIONAL, etc.
Use group filter to narrow results.`,

  inputSchema: z.object({
    query: z.string().describe('Natural language description of the desired music'),
    group: z.string().optional().describe('Music category filter (e.g., "EPIC", "UPLIFTING", "THRILLER")'),
    style: z.string().optional().describe('Music style filter (e.g., "orchestral", "electronic")'),
    mood: z.string().optional().describe('Mood filter (e.g., "epic", "peaceful", "tense")'),
    intensity_min: z.number().optional().describe('Minimum intensity (0-100)'),
    intensity_max: z.number().optional().describe('Maximum intensity (0-100)'),
    loopable: z.boolean().optional().describe('Filter for loopable tracks'),
    top_k: z.number().default(3).describe('Number of results to return'),
  }),

  execute: async ({ query, group, style, mood, intensity_min, intensity_max, loopable, top_k = 3 }) => {
    try {
      const queryEmbedding = await getQueryEmbedding(query);
      const musicStore = getMusicStore();

      const results = musicStore.search({
        queryEmbedding,
        topK: top_k,
        group,
        style,
        mood,
        intensityMin: intensity_min,
        intensityMax: intensity_max,
        loopable,
      });

      if (results.length === 0) {
        // Try without filters
        const fallbackResults = musicStore.search({
          queryEmbedding,
          topK: top_k,
        });

        return {
          status: 'success',
          message: `Found ${fallbackResults.length} music tracks (filters relaxed)`,
          items: fallbackResults.map(formatAudioResult),
          filters_relaxed: true,
        };
      }

      return {
        status: 'success',
        message: `Found ${results.length} matching music tracks`,
        items: results.map(formatAudioResult),
      };
    } catch (err) {
      if (err instanceof EmbeddingQuotaExhaustedError) throw err;
      log.error('searchMusic error', err instanceof Error ? err : undefined);
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Search failed',
        items: [],
      };
    }
  },
});

/**
 * Search for ambience sounds
 */
export const searchAmbienceTool = tool({
  description: `Search for ambient sounds matching scene location.
Returns ambience files with id, title, group, mood, and file path.

CRITICAL RULES:
- Match scene header EXACTLY (INT/EXT, location type)
- MANDATORY ambience for: FOREST, HOSPITAL, STREET, CAFETERIA, OFFICE, CITY
- INT (Interior) = indoor ambience (room tone, AC hum, indoor crowds)
- EXT (Exterior) = outdoor ambience (nature, traffic, wind)
- NEVER use outdoor ambience for indoor scenes or vice versa

Groups available: "People in the City", "Suburbs & Countryside", "Interior Spaces", etc.`,

  inputSchema: z.object({
    query: z.string().describe('Natural language description of the scene location'),
    group: z.string().optional().describe('Ambience category filter'),
    style: z.string().optional().describe('Style filter'),
    mood: z.string().optional().describe('Mood filter (e.g., "peaceful", "busy", "eerie")'),
    intensity_min: z.number().optional().describe('Minimum intensity (0-100)'),
    intensity_max: z.number().optional().describe('Maximum intensity (0-100)'),
    loopable: z.boolean().optional().describe('Filter for loopable tracks'),
    top_k: z.number().default(3).describe('Number of results to return'),
  }),

  execute: async ({ query, group, style, mood, intensity_min, intensity_max, loopable, top_k = 3 }) => {
    try {
      const queryEmbedding = await getQueryEmbedding(query);
      const ambienceStore = getAmbienceStore();

      const results = ambienceStore.search({
        queryEmbedding,
        topK: top_k,
        group,
        style,
        mood,
        intensityMin: intensity_min,
        intensityMax: intensity_max,
        loopable,
      });

      if (results.length === 0) {
        // Try without filters
        const fallbackResults = ambienceStore.search({
          queryEmbedding,
          topK: top_k,
        });

        return {
          status: 'success',
          message: `Found ${fallbackResults.length} ambience tracks (filters relaxed)`,
          items: fallbackResults.map(formatAudioResult),
          filters_relaxed: true,
        };
      }

      return {
        status: 'success',
        message: `Found ${results.length} matching ambience tracks`,
        items: results.map(formatAudioResult),
      };
    } catch (err) {
      if (err instanceof EmbeddingQuotaExhaustedError) throw err;
      log.error('searchAmbience error', err instanceof Error ? err : undefined);
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Search failed',
        items: [],
      };
    }
  },
});

/**
 * Search for sound effects
 */
export const searchSfxTool = tool({
  description: `Search for sound effects for specific actions in the script.
Returns SFX files with id, title, group, and file path.

CRITICAL RULES:
- ONLY add SFX for CAPITALIZED action words in the script (SLAMS, CRASHES, GUNSHOT)
- Maximum 3 SFX per scene
- Each SFX must have an explicit trigger word in the script
- NEVER add SFX for implied or subtle actions

Groups available: "Fighting", "Explosions", "Doors & Impacts", "Vehicles", etc.`,

  inputSchema: z.object({
    query: z.string().describe('Natural language description of the sound effect needed'),
    group: z.string().optional().describe('SFX category filter (e.g., "Fighting", "Explosions")'),
    style: z.string().optional().describe('Style filter'),
    intensity_min: z.number().optional().describe('Minimum intensity (0-100)'),
    intensity_max: z.number().optional().describe('Maximum intensity (0-100)'),
    top_k: z.number().default(3).describe('Number of results to return'),
  }),

  execute: async ({ query, group, style, intensity_min, intensity_max, top_k = 3 }) => {
    try {
      const queryEmbedding = await getQueryEmbedding(query);
      const sfxStore = getSfxStore();

      const results = sfxStore.search({
        queryEmbedding,
        topK: top_k,
        group,
        style,
        intensityMin: intensity_min,
        intensityMax: intensity_max,
      });

      if (results.length === 0) {
        // Try without filters
        const fallbackResults = sfxStore.search({
          queryEmbedding,
          topK: top_k,
        });

        return {
          status: 'success',
          message: `Found ${fallbackResults.length} sound effects (filters relaxed)`,
          items: fallbackResults.map(formatAudioResult),
          filters_relaxed: true,
        };
      }

      return {
        status: 'success',
        message: `Found ${results.length} matching sound effects`,
        items: results.map(formatAudioResult),
      };
    } catch (err) {
      if (err instanceof EmbeddingQuotaExhaustedError) throw err;
      log.error('searchSfx error', err instanceof Error ? err : undefined);
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Search failed',
        items: [],
      };
    }
  },
});

/**
 * List available audio groups tool
 */
export const listAudioGroupsTool = tool({
  description: 'List all available audio groups/categories for music, ambience, or SFX.',

  inputSchema: z.object({
    audio_type: z.enum(['music', 'ambience', 'sfx']).describe('Type of audio to list groups for'),
  }),

  execute: async ({ audio_type }) => {
    try {
      const store =
        audio_type === 'music'
          ? getMusicStore()
          : audio_type === 'ambience'
            ? getAmbienceStore()
            : getSfxStore();

      const allItems = store.getAllMetadata();
      const groups = [...new Set(allItems.map((item) => item.group))].sort();

      return {
        status: 'success',
        audio_type,
        total_items: allItems.length,
        groups,
      };
    } catch (err) {
      log.error('listAudioGroups error', err instanceof Error ? err : undefined);
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Failed to list groups',
        groups: [],
      };
    }
  },
});

/**
 * Get audio by ID tool - for verification
 */
export const getAudioByIdTool = tool({
  description: 'Get a specific audio file by its ID. Use this to verify an audio selection.',

  inputSchema: z.object({
    audio_type: z.enum(['music', 'ambience', 'sfx']).describe('Type of audio'),
    id: z.string().describe('The audio file ID'),
  }),

  execute: async ({ audio_type, id }) => {
    try {
      const store =
        audio_type === 'music'
          ? getMusicStore()
          : audio_type === 'ambience'
            ? getAmbienceStore()
            : getSfxStore();

      const item = store.findById(id);

      if (!item) {
        return {
          status: 'error',
          message: `${audio_type} not found: ${id}`,
          item: null,
        };
      }

      return {
        status: 'success',
        item: {
          id: item.id,
          file: item.file,
          title: item.title,
          group: item.group,
          style: item.style,
          mood: item.mood,
          intensity: item.intensity,
          loopable: item.loopable,
          tags: item.tags,
        },
      };
    } catch (err) {
      log.error('getAudioById error', err instanceof Error ? err : undefined);
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Failed to get audio',
        item: null,
      };
    }
  },
});
