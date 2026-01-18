/**
 * Audio Director Agent - Selects music, ambience, and SFX for scenes
 *
 * This is the TypeScript port of Python's AudioDirectorAgent class.
 * It uses the Vercel AI SDK for LLM inference and the semantic search tools
 * for audio selection.
 */

import { runAgentLoop } from '../../lib/llm-client.js';
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
   * Accepts DirectorJSON (typed) or string for flexibility.
   */
  async process(directorJson: DirectorJSON | string): Promise<SceneAudioJSON> {
    const input = typeof directorJson === 'string'
      ? directorJson
      : JSON.stringify(directorJson);

    const result = await this.run(input);

    // Try to extract JSON from the response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from AudioDirectorAgent response');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.error('[AudioDirectorAgent] Failed to parse JSON:', err);
      throw new Error(`Invalid JSON from AudioDirectorAgent: ${err}`);
    }

    // Validate with Zod schema - this provides runtime type safety
    const validation = SceneAudioJSONSchema.safeParse(parsed);
    if (!validation.success) {
      console.error('[AudioDirectorAgent] Schema validation failed:', validation.error.issues);
      throw new Error(
        `AudioDirectorAgent output failed schema validation: ${validation.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join(', ')}`
      );
    }

    console.log(`[AudioDirectorAgent] Output validated: ${validation.data.scenes.length} scenes`);
    return validation.data;
  }
}
