/**
 * Scene Construction Agent — Pass 3 of 3
 *
 * Splits the screenplay into scene-boundary-aligned chunks and constructs
 * DirectorJSON Scene objects for each chunk using generateStructuredOutput.
 *
 * Key properties:
 * - NO tool calls: voice_key values come from the pre-built VoiceMap
 * - Chunks are processed in parallel (Promise.allSettled)
 * - Each chunk is bounded in size, so output JSON never hits token limits
 * - A failed chunk is logged and skipped; the pipeline continues with
 *   successful chunks rather than failing completely
 */

import { generateStructuredOutput } from '../../lib/llm-client.js';
import { log } from '../../lib/logger.js';
import {
  buildSceneConstructionSystemPrompt,
  buildSceneConstructionUserMessage,
} from '../prompts/scene-construction-prompt.js';
import { chunkScript, type ScriptChunk } from '../utils/script-chunker.js';
import { SceneSchema, type Scene } from '../../schemas/director-json.js';
import type { VoiceMap } from '../../schemas/voice-map.js';
import { z } from 'zod';

const DEFAULT_MODEL = process.env.DIRECTOR_MODEL || 'openai/gpt-4.1';
const DEFAULT_SCENES_PER_CHUNK = 15;
// Generous token budget: a 15-scene chunk outputs ~8K tokens of JSON
const SCENE_CONSTRUCTION_MAX_TOKENS = 32768;

// Output schema for one chunk: an object wrapping the scenes array.
// Using z.object (not z.array) at the top level works better with generateObject.
const ChunkOutputSchema = z.object({
  scenes: z.array(SceneSchema),
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
    this.model = options.model || DEFAULT_MODEL;
    this.scenesPerChunk = options.scenesPerChunk || DEFAULT_SCENES_PER_CHUNK;
  }

  /**
   * Parse the full screenplay into an ordered Scene array.
   *
   * The script is split into chunks. Each chunk is parsed independently and
   * results are concatenated in order. Failed chunks are logged and skipped.
   */
  async construct(input: SceneConstructionInput): Promise<Scene[]> {
    const start = Date.now();
    const chunks = chunkScript(input.script_text, this.scenesPerChunk);

    log.info('[SceneConstruction] starting', {
      model: this.model,
      chunkCount: chunks.length,
      scenesPerChunk: this.scenesPerChunk,
    });

    // Dispatch all chunks in parallel
    const results = await Promise.allSettled(
      chunks.map((chunk) => this.constructChunk(chunk, input.voice_map))
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

  private async constructChunk(chunk: ScriptChunk, voiceMap: VoiceMap): Promise<Scene[]> {
    const chunkStart = Date.now();

    log.info('[SceneConstruction] constructing chunk', {
      chunk_index: chunk.chunk_index,
      start_scene_num: chunk.start_scene_num,
      end_scene_num: chunk.end_scene_num,
      textLength: chunk.text.length,
    });

    const systemPrompt = buildSceneConstructionSystemPrompt(voiceMap, chunk.start_scene_num);
    const userMessage = buildSceneConstructionUserMessage(chunk.text);

    let output: z.infer<typeof ChunkOutputSchema>;

    try {
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

    return scenes;
  }
}
