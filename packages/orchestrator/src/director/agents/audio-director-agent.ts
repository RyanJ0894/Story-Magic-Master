/**
 * Audio Director Agent - Selects music, ambience, and SFX for scenes
 *
 * This is the TypeScript port of Python's AudioDirectorAgent class.
 * It uses the Vercel AI SDK for LLM inference and the semantic search tools
 * for audio selection.
 */

import { runAgentLoop, structureTextAsJSON } from '../../lib/llm-client.js';
import { AUDIO_DIRECTOR_SYSTEM_PROMPT } from '../prompts/audio-director-prompt.js';
import {
  searchMusicTool,
  searchAmbienceTool,
  searchSfxTool,
  listAudioGroupsTool,
  getAudioByIdTool,
} from '../tools/audio-search.js';
import {
  SceneAudioJSONSchema,
  type SceneAudioJSON,
  type DirectorJSON,
} from '../../schemas/director-json.js';
import { parseJSONSafely, extractJSON, repairJSON } from '../../lib/json-repair.js';

// Default model from environment
const DEFAULT_MODEL = process.env.AUDIO_DIRECTOR_MODEL || 'openai/gpt-4.1';

export interface AudioDirectorAgentOptions {
  model?: string;
  maxIterations?: number;
}

/**
 * Audio Director Agent - Analyzes Director JSON and selects audio for scenes
 */
export class AudioDirectorAgent {
  private model: string;
  private maxIterations: number;

  constructor(options: AudioDirectorAgentOptions = {}) {
    this.model = options.model || DEFAULT_MODEL;
    this.maxIterations = options.maxIterations || 20;
  }

  /**
   * Process Director JSON and return Scene Audio JSON
   */
  async run(directorJson: string): Promise<string> {
    console.log(`[AudioDirectorAgent] Starting with model: ${this.model}`);

    const tools = {
      search_music: searchMusicTool,
      search_ambience: searchAmbienceTool,
      search_sfx: searchSfxTool,
      list_audio_groups: listAudioGroupsTool,
      get_audio: getAudioByIdTool,
    };

    try {
      const result = await runAgentLoop(directorJson, {
        model: this.model,
        systemPrompt: AUDIO_DIRECTOR_SYSTEM_PROMPT,
        tools,
        maxIterations: this.maxIterations,
        maxTokens: 16384,
        temperature: 1,
      });

      console.log(`[AudioDirectorAgent] Completed successfully`);
      return result;
    } catch (err) {
      console.error('[AudioDirectorAgent] Error:', err);
      throw err;
    }
  }

  /**
   * Process Director JSON and return validated Scene Audio JSON
   *
   * Uses Zod schema validation to ensure type safety at the LLM boundary.
   * Falls back to structured output generation if JSON parsing fails.
   * Accepts DirectorJSON (typed) or string for flexibility.
   */
  async process(directorJson: DirectorJSON | string): Promise<SceneAudioJSON> {
    const input = typeof directorJson === 'string'
      ? directorJson
      : JSON.stringify(directorJson);

    // Get project_id for context
    const projectId = typeof directorJson === 'string'
      ? JSON.parse(directorJson).project_id || 'unknown'
      : directorJson.project_id;

    const result = await this.run(input);

    // Log the raw response for debugging (first 500 chars)
    console.log('[AudioDirectorAgent] Raw response preview:', result.slice(0, 500));

    // Use robust JSON extraction and repair
    const parseResult = parseJSONSafely<unknown>(result);

    let parsed: unknown;

    if (!parseResult.success) {
      // Log the failure
      console.warn('[AudioDirectorAgent] Initial JSON parse failed:', parseResult.error);
      console.warn('[AudioDirectorAgent] Response length:', result.length);

      // Fallback: Use AI SDK structured output to convert the text
      console.log('[AudioDirectorAgent] Attempting structured output conversion...');
      try {
        const structured = await structureTextAsJSON<SceneAudioJSON>(result, {
          schema: SceneAudioJSONSchema,
          context: `This is output from an audio selection AI agent. Convert it to valid SceneAudioJSON with project_id: "${projectId}".`,
        });
        console.log('[AudioDirectorAgent] Structured output conversion successful');
        return structured;
      } catch (structErr) {
        console.error('[AudioDirectorAgent] Structured output conversion also failed:', structErr);

        // Try one more approach: extract and repair manually
        const extracted = extractJSON(result);
        if (extracted) {
          console.error('[AudioDirectorAgent] Extracted JSON preview:', extracted.slice(0, 300));
          const repaired = repairJSON(extracted);
          console.error('[AudioDirectorAgent] Repaired JSON preview:', repaired.slice(0, 300));

          try {
            parsed = JSON.parse(repaired);
            console.log('[AudioDirectorAgent] Repaired JSON parsed successfully');
          } catch (repairErr) {
            throw new Error(`Failed to parse JSON from AudioDirectorAgent after all attempts: ${parseResult.error}`);
          }
        } else {
          throw new Error(`Failed to parse JSON from AudioDirectorAgent: ${parseResult.error}`);
        }
      }
    } else {
      parsed = parseResult.data;
    }

    // Validate with Zod schema - this provides runtime type safety
    const validation = SceneAudioJSONSchema.safeParse(parsed);
    if (!validation.success) {
      console.error('[AudioDirectorAgent] Schema validation failed:', validation.error.issues);

      // Final fallback: use structured output to fix schema issues
      console.log('[AudioDirectorAgent] Attempting schema fix via structured output...');
      try {
        const fixed = await structureTextAsJSON<SceneAudioJSON>(JSON.stringify(parsed), {
          schema: SceneAudioJSONSchema,
          context: `Fix this JSON to match the SceneAudioJSON schema. project_id should be "${projectId}".`,
        });
        console.log('[AudioDirectorAgent] Schema fix successful');
        return fixed;
      } catch (fixErr) {
        throw new Error(
          `AudioDirectorAgent output failed schema validation: ${validation.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join(', ')}`
        );
      }
    }

    console.log(`[AudioDirectorAgent] Output validated: ${validation.data.scenes.length} scenes`);
    return validation.data;
  }
}
