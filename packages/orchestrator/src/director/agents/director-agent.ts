/**
 * Director Agent - Parses scripts into structured JSON with voice assignments
 *
 * This is the TypeScript port of Python's DirectorAgent class.
 * It uses the Vercel AI SDK for LLM inference and the semantic search tools
 * for voice selection.
 */

import { runAgentLoop, structureTextAsJSON } from '../../lib/llm-client.js';
import { log } from '../../lib/logger.js';
import { DIRECTOR_SYSTEM_PROMPT } from '../prompts/director-prompt.js';
import {
  searchVoicesTool,
  getVoiceByIdTool,
  listVoiceLabelsTool,
  resetUsedVoices,
} from '../tools/voice-search.js';
import { DirectorJSONSchema, type DirectorJSON } from '../../schemas/director-json.js';
import { parseJSONSafely, extractJSON, repairJSON } from '../../lib/json-repair.js';

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
    this.maxIterations = options.maxIterations || 30;
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

    log.info('DirectorAgent starting', { model: this.model, scriptLength: input.script_text.length });

    const tools = {
      search_voices: searchVoicesTool,
      get_voice: getVoiceByIdTool,
      list_voice_labels: listVoiceLabelsTool,
    };

    const agentStart = Date.now();
    try {
      const result = await runAgentLoop(userInput, {
        model: this.model,
        systemPrompt: DIRECTOR_SYSTEM_PROMPT,
        tools,
        maxIterations: this.maxIterations,
        maxTokens: 32768,
        temperature: 1,
      });

      const elapsedSec = Math.round((Date.now() - agentStart) / 1000);
      log.info('[DirectorAgent] completed', {
        elapsedSec,
        resultLength: result.length,
        hasJSON: result.includes('{'),
      });
      return result;
    } catch (err) {
      const elapsedSec = Math.round((Date.now() - agentStart) / 1000);
      log.error('[DirectorAgent] error', err instanceof Error ? err : undefined, { elapsedSec });
      throw err;
    }
  }

  /**
   * Process a script and return validated Director JSON
   *
   * Uses Zod schema validation to ensure type safety at the LLM boundary.
   * Falls back to structured output generation if JSON parsing fails.
   * This is the primary public method - returns properly typed DirectorJSON.
   */
  async process(input: DirectorAgentInput): Promise<DirectorJSON> {
    const result = await this.run(input);

    // Log the raw response for debugging
    log.info('[DirectorAgent] raw response', {
      responseLength: result.length,
      hasJSON: result.includes('{'),
      preview: result.slice(0, 300),
    });

    // Use robust JSON extraction and repair
    const parseResult = parseJSONSafely<unknown>(result);

    let parsed: unknown;

    if (!parseResult.success) {
      // Log full response on failure for diagnosis
      log.warn('[DirectorAgent] JSON parse failed', {
        error: parseResult.error,
        responseLength: result.length,
        fullResponse: result.length <= 4000 ? result : result.slice(0, 2000) + '\n...[truncated]...\n' + result.slice(-500),
      });

      // Fallback: Use AI SDK structured output to convert the text
      log.info('DirectorAgent attempting structured output conversion');
      try {
        const structured = await structureTextAsJSON<DirectorJSON>(result, {
          schema: DirectorJSONSchema,
          context: `This is output from a screenplay parsing AI agent. Convert it to valid Director JSON with project_id: "${input.project_id}".`,
        });
        log.info('DirectorAgent structured output conversion successful');
        return structured;
      } catch (structErr) {
        log.error('DirectorAgent structured output conversion also failed', structErr instanceof Error ? structErr : undefined);

        // Try one more approach: extract and repair manually with more logging
        const extracted = extractJSON(result);
        if (extracted) {
          log.debug('DirectorAgent extracted JSON preview', { preview: extracted.slice(0, 300) });
          const repaired = repairJSON(extracted);
          log.debug('DirectorAgent repaired JSON preview', { preview: repaired.slice(0, 300) });

          // Try parsing the repaired JSON
          try {
            parsed = JSON.parse(repaired);
            log.info('DirectorAgent repaired JSON parsed successfully');
          } catch (repairErr) {
            throw new Error(`Failed to parse JSON from DirectorAgent after all attempts: ${parseResult.error}`);
          }
        } else {
          throw new Error(`Failed to parse JSON from DirectorAgent: ${parseResult.error}`);
        }
      }
    } else {
      parsed = parseResult.data;
    }

    // Validate with Zod schema - this provides runtime type safety
    const validation = DirectorJSONSchema.safeParse(parsed);
    if (!validation.success) {
      log.error('DirectorAgent schema validation failed', undefined, { issues: validation.error.issues });

      // Final fallback: use structured output to fix schema issues
      log.info('DirectorAgent attempting schema fix via structured output');
      try {
        const fixed = await structureTextAsJSON<DirectorJSON>(JSON.stringify(parsed), {
          schema: DirectorJSONSchema,
          context: `Fix this JSON to match the DirectorJSON schema. project_id should be "${input.project_id}".`,
        });
        log.info('DirectorAgent schema fix successful');
        return fixed;
      } catch (fixErr) {
        throw new Error(
          `DirectorAgent output failed schema validation: ${validation.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join(', ')}`
        );
      }
    }

    log.info('DirectorAgent output validated', { sceneCount: validation.data.scenes.length });
    return validation.data;
  }
}
