/**
 * Adaptive chunk sizing for Pass 3 — Phase D-3.
 *
 * The static `SCENES_PER_CHUNK` env (default 10 after #407) is one-size-fits-
 * all. It treats a sparse procedural (1K chars/scene) the same as a dense
 * dialogue-driven drama (3K+ chars/scene). The dense case is what causes
 * `NoObjectGeneratedError` when chunk output exceeds the cap — and the
 * sparse case wastes throughput on tiny LLM calls.
 *
 * This sizer uses Pass 0's CharacterIndex (which already gave us scene
 * boundaries and per-cue offsets) to compute chars-per-scene density,
 * then picks a chunk size that targets ~70 % of the configured output
 * token budget. Dense scripts get smaller chunks; sparse scripts get
 * larger ones.
 *
 * The sizer is purely advisory — its output replaces a single constant
 * (`scenesPerChunk`) on the SceneConstructionAgent. All Phase D-3 logic
 * lives in this module; the agent only consults it.
 */

import { extractSceneInfo } from '../utils/script-chunker.js';

export interface AdaptiveSizeOptions {
  /** Configured cap from env (#407 default 32768). */
  maxOutputTokens: number;
  /** Default chunk size when adaptation can't apply (e.g. no scenes). */
  fallbackScenesPerChunk: number;
  /**
   * Conservative upper bound on chunk size. Even on extremely sparse
   * scripts we don't want one chunk to cover 30 scenes — it makes
   * retries expensive when a single chunk fails. Default 15.
   */
  maxScenesPerChunk?: number;
  /**
   * Hard floor. Even a hyper-dense script shouldn't have 1-scene chunks
   * — round-trip overhead would dominate wall-clock. Default 4.
   */
  minScenesPerChunk?: number;
  /**
   * Target output utilization. 0.70 means we aim for chunks whose
   * projected output is 70 % of `maxOutputTokens`, leaving 30 % headroom
   * for the variance the model introduces. Default 0.70.
   */
  targetUtilization?: number;
}

export interface AdaptiveSizeResult {
  /** Recommended scenes-per-chunk value. Clamped to [min, max]. */
  scenesPerChunk: number;
  /**
   * Telemetry summary so callers can log "why this number" without
   * re-doing the math.
   */
  reasoning: {
    sceneCount: number;
    avgCharsPerScene: number;
    densityBucket: 'sparse' | 'moderate' | 'dense' | 'very_dense' | 'unknown';
    projectedOutputTokens: number;
    targetOutputTokens: number;
    clampedTo: 'min' | 'max' | 'computed';
  };
}

/**
 * Token-output projection per scene. Scenes vary wildly, but a useful
 * baseline holds: every 1 char of input scene text produces ~0.35 chars
 * of JSON output (dialogue text + voice_key + character + scene_id +
 * line_id + small metadata). At 4 chars/token that's ~0.088 tokens of
 * output per char of input.
 *
 * Calibrated against jobId 8d8b3b71 on dev (10-page script, ~18K chars,
 * produced ~1.5K output tokens per chunk on 2-chunk runs).
 */
const OUTPUT_TOKENS_PER_INPUT_CHAR = 0.09;

export function pickChunkSize(
  scriptText: string,
  options: AdaptiveSizeOptions,
): AdaptiveSizeResult {
  const max = options.maxScenesPerChunk ?? 15;
  const min = options.minScenesPerChunk ?? 4;
  const target = options.targetUtilization ?? 0.70;

  const scenes = extractSceneInfo(scriptText);
  if (scenes.length === 0) {
    return {
      scenesPerChunk: options.fallbackScenesPerChunk,
      reasoning: {
        sceneCount: 0,
        avgCharsPerScene: 0,
        densityBucket: 'unknown',
        projectedOutputTokens: 0,
        targetOutputTokens: options.maxOutputTokens * target,
        clampedTo: 'computed',
      },
    };
  }

  // Average input chars per scene.
  let totalChars = 0;
  for (const s of scenes) totalChars += s.end_index - s.start_index;
  const avgCharsPerScene = totalChars / scenes.length;

  // Density bucket (purely for telemetry / log readability).
  const densityBucket =
    avgCharsPerScene > 3000
      ? 'very_dense'
      : avgCharsPerScene > 2000
      ? 'dense'
      : avgCharsPerScene > 1000
      ? 'moderate'
      : 'sparse';

  const targetOutputTokens = options.maxOutputTokens * target;
  const projectedOutputPerScene = avgCharsPerScene * OUTPUT_TOKENS_PER_INPUT_CHAR;
  const idealScenesPerChunk = projectedOutputPerScene > 0
    ? Math.floor(targetOutputTokens / projectedOutputPerScene)
    : options.fallbackScenesPerChunk;

  let scenesPerChunk = idealScenesPerChunk;
  let clampedTo: AdaptiveSizeResult['reasoning']['clampedTo'] = 'computed';
  if (scenesPerChunk < min) {
    scenesPerChunk = min;
    clampedTo = 'min';
  } else if (scenesPerChunk > max) {
    scenesPerChunk = max;
    clampedTo = 'max';
  }

  // Project the actual output size we expect at the chosen chunk size,
  // so the caller can log "we picked 7 because projected output is 21K".
  const projectedOutputTokens = scenesPerChunk * projectedOutputPerScene;

  return {
    scenesPerChunk,
    reasoning: {
      sceneCount: scenes.length,
      avgCharsPerScene: Math.round(avgCharsPerScene),
      densityBucket,
      projectedOutputTokens: Math.round(projectedOutputTokens),
      targetOutputTokens: Math.round(targetOutputTokens),
      clampedTo,
    },
  };
}
