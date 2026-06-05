/**
 * Voice Assignment Agent — Pass 2 of 3
 *
 * Receives the CharacterManifest and assigns a unique ElevenLabs voice to
 * each character by calling voice search tools.
 *
 * Unlike the legacy DirectorAgent (which parsed the entire script AND assigned
 * voices in one pass), this agent operates only on the compact character list
 * (~50-100 entries), making each tool call relevant and targeted.
 *
 * Returns a validated VoiceMap.
 */

import { runAgentLoop, structureTextAsJSON } from '../../lib/llm-client.js';
import { log } from '../../lib/logger.js';
import {
  VOICE_ASSIGNMENT_SYSTEM_PROMPT,
  buildVoiceAssignmentUserMessage,
} from '../prompts/voice-assignment-prompt.js';
import { createVoiceTools } from '../tools/voice-search.js';
import {
  VoiceMapSchema,
  DEFAULT_NARRATOR_VOICE,
  DEFAULT_MALE_VOICE,
  DEFAULT_FEMALE_VOICE,
  type VoiceMap,
} from '../../schemas/voice-map.js';
import type { CharacterManifest } from '../../schemas/character-manifest.js';
import { parseJSONSafely } from '../../lib/json-repair.js';

const DEFAULT_MODEL = process.env.DIRECTOR_MODEL || 'openai/gpt-4.1';

export interface VoiceAssignmentOptions {
  model?: string;
  maxIterations?: number;
}

export class VoiceAssignmentAgent {
  private model: string;
  private maxIterations: number;

  constructor(options: VoiceAssignmentOptions = {}) {
    this.model = options.model || DEFAULT_MODEL;
    this.maxIterations = options.maxIterations || 30;
  }

  /**
   * Assign voices to every character in the manifest.
   * Returns a validated VoiceMap.
   */
  async assign(input: { manifest: CharacterManifest }): Promise<VoiceMap> {
    const { manifest } = input;
    const start = Date.now();

    log.info('[VoiceAssignment] starting', {
      model: this.model,
      characterCount: manifest.characters.length,
    });

    // Scoped tools: each invocation gets its own used-voice Set (concurrent-safe)
    const {
      searchVoicesTool,
      getVoiceByIdTool,
      listVoiceLabelsTool,
      commitVoiceTool,
      resetUsedVoices,
    } = createVoiceTools();
    resetUsedVoices();

    const tools = {
      search_voices: searchVoicesTool,
      get_voice: getVoiceByIdTool,
      list_voice_labels: listVoiceLabelsTool,
      commit_voice: commitVoiceTool,
    };

    const userMessage = buildVoiceAssignmentUserMessage(manifest);

    // Scale iterations with cast size: each character needs ~4 tool calls
    // (search_voices, get_voice, commit_voice, confirm). A 25-character script
    // needs 100 iterations; the base 30 would exhaust at ~7 characters and
    // fall back to default voices for everyone else.
    const scaledMaxIterations = Math.max(this.maxIterations, manifest.characters.length * 4);

    let rawText: string;
    try {
      rawText = await runAgentLoop(userMessage, {
        model: this.model,
        systemPrompt: VOICE_ASSIGNMENT_SYSTEM_PROMPT,
        tools,
        maxIterations: scaledMaxIterations,
        maxTokens: 8192,
        temperature: 0.3,
      });
    } catch (err) {
      log.error('[VoiceAssignment] agent loop failed', err instanceof Error ? err : undefined);
      throw new Error(`VoiceAssignmentAgent failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    const elapsedSec = Math.round((Date.now() - start) / 1000);
    log.info('[VoiceAssignment] agent loop complete', {
      elapsedSec,
      rawLength: rawText.length,
    });

    return this.parseAndValidate(rawText, manifest.project_id);
  }

  // ─────────────────────────────────────────────────────────────────────────

  private async parseAndValidate(rawText: string, projectId: string): Promise<VoiceMap> {
    // Attempt 1: direct JSON parse
    const parseResult = parseJSONSafely<unknown>(rawText);

    let parsed: unknown;

    if (parseResult.success) {
      parsed = parseResult.data;
    } else {
      log.warn('[VoiceAssignment] JSON parse failed — trying structureTextAsJSON', {
        error: parseResult.error,
      });
      try {
        parsed = await structureTextAsJSON(rawText, {
          model: this.model,
          schema: VoiceMapSchema,
          context: `Convert to a valid VoiceMap. project_id: "${projectId}".`,
        });
        // structureTextAsJSON already validates against schema — return directly
        return this.addDefaults(parsed as VoiceMap, projectId);
      } catch (err) {
        log.error('[VoiceAssignment] structureTextAsJSON fallback failed', err instanceof Error ? err : undefined);
        // Return a minimal valid VoiceMap with defaults so the pipeline can continue
        log.warn('[VoiceAssignment] returning minimal fallback VoiceMap');
        return this.buildFallbackVoiceMap(projectId);
      }
    }

    // Validate with Zod
    const validation = VoiceMapSchema.safeParse(parsed);
    if (!validation.success) {
      log.warn('[VoiceAssignment] schema validation failed — trying structured fix', {
        issues: validation.error.issues,
      });
      try {
        const fixed = await structureTextAsJSON(JSON.stringify(parsed), {
          model: this.model,
          schema: VoiceMapSchema,
          context: `Fix this JSON to match VoiceMap schema. project_id: "${projectId}".`,
        });
        return this.addDefaults(fixed as VoiceMap, projectId);
      } catch {
        log.warn('[VoiceAssignment] schema fix failed — returning minimal fallback VoiceMap');
        return this.buildFallbackVoiceMap(projectId);
      }
    }

    return this.addDefaults(validation.data, projectId);
  }

  /**
   * Ensure project_id and default voices are set even if the model omitted them.
   * Also scans for duplicate voice_key assignments and logs warnings.
   */
  private addDefaults(voiceMap: VoiceMap, projectId: string): VoiceMap {
    const result: VoiceMap = {
      ...voiceMap,
      project_id: voiceMap.project_id || projectId,
      default_narrator_voice: voiceMap.default_narrator_voice || DEFAULT_NARRATOR_VOICE,
      default_male_voice: voiceMap.default_male_voice || DEFAULT_MALE_VOICE,
      default_female_voice: voiceMap.default_female_voice || DEFAULT_FEMALE_VOICE,
    };

    // Detect duplicate voice_key assignments — same voice used for two different characters
    const seenKeys = new Map<string, string>(); // voice_key → first character name
    for (const [charName, assignment] of Object.entries(result.assignments)) {
      const { voice_key } = assignment;
      if (seenKeys.has(voice_key)) {
        log.warn('[VoiceAssignment] duplicate voice_key detected', {
          voice_key,
          character1: seenKeys.get(voice_key),
          character2: charName,
        });
      } else {
        seenKeys.set(voice_key, charName);
      }
    }

    return result;
  }

  /**
   * Build a minimal fallback VoiceMap using only default voices.
   * Used when the agent loop produces unrecoverable output.
   * The SceneConstructionAgent will use defaults for every character.
   */
  private buildFallbackVoiceMap(projectId: string): VoiceMap {
    return {
      project_id: projectId,
      assignments: {
        NARRATOR: {
          canonical_name: 'NARRATOR',
          voice_key: DEFAULT_NARRATOR_VOICE,
          voice_name: 'George (default narrator)',
        },
      },
      default_narrator_voice: DEFAULT_NARRATOR_VOICE,
      default_male_voice: DEFAULT_MALE_VOICE,
      default_female_voice: DEFAULT_FEMALE_VOICE,
    };
  }
}
