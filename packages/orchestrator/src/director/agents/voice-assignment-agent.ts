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
  buildVoiceAssignmentFromSampleUserMessage,
} from '../prompts/voice-assignment-prompt.js';
import { createVoiceTools } from '../tools/voice-search.js';
import {
  VoiceMapSchema,
  VoiceMapLLMSchema,
  llmVoiceMapToVoiceMap,
  DEFAULT_NARRATOR_VOICE,
  DEFAULT_MALE_VOICE,
  DEFAULT_FEMALE_VOICE,
  type VoiceMap,
  type VoiceMapLLM,
} from '../../schemas/voice-map.js';
import type { CharacterManifest } from '../../schemas/character-manifest.js';
import { parseJSONSafely } from '../../lib/json-repair.js';

/**
 * Voice assignment is tool-heavy but each decision is shallow: "given this
 * character profile + a tool result of 3 candidate voices, pick one". Sonnet's
 * deeper reasoning isn't load-bearing here — Haiku handles it at ~1/12 the
 * cost. Default to Haiku 4.5; override via `VOICE_ASSIGNMENT_MODEL` if the
 * cheaper model ever regresses on casting quality.
 *
 * NOTE: this does NOT fall through to DIRECTOR_MODEL — the whole point is to
 * decouple voice assignment from the heavier director pipeline.
 */
const DEFAULT_MODEL = process.env.VOICE_ASSIGNMENT_MODEL || 'anthropic/claude-haiku-4-5';

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
      mode: 'manifest-only',
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

    // Scale iterations with cast size: each character needs ~4–5 tool calls
    // (search_voices, get_voice, list_voice_labels, commit_voice, plus any
    // retry). A 25-character cast needs ~125 iterations; the base 30 would
    // exhaust at ~6 characters and fall back to default voices for everyone else.
    const scaledMaxIterations = Math.max(this.maxIterations, manifest.characters.length * 5);

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

  /**
   * Phase B: assign voices from a stitched dialogue sample.
   *
   * Same tool-loop machinery as `assign()`, but the user message includes
   * real dialogue context — the model picks voices based on actual speech
   * patterns rather than on derived character descriptions.
   *
   * Wire-in is gated by the `DIRECTOR_VOICE_FROM_SAMPLE` feature flag in
   * `director-agent.ts`; this method is callable directly today for tests
   * and dev experimentation but does not run in the live pipeline unless
   * the flag is on.
   *
   * Cost shape: input is ~6× larger (manifest ~5K tokens → manifest +
   * stitched sample ~25–35K tokens) so the call is ~$0.05–0.08 cheaper-tier
   * cost increase per run. Quality unlock is what justifies the trade.
   */
  async assignFromSample(input: {
    manifest: CharacterManifest;
    stitchedSampleText: string;
  }): Promise<VoiceMap> {
    const { manifest, stitchedSampleText } = input;
    const start = Date.now();

    log.info('[VoiceAssignment] starting', {
      model: this.model,
      characterCount: manifest.characters.length,
      mode: 'sample-driven',
      sampleChars: stitchedSampleText.length,
    });

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

    const userMessage = buildVoiceAssignmentFromSampleUserMessage(
      manifest,
      stitchedSampleText,
    );

    const scaledMaxIterations = Math.max(
      this.maxIterations,
      manifest.characters.length * 5,
    );

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
      log.error(
        '[VoiceAssignment] sample-driven agent loop failed',
        err instanceof Error ? err : undefined,
      );
      throw new Error(
        `VoiceAssignmentAgent (sample mode) failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const elapsedSec = Math.round((Date.now() - start) / 1000);
    log.info('[VoiceAssignment] sample-driven agent loop complete', {
      elapsedSec,
      rawLength: rawText.length,
      mode: 'sample-driven',
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
        // Use the LLM-array variant — Anthropic structured output rejects the
        // record-shape `additionalProperties: <object>` of VoiceMapSchema.
        const llm = await structureTextAsJSON(rawText, {
          model: this.model,
          schema: VoiceMapLLMSchema,
          context: `Convert to a valid VoiceMap. project_id: "${projectId}". Return assignments as an array; one entry per character name.`,
        });
        return this.addDefaults(llmVoiceMapToVoiceMap(llm as VoiceMapLLM), projectId);
      } catch (err) {
        log.error('[VoiceAssignment] structureTextAsJSON fallback failed', err instanceof Error ? err : undefined);
        throw new Error(
          'VoiceAssignment failed: could not parse agent output into a valid VoiceMap. ' +
          'Retrying the generation may resolve this.',
        );
      }
    }

    // Replace null default-voice fields with constants so Zod validation passes
    // without triggering the expensive LLM repair path.
    if (parsed && typeof parsed === 'object') {
      const p = parsed as Record<string, unknown>;
      if (p.default_narrator_voice == null) p.default_narrator_voice = DEFAULT_NARRATOR_VOICE;
      if (p.default_male_voice == null) p.default_male_voice = DEFAULT_MALE_VOICE;
      if (p.default_female_voice == null) p.default_female_voice = DEFAULT_FEMALE_VOICE;
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
          schema: VoiceMapLLMSchema,
          context: `Fix this JSON to match the VoiceMap schema. project_id: "${projectId}". Return assignments as an array; one entry per character name.`,
        });
        return this.addDefaults(llmVoiceMapToVoiceMap(fixed as VoiceMapLLM), projectId);
      } catch {
        throw new Error(
          'VoiceAssignment failed: agent produced an invalid VoiceMap that could not be repaired. ' +
          'Retrying the generation may resolve this.',
        );
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

}
