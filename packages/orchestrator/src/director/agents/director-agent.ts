/**
 * Director Agent - Parses scripts into structured JSON with voice assignments
 *
 * This is the TypeScript port of Python's DirectorAgent class.
 * It uses the Vercel AI SDK for LLM inference and the semantic search tools
 * for voice selection.
 */

import { runAgentLoop } from '../../lib/llm-client.js';
import { DIRECTOR_SYSTEM_PROMPT } from '../prompts/director-prompt.js';
import {
  searchVoicesTool,
  getVoiceByIdTool,
  listVoiceLabelsTool,
  resetUsedVoices,
} from '../tools/voice-search.js';
import { DirectorJSONSchema, type DirectorJSON } from '../../schemas/director-json.js';

// Default model from environment
const DEFAULT_MODEL = process.env.DIRECTOR_MODEL || 'openai/gpt-4.1';

export interface DirectorAgentOptions {
  model?: string;
  maxIterations?: number;
}

export interface DirectorAgentInput {
  project_id: string;
  script_text: string;
}

/**
 * Director Agent - Converts screenplay text to structured Director JSON
 */
export class DirectorAgent {
  private model: string;
  private maxIterations: number;

  constructor(options: DirectorAgentOptions = {}) {
    this.model = options.model || DEFAULT_MODEL;
    this.maxIterations = options.maxIterations || 20;
  }

  /**
   * Process a script and return Director JSON
   */
  async run(input: DirectorAgentInput): Promise<string> {
    // Reset used voices for this script
    resetUsedVoices();

    const userInput = JSON.stringify({
      project_id: input.project_id,
      script_text: input.script_text,
    });

    console.log(`[DirectorAgent] Starting with model: ${this.model}`);
    console.log(`[DirectorAgent] Script length: ${input.script_text.length} characters`);

    const tools = {
      search_voices: searchVoicesTool,
      get_voice: getVoiceByIdTool,
      list_voice_labels: listVoiceLabelsTool,
    };

    try {
      const result = await runAgentLoop(userInput, {
        model: this.model,
        systemPrompt: DIRECTOR_SYSTEM_PROMPT,
        tools,
        maxIterations: this.maxIterations,
        maxTokens: 16384,
        temperature: 1,
      });

      console.log(`[DirectorAgent] Completed successfully`);
      return result;
    } catch (err) {
      console.error('[DirectorAgent] Error:', err);
      throw err;
    }
  }

  /**
   * Process a script and return validated Director JSON
   *
   * Uses Zod schema validation to ensure type safety at the LLM boundary.
   * This is the primary public method - returns properly typed DirectorJSON.
   */
  async process(input: DirectorAgentInput): Promise<DirectorJSON> {
    const result = await this.run(input);

    // Try to extract JSON from the response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from DirectorAgent response');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.error('[DirectorAgent] Failed to parse JSON:', err);
      throw new Error(`Invalid JSON from DirectorAgent: ${err}`);
    }

    // Validate with Zod schema - this provides runtime type safety
    const validation = DirectorJSONSchema.safeParse(parsed);
    if (!validation.success) {
      console.error('[DirectorAgent] Schema validation failed:', validation.error.issues);
      throw new Error(
        `DirectorAgent output failed schema validation: ${validation.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join(', ')}`
      );
    }

    console.log(`[DirectorAgent] Output validated: ${validation.data.scenes.length} scenes`);
    return validation.data;
  }
}
