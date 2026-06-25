/**
 * Scene Construction Agent — Pass 3 of 3
 *
 * Splits the screenplay into scene-boundary-aligned chunks and constructs
 * DirectorJSON Scene objects for each chunk using generateStructuredOutput.
 *
 * Key properties:
 * - NO tool calls: voice_key values come from the pre-built VoiceMap
 * - Chunks are processed with bounded parallelism (pLimit(3)) to avoid
 *   exhausting Claude's concurrent-request quota on dense scripts
 * - Each chunk is bounded in size, so output JSON never hits token limits
 * - A failed chunk is logged and skipped; the pipeline continues with
 *   successful chunks rather than failing completely
 */

import pLimit from 'p-limit';
import { generateStructuredOutput } from '../../lib/llm-client.js';
import { log } from '../../lib/logger.js';
import { getEnv } from '../../lib/env.js';
import {
  buildSceneConstructionSystemPrompt,
  buildSceneConstructionUserMessage,
} from '../prompts/scene-construction-prompt.js';
import { chunkScript, type ScriptChunk } from '../utils/script-chunker.js';
import { DialogueLineSchema, type Scene } from '../../schemas/director-json.js';
import type { VoiceMap } from '../../schemas/voice-map.js';
import { z } from 'zod';

const DEFAULT_MODEL = process.env.DIRECTOR_MODEL || 'openai/gpt-4.1';
// Cap concurrent Claude calls to avoid 429s on dense scripts (6+ chunks).
// 3 means a 90-scene script processes in 2 waves of 3 rather than 6 at once.
const MAX_CONCURRENT_CHUNKS = 3;

// Trimmed AudioCue schema for LLM output. Omits `reasoning` and `fade_out`
// (internal fields the LLM need not produce) so the total optional-parameter
// count stays under the Anthropic API limit of 24 across the full chunk schema.
// AudioCueSchema appears 3 times (music/ambience/sfx), so each dropped field
// saves 3 toward the budget.
const LLMAudioCueSchema = z.object({
  file: z.string(),
  start_at: z.union([z.string(), z.number()]).optional(),
  end_at: z.number().optional(),
  duration: z.number().optional(),
  volume: z.number().optional(),
});

// Trimmed Scene schema for LLM output. Omits `mix` (per-scene mix overrides
// are set by the audio pipeline post-construction, not by the director LLM).
// Dropping `mix` removes 6 optional parameters (1 for the field + 5 MixParams).
const LLMSceneSchema = z.object({
  scene_id: z.string(),
  summary: z.string().optional(),
  mood: z.string().optional(),
  intensity: z.number().optional(),
  dialogue: z.array(DialogueLineSchema),
  music: z.array(LLMAudioCueSchema).optional(),
  ambience: z.array(LLMAudioCueSchema).optional(),
  sfx: z.array(LLMAudioCueSchema).optional(),
});

// Output schema for one chunk: an object wrapping the scenes array.
// Using z.object (not z.array) at the top level works better with generateObject.
// Total optional parameters: 6 (LLMSceneSchema) + 4 (DialogueLine) +
// 4×3 (LLMAudioCue × 3 arrays) = 22, within the API limit of 24.
const ChunkOutputSchema = z.object({
  scenes: z.array(LLMSceneSchema),
});

export interface SceneConstructionOptions {
  model?: string;
  scenesPerChunk?: number;
}

export interface SceneConstructionInput {
  project_id: string;
  script_text: string;
  voice_map: VoiceMap;
}

export class SceneConstructionAgent {
  private model: string;
  private scenesPerChunk: number;

  constructor(options: SceneConstructionOptions = {}) {
    const env = getEnv();
    this.model = options.model || DEFAULT_MODEL;
    this.scenesPerChunk = options.scenesPerChunk || env.SCENES_PER_CHUNK;
  }

  /**
   * Parse the full screenplay into an ordered Scene array.
   *
   * The script is split into chunks. Each chunk is parsed independently and
   * results are concatenated in order. Failed chunks are logged and skipped.
   */
  async construct(input: SceneConstructionInput): Promise<Scene[]> {
    const start = Date.now();

    // Phase D-3: when DIRECTOR_PASS3_ADAPTIVE_CHUNKS=true, pick the chunk
    // size dynamically from script density before chunking. Otherwise use
    // the static this.scenesPerChunk from env / constructor (current behavior).
    let effectiveScenesPerChunk = this.scenesPerChunk;
    if (process.env.DIRECTOR_PASS3_ADAPTIVE_CHUNKS === 'true') {
      try {
        const { pickChunkSize } = await import('../sampling/adaptive-chunk-sizer.js');
        const env = getEnv();
        const adaptive = pickChunkSize(input.script_text, {
          maxOutputTokens: env.SCENE_CONSTRUCTION_MAX_TOKENS,
          fallbackScenesPerChunk: this.scenesPerChunk,
        });
        effectiveScenesPerChunk = adaptive.scenesPerChunk;
        log.info('[SceneConstruction] Phase D-3 adaptive chunk size', {
          original: this.scenesPerChunk,
          adaptive: adaptive.scenesPerChunk,
          ...adaptive.reasoning,
        });
      } catch (sizerErr) {
        log.warn('[SceneConstruction] Phase D-3 adaptive sizer failed, falling back to static', {
          error: sizerErr instanceof Error ? sizerErr.message : String(sizerErr),
        });
      }
    }

    const chunks = chunkScript(input.script_text, effectiveScenesPerChunk);

    log.info('[SceneConstruction] starting', {
      model: this.model,
      chunkCount: chunks.length,
      scenesPerChunk: effectiveScenesPerChunk,
      adaptiveMode: process.env.DIRECTOR_PASS3_ADAPTIVE_CHUNKS === 'true',
    });

    // Phase D-2 (cue pre-tagging) needs the script's CharacterIndex once,
    // then per-chunk we splice tags for the cues whose offsets fall inside.
    // Computed once outside the parallel loop so we don't re-derive it per
    // chunk. Gated by the same DIRECTOR_PASS3_ADAPTIVE_CHUNKS flag because
    // the tagged text only helps when paired with the trimmed prompt.
    const adaptiveMode = process.env.DIRECTOR_PASS3_ADAPTIVE_CHUNKS === 'true';
    let characterIndex: import('../sampling/character-index.js').CharacterIndex | null = null;
    if (adaptiveMode) {
      try {
        const { buildCharacterIndex } = await import('../sampling/character-index.js');
        characterIndex = buildCharacterIndex(input.script_text);
      } catch (idxErr) {
        log.warn('[SceneConstruction] Phase D-2 character index build failed, tagging disabled', {
          error: idxErr instanceof Error ? idxErr.message : String(idxErr),
        });
      }
    }

    // Dispatch chunks with bounded parallelism — avoids saturating Claude's
    // concurrent-request quota on dense scripts that produce 6+ chunks.
    const limit = pLimit(MAX_CONCURRENT_CHUNKS);
    const results = await Promise.allSettled(
      chunks.map((chunk) =>
        limit(() => this.constructChunk(chunk, input.voice_map, input.script_text, characterIndex)),
      ),
    );

    // Collect successful results in order
    const allScenes: Scene[] = [];
    let failedChunks = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        allScenes.push(...result.value);
      } else {
        failedChunks++;
        log.error(
          `[SceneConstruction] chunk ${i} failed`,
          result.reason instanceof Error ? result.reason : undefined,
          { chunk_index: i, scene_range: `${chunks[i].start_scene_num}-${chunks[i].end_scene_num}` }
        );
      }
    }

    const elapsedSec = Math.round((Date.now() - start) / 1000);
    log.info('[SceneConstruction] complete', {
      elapsedSec,
      totalScenes: allScenes.length,
      successfulChunks: chunks.length - failedChunks,
      failedChunks,
    });

    if (allScenes.length === 0) {
      throw new Error(
        `SceneConstructionAgent produced no scenes (${failedChunks}/${chunks.length} chunks failed)`
      );
    }

    return allScenes;
  }

  // ─────────────────────────────────────────────────────────────────────────

  private async constructChunk(
    chunk: ScriptChunk,
    voiceMap: VoiceMap,
    scriptText?: string,
    characterIndex?: import('../sampling/character-index.js').CharacterIndex | null,
  ): Promise<Scene[]> {
    const chunkStart = Date.now();

    log.info('[SceneConstruction] constructing chunk', {
      chunk_index: chunk.chunk_index,
      start_scene_num: chunk.start_scene_num,
      end_scene_num: chunk.end_scene_num,
      textLength: chunk.text.length,
    });

    // Phase D-2: when a CharacterIndex is provided (adaptive mode), tag
    // character cues with [SPEAKER: NAME] annotations. The tightened
    // prompt below tells the LLM to use the annotation as the source of
    // truth for speaker attribution.
    let chunkTextForLlm = chunk.text;
    let cueTagCount = 0;
    if (characterIndex && scriptText) {
      try {
        const { tagChunkWithCues } = await import('../sampling/cue-tagger.js');
        // Find this chunk's start offset in the original script. chunkScript
        // doesn't expose it, so we re-derive by searching. This is O(N) per
        // chunk but happens once per chunk — negligible compared to the LLM call.
        const chunkStartOffset = scriptText.indexOf(chunk.text);
        if (chunkStartOffset >= 0) {
          const tagged = tagChunkWithCues(chunk.text, chunkStartOffset, characterIndex);
          chunkTextForLlm = tagged.taggedText;
          cueTagCount = tagged.tagCount;
        }
      } catch (tagErr) {
        log.warn('[SceneConstruction] Phase D-2 cue tagging failed, using raw chunk', {
          error: tagErr instanceof Error ? tagErr.message : String(tagErr),
        });
      }
    }

    const useCueAnnotations = cueTagCount > 0;
    const systemPrompt = buildSceneConstructionSystemPrompt(
      voiceMap,
      chunk.start_scene_num,
      useCueAnnotations,
    );
    const userMessage = buildSceneConstructionUserMessage(chunkTextForLlm);

    let output: z.infer<typeof ChunkOutputSchema>;

    try {
      const { SCENE_CONSTRUCTION_MAX_TOKENS } = getEnv();
      // Phase D-4: project output size before the call so we see near-cap
      // chunks BEFORE they fail. ~0.09 output tokens per char of input.
      const projectedOutputTokens = Math.round(chunkTextForLlm.length * 0.09);
      const headroomPct = SCENE_CONSTRUCTION_MAX_TOKENS > 0
        ? Math.round(((SCENE_CONSTRUCTION_MAX_TOKENS - projectedOutputTokens) / SCENE_CONSTRUCTION_MAX_TOKENS) * 100)
        : 0;
      log.info('[SceneConstruction] chunk projection', {
        chunk_index: chunk.chunk_index,
        inputChars: chunkTextForLlm.length,
        projectedOutputTokens,
        maxOutputTokens: SCENE_CONSTRUCTION_MAX_TOKENS,
        headroomPct,
        useCueAnnotations,
        cueTagCount,
      });
      output = await generateStructuredOutput(userMessage, {
        model: this.model,
        schema: ChunkOutputSchema,
        systemPrompt,
        maxTokens: SCENE_CONSTRUCTION_MAX_TOKENS,
        temperature: 0,
      });
    } catch (err) {
      throw new Error(
        `Chunk ${chunk.chunk_index} (scenes ${chunk.start_scene_num}-${chunk.end_scene_num}) failed: ` +
          (err instanceof Error ? err.message : String(err))
      );
    }

    const scenes = output.scenes;
    const elapsedSec = Math.round((Date.now() - chunkStart) / 1000);

    log.info('[SceneConstruction] chunk complete', {
      chunk_index: chunk.chunk_index,
      elapsedSec,
      sceneCount: scenes.length,
    });

    // Light validation: warn if scene count differs from expected
    const expectedCount = chunk.end_scene_num - chunk.start_scene_num + 1;
    if (Math.abs(scenes.length - expectedCount) > 2) {
      log.warn('[SceneConstruction] unexpected scene count in chunk', {
        chunk_index: chunk.chunk_index,
        expected: expectedCount,
        got: scenes.length,
      });
    }

    return scenes as Scene[];
  }
}
