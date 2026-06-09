/**
 * Audio Director Agent - Selects music, ambience, and SFX for scenes
 *
 * This is the TypeScript port of Python's AudioDirectorAgent class.
 * It uses the Vercel AI SDK for LLM inference and the semantic search tools
 * for audio selection.
 */

import { runAgentLoop, structureTextAsJSON } from '../../lib/llm-client.js';
import { log } from '../../lib/logger.js';
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

// Default model from environment.
// Haiku 4.5 is intentional — audio search is tool-heavy but each individual
// decision (music/ambience/SFX selection) is shallow. Mirrors the voice-assignment
// shift in PR #179. Does NOT fall through to DIRECTOR_MODEL so the cheaper default
// holds even when DIRECTOR_MODEL is overridden to Sonnet for reasoning paths.
const DEFAULT_MODEL = process.env.AUDIO_DIRECTOR_MODEL || 'anthropic/claude-haiku-4-5';

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
   * Process Director JSON and return Scene Audio JSON.
   * @param directorJson - serialized DirectorJSON
   * @param scriptContext - optional genre/tone/era block to prepend (from extractScriptContext)
   */
  async run(directorJson: string, scriptContext?: string): Promise<string> {
    log.info('AudioDirectorAgent starting', { model: this.model, hasScriptContext: !!scriptContext });

    const userMessage = scriptContext ? `${scriptContext}${directorJson}` : directorJson;

    const tools = {
      search_music: searchMusicTool,
      search_ambience: searchAmbienceTool,
      search_sfx: searchSfxTool,
      list_audio_groups: listAudioGroupsTool,
      get_audio: getAudioByIdTool,
    };

    try {
      const result = await runAgentLoop(userMessage, {
        model: this.model,
        systemPrompt: AUDIO_DIRECTOR_SYSTEM_PROMPT,
        tools,
        maxIterations: this.maxIterations,
        maxTokens: 16384,
        temperature: 1,
      });

      log.info('AudioDirectorAgent completed successfully');
      return result;
    } catch (err) {
      log.error('AudioDirectorAgent error', err instanceof Error ? err : undefined);
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
  async process(directorJson: DirectorJSON | string, scriptContext?: string): Promise<SceneAudioJSON> {
    const input = typeof directorJson === 'string'
      ? directorJson
      : JSON.stringify(directorJson);

    // Get project_id for context
    const projectId = typeof directorJson === 'string'
      ? JSON.parse(directorJson).project_id || 'unknown'
      : directorJson.project_id;

    const result = await this.run(input, scriptContext);

    // Log the raw response for debugging (first 500 chars)
    log.debug('AudioDirectorAgent raw response preview', { preview: result.slice(0, 500) });

    // Use robust JSON extraction and repair
    const parseResult = parseJSONSafely<unknown>(result);

    let parsed: unknown;

    if (!parseResult.success) {
      // Log the failure
      log.warn('AudioDirectorAgent initial JSON parse failed', { error: parseResult.error, responseLength: result.length });

      // Fallback: Use AI SDK structured output to convert the text
      log.info('AudioDirectorAgent attempting structured output conversion');
      try {
        const structured = await structureTextAsJSON<SceneAudioJSON>(result, {
          schema: SceneAudioJSONSchema,
          context: `This is output from an audio selection AI agent. Convert it to valid SceneAudioJSON with project_id: "${projectId}".`,
        });
        log.info('AudioDirectorAgent structured output conversion successful');
        return structured;
      } catch (structErr) {
        log.error('AudioDirectorAgent structured output conversion also failed', structErr instanceof Error ? structErr : undefined);

        // Try one more approach: extract and repair manually
        const extracted = extractJSON(result);
        if (extracted) {
          log.debug('AudioDirectorAgent extracted JSON preview', { preview: extracted.slice(0, 300) });
          const repaired = repairJSON(extracted);
          log.debug('AudioDirectorAgent repaired JSON preview', { preview: repaired.slice(0, 300) });

          try {
            parsed = JSON.parse(repaired);
            log.info('AudioDirectorAgent repaired JSON parsed successfully');
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
      log.error('AudioDirectorAgent schema validation failed', undefined, { issues: validation.error.issues });

      // Final fallback: use structured output to fix schema issues
      log.info('AudioDirectorAgent attempting schema fix via structured output');
      try {
        const fixed = await structureTextAsJSON<SceneAudioJSON>(JSON.stringify(parsed), {
          schema: SceneAudioJSONSchema,
          context: `Fix this JSON to match the SceneAudioJSON schema. project_id should be "${projectId}".`,
        });
        log.info('AudioDirectorAgent schema fix successful');
        return fixed;
      } catch (fixErr) {
        throw new Error(
          `AudioDirectorAgent output failed schema validation: ${validation.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join(', ')}`
        );
      }
    }

    log.info('AudioDirectorAgent output validated', { sceneCount: validation.data.scenes.length });
    return validation.data;
  }
}
