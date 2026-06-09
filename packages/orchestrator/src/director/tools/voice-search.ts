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
import { log } from '../../lib/logger.js';
import {
  searchVoicesHybrid,
  getAgeRange,
  detectAgeRangeFromLabel,
  type VoiceMetadata,
  type AgeRange,
} from './hybrid-voice-search.js';

/**
 * Create a scoped voice-tracking Set + tools for a single agent invocation.
 *
 * IMPORTANT: Always use createVoiceTools() instead of the module-level singletons
 * (searchVoicesTool / getVoiceByIdTool / listVoiceLabelsTool) when running multiple
 * concurrent VoiceAssignmentAgent calls. The singletons share a global Set and will
 * collide across concurrent requests — each project must have its own isolated scope.
 *
 * Usage:
 *   const { searchVoicesTool, getVoiceByIdTool, listVoiceLabelsTool, reset } = createVoiceTools();
 *   reset(); // clear before agent loop
 */
export function createVoiceTools() {
  const scopedUsedVoiceIds = new Set<string>();

  const reset = () => scopedUsedVoiceIds.clear();

  const searchVoices = buildSearchVoicesTool(scopedUsedVoiceIds);
  const getVoiceById = buildGetVoiceByIdTool(scopedUsedVoiceIds);
  const listVoiceLabels = buildListVoiceLabelsTool();
  const commitVoice = buildCommitVoiceTool(scopedUsedVoiceIds);

  return {
    searchVoicesTool: searchVoices,
    getVoiceByIdTool: getVoiceById,
    listVoiceLabelsTool: listVoiceLabels,
    commitVoiceTool: commitVoice,
    resetUsedVoices: reset,
  };
}

// ── Module-level singletons (legacy — safe only for sequential single-project use) ──

const _globalUsedVoiceIds = new Set<string>();

/** @deprecated Use createVoiceTools() for concurrent safety. */
export function resetUsedVoices(): void {
  _globalUsedVoiceIds.clear();
}

/** @deprecated Use createVoiceTools() for concurrent safety. */
export function markVoiceUsed(voiceId: string): void {
  _globalUsedVoiceIds.add(voiceId);
}

/** @deprecated Use createVoiceTools() for concurrent safety. */
export function getUsedVoiceIds(): string[] {
  return Array.from(_globalUsedVoiceIds);
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

// Re-export detectAgeRangeFromLabel as parseAgeRangeFromLabel for local use
const parseAgeRangeFromLabel = detectAgeRangeFromLabel;

// ─────────────────────────────────────────────────────────────────────────────
// Tool builder functions — each takes a scoped Set so instances don't collide
// ─────────────────────────────────────────────────────────────────────────────

function buildSearchVoicesTool(scopedUsed: Set<string>) {
  return tool({
  description: `Search for voice profiles matching character descriptions.
Returns voice profiles with voice_id, name, label, gender, tone, style, and description.
IMPORTANT: Each voice can only be assigned to ONE character.

The 'query' parameter describes the character's narrative role AND vocal quality
(e.g., "fierce warrior, commanding and deep" or "warm motherly mentor, calm and
reassuring storyteller"). Include voice-quality hints like "calm", "energetic",
"raspy", "deep" directly in the query — it is matched against voice names and
descriptions. Use 'style' separately for accent/ethnicity-specific filtering.

Parameters:
- query: Character description + vocal quality hints (ALWAYS provide this)
- gender: "Male" or "Female" (REQUIRED — wrong gender is eliminated)
- label: Age hint like "Teen", "Older", "Young Adult", "Narrator"
- style: Accent/ethnicity like "African American", "American", "British"

Scoring model:
- Gender: hard gate (wrong gender = eliminated)
- Age: proximity spectrum (exact match best, adjacent ranges still score well)
- Style/Ethnicity + Narrative query: equally weighted soft scores`,

  inputSchema: z.object({
    query: z.string().describe('Character narrative + vocal quality hints (required)'),
    gender: z.enum(['Male', 'Female']).optional().describe('Gender hard-gate filter'),
    label: z.string().optional().describe('Age/category filter (e.g., "Teen", "Older", "Narrator")'),
    style: z.string().optional().describe('Accent/ethnicity filter (e.g., "British", "African American")'),
    top_k: z.number().default(3).describe('Number of results to return'),
  }),

  execute: async ({ query, gender, label, style, top_k = 3 }) => {
    try {
      log.debug('searchVoices searching', { query, gender, label, style });

      // Determine if this is a narrator search
      const isNarrator = query.toLowerCase().includes('narrator') || label?.toLowerCase().includes('narrator');

      // Parse age range from label
      const ageRange = parseAgeRangeFromLabel(label);

      // Use hybrid search (attribute-based, no embeddings).
      // `tone` is no longer a tool input — voice quality hints live in `query`.
      const result = await searchVoicesHybrid({
        characterName: query,
        gender,
        ageRange,
        style,
        isNarrator,
        excludeVoiceIds: Array.from(scopedUsed),
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

      log.debug('searchVoices found voices', { count: formattedVoices.length, source: result.source });

      return {
        status: 'success',
        message: result.message || `Found ${formattedVoices.length} matching voices`,
        voices: formattedVoices,
        source: result.source,
      };
    } catch (err) {
      log.error('searchVoices error', err instanceof Error ? err : undefined);
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Search failed',
        voices: [],
      };
    }
  },
  });
}

function buildGetVoiceByIdTool(scopedUsed: Set<string>) {
  return tool({
  description: 'Get a specific voice profile by its ID. Use this to verify a voice selection.',

  inputSchema: z.object({
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
        is_used: scopedUsed.has(voice_id),
      },
    };
  },
  });
}

function buildListVoiceLabelsTool() {
  return tool({
  description: 'List all available voice labels/categories. Use this to understand what voice types are available.',

  inputSchema: z.object({}),

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
}

function buildCommitVoiceTool(scopedUsed: Set<string>) {
  return tool({
  description: `Reserve a voice after assigning it to a character.
Call this immediately after deciding on a voice — it marks the voice as used
so it is excluded from all subsequent search_voices results for this project.
MUST be called once per character assignment.`,

  inputSchema: z.object({
    voice_id: z.string().describe('The ElevenLabs voice ID to reserve'),
    character_name: z.string().describe('The character this voice is being reserved for'),
  }),

  execute: async ({ voice_id, character_name }) => {
    scopedUsed.add(voice_id);
    log.debug('commitVoice reserved', { voice_id, character_name, total: scopedUsed.size });
    return {
      status: 'success',
      message: `Voice ${voice_id} reserved for ${character_name}. Excluded from future searches.`,
      reserved_count: scopedUsed.size,
    };
  },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy module-level singletons — backed by _globalUsedVoiceIds
// Safe only when one script is processed at a time. Prefer createVoiceTools().
// ─────────────────────────────────────────────────────────────────────────────
export const searchVoicesTool = buildSearchVoicesTool(_globalUsedVoiceIds);
export const getVoiceByIdTool = buildGetVoiceByIdTool(_globalUsedVoiceIds);
export const listVoiceLabelsTool = buildListVoiceLabelsTool();
