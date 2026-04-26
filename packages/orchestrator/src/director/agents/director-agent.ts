/**
 * Director Agent — 3-pass multi-agent screenplay parser
 *
 * Replaces the single-pass approach that caused "No JSON object found in input"
 * on 15-page scripts. The old approach tangled voice casting with scene parsing
 * in one massive agent loop, forcing the model to output ~18K+ tokens of JSON
 * in a single call — which was truncated.
 *
 * NEW ARCHITECTURE (three passes):
 *
 *   Pass 1 — CharacterExtractionAgent
 *     Reads the full script. Extracts every speaking character with attributes.
 *     Uses generateStructuredOutput (no tools, fast, typed output).
 *     Output: CharacterManifest (~50-100 character entries).
 *
 *   Pass 2 — VoiceAssignmentAgent
 *     Receives the compact CharacterManifest.
 *     Calls voice-search tools systematically for each character.
 *     Each call is targeted (knows gender, age, description) — no guessing.
 *     Voice consistency is guaranteed: all assignments happen ONCE before
 *     any scene is parsed.
 *     Output: VoiceMap (character name → voice_key for every alias + canonical).
 *
 *   Pass 3 — SceneConstructionAgent
 *     Splits the script into ~15-scene chunks.
 *     Each chunk is parsed in parallel using generateStructuredOutput.
 *     The VoiceMap is embedded in the system prompt — no tool calls needed.
 *     JSON is schema-enforced so no repair is required.
 *     Output: Scene[] (all chunks concatenated in order).
 *
 * The legacy run() + legacyProcess() methods are preserved for testing
 * and as a fallback if the multi-pass pipeline encounters a catastrophic error.
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
import { CharacterExtractionAgent } from './character-extraction-agent.js';
import { VoiceAssignmentAgent } from './voice-assignment-agent.js';
import { SceneConstructionAgent } from './scene-construction-agent.js';

// Default model from environment
const DEFAULT_MODEL = process.env.DIRECTOR_MODEL || 'openai/gpt-4.1';

export interface DirectorAgentOptions {
  model?: string;
  maxIterations?: number;
  /** Scenes per chunk for Pass 3. Default: 15. Lower = smaller chunks, more parallel calls. */
  scenesPerChunk?: number;
  /**
   * Pre-built VoiceMap from a previous run.
   * When provided, Pass 2 (VoiceAssignmentAgent) is skipped entirely —
   * the cached map is used directly. Enables voice consistency across re-runs
   * without re-querying ElevenLabs.
   */
  cachedVoiceMap?: import('../../schemas/voice-map.js').VoiceMap;
}

export interface DirectorAgentInput {
  project_id: string;
  script_text: string;
}

/**
 * Director Agent — converts screenplay text to structured DirectorJSON.
 *
 * Call process() for the multi-pass pipeline (recommended).
 * Call run() for the legacy single-pass approach (testing / fallback only).
 */
export class DirectorAgent {
  private model: string;
  private maxIterations: number;
  private scenesPerChunk: number;
  private cachedVoiceMap: import('../../schemas/voice-map.js').VoiceMap | undefined;
  /** The VoiceMap produced by Pass 2 in the most recent process() call. */
  lastVoiceMap: import('../../schemas/voice-map.js').VoiceMap | undefined;

  constructor(options: DirectorAgentOptions = {}) {
    this.model = options.model || DEFAULT_MODEL;
    this.maxIterations = options.maxIterations || 30;
    this.scenesPerChunk = options.scenesPerChunk || 15;
    this.cachedVoiceMap = options.cachedVoiceMap;
  }

  // ─── Multi-pass pipeline ─────────────────────────────────────────────────

  /**
   * Multi-pass pipeline: CharacterExtraction → VoiceAssignment → SceneConstruction.
   *
   * This is the primary public method. Falls back to the legacy single-pass
   * approach if the multi-pass pipeline fails catastrophically.
   */
  async process(input: DirectorAgentInput): Promise<DirectorJSON> {
    log.info('[DirectorAgent] starting multi-pass pipeline', {
      project_id: input.project_id,
      scriptLength: input.script_text.length,
    });

    const pipelineStart = Date.now();

    try {
      // ── Pass 1: Extract characters ──────────────────────────────────────
      const extractor = new CharacterExtractionAgent({ model: this.model });
      const manifest = await extractor.extract({
        project_id: input.project_id,
        script_text: input.script_text,
      });
      log.info('[DirectorAgent] Pass 1 complete', {
        characterCount: manifest.characters.length,
      });

      // ── Pass 2: Assign voices (skipped if cachedVoiceMap provided) ─────────
      let voiceMap: import('../../schemas/voice-map.js').VoiceMap;
      if (this.cachedVoiceMap) {
        voiceMap = this.cachedVoiceMap;
        log.info('[DirectorAgent] Pass 2 skipped — using cached VoiceMap', {
          assignmentCount: Object.keys(voiceMap.assignments).length,
        });
      } else {
        const voiceAssigner = new VoiceAssignmentAgent({
          model: this.model,
          maxIterations: this.maxIterations,
        });
        voiceMap = await voiceAssigner.assign({ manifest });
        this.lastVoiceMap = voiceMap;
        log.info('[DirectorAgent] Pass 2 complete', {
          assignmentCount: Object.keys(voiceMap.assignments).length,
        });
      }

      // ── Pass 3: Construct scenes (chunked, parallel) ────────────────────
      const sceneConstructor = new SceneConstructionAgent({
        model: this.model,
        scenesPerChunk: this.scenesPerChunk,
      });
      const scenes = await sceneConstructor.construct({
        project_id: input.project_id,
        script_text: input.script_text,
        voice_map: voiceMap,
      });
      log.info('[DirectorAgent] Pass 3 complete', { sceneCount: scenes.length });

      // ── Assemble and validate final DirectorJSON ────────────────────────
      const result: DirectorJSON = {
        project_id: input.project_id,
        scenes,
      };

      const validation = DirectorJSONSchema.safeParse(result);
      if (!validation.success) {
        log.error('[DirectorAgent] schema validation failed after multi-pass', undefined, {
          issues: validation.error.issues,
        });
        const fixed = await structureTextAsJSON<DirectorJSON>(JSON.stringify(result), {
          model: this.model,
          schema: DirectorJSONSchema,
          context: `Fix this DirectorJSON. project_id: "${input.project_id}".`,
        });
        const elapsedSec = Math.round((Date.now() - pipelineStart) / 1000);
        log.info('[DirectorAgent] multi-pass complete (with schema fix)', {
          elapsedSec,
          sceneCount: fixed.scenes.length,
        });
        return fixed;
      }

      const elapsedSec = Math.round((Date.now() - pipelineStart) / 1000);
      log.info('[DirectorAgent] multi-pass pipeline complete', {
        elapsedSec,
        sceneCount: validation.data.scenes.length,
      });
      return validation.data;
    } catch (err) {
      const elapsedSec = Math.round((Date.now() - pipelineStart) / 1000);
      log.error(
        '[DirectorAgent] multi-pass pipeline failed — falling back to single-pass (1 attempt)',
        err instanceof Error ? err : undefined,
        { elapsedSec }
      );
      // Capped at exactly 1 legacy attempt — prevents runaway cost on systematically bad input
      return this.legacyProcess(input);
    }
  }

  // ─── Legacy single-pass (preserved for testing + fallback) ──────────────

  /**
   * Legacy single-pass process — calls run() and parses the result.
   * Used as a fallback when the multi-pass pipeline fails.
   */
  async legacyProcess(input: DirectorAgentInput): Promise<DirectorJSON> {
    const result = await this.run(input);

    log.info('[DirectorAgent] legacy raw response', {
      responseLength: result.length,
      hasJSON: result.includes('{'),
      preview: result.slice(0, 300),
    });

    const parseResult = parseJSONSafely<unknown>(result);
    let parsed: unknown;

    if (!parseResult.success) {
      log.warn('[DirectorAgent] JSON parse failed', {
        error: parseResult.error,
        fullResponse:
          result.length <= 4000
            ? result
            : result.slice(0, 2000) + '\n...[truncated]...\n' + result.slice(-500),
      });

      log.info('[DirectorAgent] attempting structured output conversion');
      try {
        const structured = await structureTextAsJSON<DirectorJSON>(result, {
          model: this.model,
          schema: DirectorJSONSchema,
          context: `Convert to valid Director JSON. project_id: "${input.project_id}".`,
        });
        log.info('[DirectorAgent] structured output conversion successful');
        return structured;
      } catch (structErr) {
        log.error(
          '[DirectorAgent] structured output conversion failed',
          structErr instanceof Error ? structErr : undefined
        );
        const extracted = extractJSON(result);
        if (extracted) {
          const repaired = repairJSON(extracted);
          try {
            parsed = JSON.parse(repaired);
          } catch {
            throw new Error(
              `Failed to parse JSON from DirectorAgent after all attempts: ${parseResult.error}`
            );
          }
        } else {
          throw new Error(`Failed to parse JSON from DirectorAgent: ${parseResult.error}`);
        }
      }
    } else {
      parsed = parseResult.data;
    }

    const validation = DirectorJSONSchema.safeParse(parsed);
    if (!validation.success) {
      log.error('[DirectorAgent] schema validation failed', undefined, {
        issues: validation.error.issues,
      });
      try {
        const fixed = await structureTextAsJSON<DirectorJSON>(JSON.stringify(parsed), {
          model: this.model,
          schema: DirectorJSONSchema,
          context: `Fix this JSON to match DirectorJSON schema. project_id: "${input.project_id}".`,
        });
        return fixed;
      } catch {
        throw new Error(
          `DirectorAgent output failed schema validation: ${validation.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join(', ')}`
        );
      }
    }

    log.info('[DirectorAgent] legacy output validated', {
      sceneCount: validation.data.scenes.length,
    });
    return validation.data;
  }

  /**
   * Run the legacy single-pass agent loop.
   * Returns raw LLM text (not parsed).
   *
   * Preserved for backward compatibility with existing tests.
   */
  async run(input: DirectorAgentInput): Promise<string> {
    resetUsedVoices();

    const userInput = JSON.stringify({
      project_id: input.project_id,
      script_text: input.script_text,
    });

    log.info('[DirectorAgent] legacy run starting', {
      model: this.model,
      scriptLength: input.script_text.length,
    });

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
      log.info('[DirectorAgent] legacy run complete', {
        elapsedSec,
        resultLength: result.length,
        hasJSON: result.includes('{'),
      });
      return result;
    } catch (err) {
      const elapsedSec = Math.round((Date.now() - agentStart) / 1000);
      log.error(
        '[DirectorAgent] legacy run error',
        err instanceof Error ? err : undefined,
        { elapsedSec }
      );
      throw err;
    }
  }
}
