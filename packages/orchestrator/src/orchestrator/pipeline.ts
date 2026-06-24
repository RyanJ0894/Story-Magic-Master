/**
 * Orchestrator Pipeline - Main audio generation workflow
 *
 * Coordinates the full orchestration process with parallel processing:
 * 1. Validate Director JSON
 * 2. Generate TTS for ALL scenes in parallel (storygraph-aware)
 * 3. Progressive scene assembly (align + cues + timeline + mix)
 * 4. Final concatenation with crossfades
 * 5. Generate playback manifest
 *
 * This pipeline leverages parallel processing for:
 * - TTS generation across all scenes simultaneously
 * - Scene mixing as soon as TTS for that scene completes
 */

import 'dotenv/config';
import { execa } from 'execa';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';
import { log } from '../lib/logger.js';

import { DirectorJSONSchema, type DirectorJSON, type Scene } from '../schemas/director-json.js';
import { ttsForScene, type StemResult } from './workers/tts.js';
import { parallelTTSGenerate, type TTSProgress, type ParallelTTSResult } from './workers/parallel-tts.js';
import { progressiveStitch, finalConcatenation, type ProgressiveStitchProgress } from './workers/progressive-stitch.js';
import { alignScene, type SceneAlignment, type LineAlignment } from './workers/align.js';
import { pickCues, type SceneCues } from './workers/cues.js';
import { buildTimeline, type Timeline } from './workers/timeline.js';
import { mixScene } from './workers/mixer.js';
import { concatScenesWithCrossfade, makePlaybackManifest, type PlaybackManifest } from './workers/export.js';
import { loadCatalog, type AudioCatalog } from '../lib/catalog-loader.js';
import { resolveCuesToMixInputs, getDefaultMixParams } from './shared/resolve-cues.js';
import { getOutputDir } from '../lib/env.js';

const ffmpeg = ffmpegStatic as unknown as string;

if (!ffmpeg) {
  throw new Error('FFmpeg binary not found. Please ensure ffmpeg-static is installed.');
}

// Progress callback types for external consumers
export interface PipelineProgress {
  step: 'validating' | 'tts' | 'assembling' | 'stitching' | 'manifest' | 'complete';
  percent: number;
  message: string;
  details?: TTSProgress | ProgressiveStitchProgress;
}

export type PipelineProgressCallback = (progress: PipelineProgress) => void;

export interface SceneOutput {
  scene_id: string;
  path: string;
  timeline: Timeline;
  alignment: SceneAlignment;
  cues: SceneCues;
}

export interface OrchestrationResult {
  project_id: string;
  output_dir: string;
  episode_path: string;
  manifest_path: string;
  scenes: SceneOutput[];
  audio_urls: (string | null)[];
  manifest: PlaybackManifest | null;
  /** Tracks requested by the AudioDirector that could not be resolved — surfaces to the user. */
  mix_warnings: string[];
}

// concatenateDialogueStems extracted to shared/concat-stems.ts
import { concatenateDialogueStems } from './shared/concat-stems.js';
import {
  computeSceneRenderHash,
  findCachedSceneRender,
  recordSceneRender,
} from '../lib/scene-cache.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate project_id is a UUID and return a path-safe copy. Throws on invalid input. */
function safeId(id: string, label: string): string {
  if (!UUID_RE.test(id)) throw new Error(`Invalid ${label} format: ${id}`);
  // path.basename is a taint-clear step that strips any residual separators
  return path.basename(id);
}

/**
 * Validate constraints that can't live in the Zod schema because the schema
 * is also used for LLM structured output (Anthropic rejects minLength/minItems
 * in `generateObject` input). This function asserts the HTTP-input invariants
 * the LLM-bound schema can no longer enforce.
 */
function assertHttpDirectorJSONInvariants(director: import('../schemas/director-json.js').DirectorJSON): void {
  const issues: string[] = [];
  for (const scene of director.scenes) {
    for (const line of scene.dialogue) {
      if (typeof line.text !== 'string' || line.text.trim() === '') {
        issues.push(
          `scenes[${scene.scene_id}].dialogue[${line.line_id}].text: dialogue text must be non-empty`
        );
      }
    }
  }
  if (issues.length > 0) {
    throw new Error('Invalid Director JSON: ' + JSON.stringify(issues));
  }
}

/**
 * Per-user audio-tuning overrides. Same shape as
 * `packages/web/lib/services/audio-tuning.ts::AudioTuningDto` minus the
 * housekeeping fields. When undefined, the pipeline uses in-code defaults
 * (matches legacy behavior pre-B-003).
 *
 * Threaded through scene-cache hashing so a tuning change invalidates the
 * cache automatically.
 */
export interface OrchestrateAudioTuning {
  musicGainOffsetDb: number;
  ambienceGainOffsetDb: number;
  sfxGainOffsetDb: number;
  narrationSpeed: number;
}

/**
 * Main orchestration pipeline
 */
export async function orchestrate(
  directorJSON: unknown,
  options: {
    chunkIndex?: number;
    audioTuning?: OrchestrateAudioTuning;
    /**
     * #372: when true, every scene_renders lookup is treated as a MISS.
     * Used by the "Re-render audio (reuse cached AI)" UI toggle so QA
     * can exercise the TTS path without burning Anthropic on already-
     * cached directorJson. Fresh output is still written to the cache.
     */
    forceFreshTts?: boolean;
  } = {},
): Promise<OrchestrationResult> {
  log.info('Validating Director JSON');
  const parsed = DirectorJSONSchema.safeParse(directorJSON);
  if (!parsed.success) {
    throw new Error('Invalid Director JSON: ' + JSON.stringify(parsed.error.issues));
  }
  const director = parsed.data;
  assertHttpDirectorJSONInvariants(director);
  const safeProjectId = safeId(director.project_id, 'project_id');

  log.generation(director.project_id, 'validation-complete', {
    sceneCount: director.scenes.length,
  });

  log.info('Loading audio catalog');
  const catalog: AudioCatalog = loadCatalog();

  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const projectDir = path.join(getOutputDir(), safeProjectId);
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const scenesDir = path.join(projectDir, 'scenes');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(scenesDir, { recursive: true });

  const sceneOutputs: SceneOutput[] = [];
  const mixWarnings: string[] = [];

  for (let i = 0; i < director.scenes.length; i++) {
    const scene = director.scenes[i];
    // Strip any path separators from scene_id before using in filenames
    const safeSceneId = path.basename(scene.scene_id);

    log.generation(director.project_id, 'scene-start', {
      sceneIndex: i + 1,
      totalScenes: director.scenes.length,
      sceneId: scene.scene_id,
    });

    // T2-2 (#190): scene-level idempotency cache. If this scene's inputs
    // hash to a previously rendered output AND the file still exists,
    // skip the entire alignment + cue + timeline + mix block.
    // B-003: include the user's audio tuning in the hash so a tuning change
    // invalidates the cache. Otherwise locking new slider values would
    // silently return the old render and the feature would break.
    const sceneContentHash = computeSceneRenderHash(scene, options.audioTuning);
    const cachedScenePath = await findCachedSceneRender(
      director.project_id,
      scene.scene_id,
      sceneContentHash,
      { forceFreshTts: options.forceFreshTts },
    );
    if (cachedScenePath) {
      log.info('[scene-cache] HIT — reusing cached scene render', {
        sceneId: scene.scene_id,
        scenePath: cachedScenePath,
        contentHash: sceneContentHash.slice(0, 12),
      });
      // Timeline / alignment / cues are not consumed downstream of this
      // function — only `path` is used for concatenation + manifest. We
      // surface empty placeholders to keep the SceneOutput shape stable
      // for external consumers.
      sceneOutputs.push({
        scene_id: scene.scene_id,
        path: cachedScenePath,
        timeline: { events: [] } as unknown as Timeline,
        alignment: { lines: [] } as unknown as SceneAlignment,
        cues: { music: [], ambience: [], sfx: [] } as unknown as SceneCues,
      });
      continue;
    }

    log.generation(director.project_id, 'tts-start', {
      sceneId: scene.scene_id,
      dialogueLines: scene.dialogue.length,
    });
    const stems = await ttsForScene(director.project_id, scene, {
      narrationSpeed: options.audioTuning?.narrationSpeed,
    });
    log.generation(director.project_id, 'tts-complete', {
      sceneId: scene.scene_id,
      stemCount: stems.length,
    });

    log.generation(director.project_id, 'alignment-start', { sceneId: scene.scene_id });
    const alignment = await alignScene(director.project_id, scene, stems);
    log.generation(director.project_id, 'alignment-complete', {
      sceneId: scene.scene_id,
      lineCount: alignment.lines.length,
    });

    log.generation(director.project_id, 'cue-selection-start', { sceneId: scene.scene_id });
    const cues = await pickCues(scene, catalog);
    log.generation(director.project_id, 'cue-selection-complete', {
      sceneId: scene.scene_id,
      musicCues: cues.music ? cues.music.length : 0,
      ambienceCues: cues.ambience ? cues.ambience.length : 0,
    });

    log.generation(director.project_id, 'timeline-start', { sceneId: scene.scene_id });
    const timeline = await buildTimeline(scene, alignment, cues, director.project_id, {
      musicGainOffsetDb: options.audioTuning?.musicGainOffsetDb,
      ambienceGainOffsetDb: options.audioTuning?.ambienceGainOffsetDb,
      sfxGainOffsetDb: options.audioTuning?.sfxGainOffsetDb,
    });
    log.generation(director.project_id, 'timeline-complete', {
      sceneId: scene.scene_id,
      eventCount: timeline.events ? timeline.events.length : 0,
    });

    log.generation(director.project_id, 'mix-start', { sceneId: scene.scene_id });
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    // PR α (2026-06-23): per-scene file is now PCM WAV. Eliminates the
    // double-encode/decode hop where scenes were encoded to AAC here and
    // then immediately decoded back at final concat. AAC is generated
    // exactly once, in finalConcatenation. acrossfade is codec-agnostic
    // on input so finalConcatenation handles WAV inputs natively.
    const sceneOutput = path.join(projectDir, `scene-${safeSceneId}.wav`);

    // Prepare dialogue by concatenating stems
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const dialoguePath = path.join(scenesDir, `dialogue-${safeSceneId}.m4a`);
    await concatenateDialogueStems(stems, dialoguePath);

    const { mixInputs, warnings: sceneWarnings } = resolveCuesToMixInputs({
      cues,
      alignmentLines: alignment.lines,
      dialoguePath,
    });
    if (sceneWarnings.length > 0) {
      log.warn('[Pipeline] missing audio tracks in scene', { sceneId: scene.scene_id, warnings: sceneWarnings });
      mixWarnings.push(...sceneWarnings.map((w) => `Scene ${scene.scene_id}: ${w}`));
    }

    if (mixInputs.music) log.debug('Adding music layer', { sceneId: scene.scene_id });
    if (mixInputs.ambience) log.debug('Adding ambience layer', { sceneId: scene.scene_id });
    if (mixInputs.sfx) log.debug('Adding SFX layers', { sceneId: scene.scene_id, sfxCount: mixInputs.sfx.length });

    // Prepare temp files for mixer
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const tempWav = path.join(scenesDir, `temp-${safeSceneId}.wav`);
    const mixParams = getDefaultMixParams(scene.mix as Record<string, unknown>);

    // Call mixer with correct interface
    await mixScene({
      project_id: director.project_id,
      scene_id: scene.scene_id,
      inputs: mixInputs,
      outWav: tempWav,
      outFinal: sceneOutput,
      mixParams,
    });

    // Cleanup temp WAV
    if (fs.existsSync(tempWav)) {
      fs.unlinkSync(tempWav);
    }

    log.generation(director.project_id, 'mix-complete', {
      sceneId: scene.scene_id,
      outputFile: path.basename(sceneOutput),
    });

    sceneOutputs.push({
      scene_id: scene.scene_id,
      path: sceneOutput,
      timeline,
      alignment,
      cues,
    });

    // T2-2: record the cache entry for next time. Failure here is non-fatal
    // — the current render is already committed to disk and surfaced to the
    // caller, only the cache row is missing.
    await recordSceneRender(
      director.project_id,
      scene.scene_id,
      sceneContentHash,
      sceneOutput,
    );
  }

  log.generation(director.project_id, 'all-scenes-processed', {
    sceneCount: sceneOutputs.length,
  });

  // Sprint K: when chunkIndex is set, write episode-N.m4a to avoid overwriting between chunks
  const episodeName = options.chunkIndex !== undefined ? `episode-${options.chunkIndex}.m4a` : 'episode.m4a';
  log.generation(director.project_id, 'concatenation-start');
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const episodePath = path.join(projectDir, episodeName);
  await concatScenesWithCrossfade(sceneOutputs.map((s) => s.path), episodePath, {
    fadeDuration: 1.5,
    fadeType: 'tri',
  });
  log.generation(director.project_id, 'concatenation-complete', {
    outputFile: episodeName,
  });

  // For chunked generation: skip manifest (stitch step generates the final manifest)
  if (options.chunkIndex !== undefined) {
    return {
      project_id: director.project_id,
      output_dir: projectDir,
      episode_path: episodePath,
      manifest_path: '',
      scenes: sceneOutputs,
      audio_urls: [`/audio/${safeProjectId}/${episodeName}`],
      manifest: null,
      mix_warnings: mixWarnings,
    };
  }

  log.generation(director.project_id, 'manifest-start');
  const manifest = await makePlaybackManifest(
    director.project_id,
    sceneOutputs.map((s) => ({ scene_id: s.scene_id, path: s.path })),
    1.5
  );
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const manifestPath = path.join(projectDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  log.generation(director.project_id, 'manifest-complete');

  log.generation(director.project_id, 'orchestration-complete', {
    outputDir: projectDir,
    episodeFile: 'episode.m4a',
    manifestFile: 'manifest.json',
    totalDurationSec: parseFloat(manifest.total.toFixed(2)),
    totalDurationMin: parseFloat((manifest.total / 60).toFixed(2)),
  });

  return {
    project_id: director.project_id,
    output_dir: projectDir,
    episode_path: episodePath,
    manifest_path: manifestPath,
    scenes: sceneOutputs,
    audio_urls: [manifest.public_url],
    manifest: manifest,
    mix_warnings: mixWarnings,
  };
}

/**
 * Parallel orchestration pipeline - faster processing with concurrent execution
 *
 * This is the optimized pipeline that:
 * 1. Generates ALL TTS in parallel across scenes
 * 2. Assembles scenes progressively as TTS completes
 * 3. Reports granular progress throughout
 *
 * Use this for production - it's significantly faster than the sequential pipeline
 */
export async function orchestrateParallel(
  directorJSON: unknown,
  onProgress?: PipelineProgressCallback,
  emotionOverrides: Record<string, string> = {},
  options: {
    chunkIndex?: number;
    audioTuning?: OrchestrateAudioTuning;
    /** #372: bypass scene_renders cache to force fresh TTS — see `orchestrate`. */
    forceFreshTts?: boolean;
  } = {},
): Promise<OrchestrationResult> {
  // Step 0: Validate
  if (onProgress) {
    onProgress({ step: 'validating', percent: 0, message: 'Validating Director JSON...' });
  }

  log.info('Validating Director JSON (parallel pipeline)');
  const parsed = DirectorJSONSchema.safeParse(directorJSON);
  if (!parsed.success) {
    throw new Error('Invalid Director JSON: ' + JSON.stringify(parsed.error.issues));
  }
  const director = parsed.data;
  assertHttpDirectorJSONInvariants(director);
  const safeProjectId = safeId(director.project_id, 'project_id');

  const totalLines = director.scenes.reduce((sum, s) => sum + s.dialogue.length, 0);
  log.generation(director.project_id, 'validation-complete', {
    sceneCount: director.scenes.length,
    totalDialogueLines: totalLines,
    pipeline: 'parallel',
  });

  // Setup output directories
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const projectDir = path.join(getOutputDir(), safeProjectId);
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const scenesDir = path.join(projectDir, 'scenes');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(scenesDir, { recursive: true });

  // T2-2 (#190 / PR H of #186 follow-up): partition scenes by cache state
  // BEFORE running TTS or assembly. Cached scenes skip the entire pipeline;
  // uncached scenes get the full TTS → stitch treatment.
  // B-003: include audio tuning in the hash — see sequential pipeline.
  const sceneHashes = director.scenes.map((scene, idx) => ({
    scene,
    sceneIndex: idx,
    contentHash: computeSceneRenderHash(scene, options.audioTuning),
  }));

  const cachedResults: Array<{
    scene_id: string;
    scene_index: number;
    path: string;
    timeline: Timeline;
    alignment: SceneAlignment;
    cues: SceneCues;
    duration_ms: number;
    mix_warnings: string[];
  }> = [];
  const freshScenes: typeof sceneHashes = [];

  await Promise.all(
    sceneHashes.map(async (sh) => {
      const cachedPath = await findCachedSceneRender(
        director.project_id,
        sh.scene.scene_id,
        sh.contentHash,
        { forceFreshTts: options.forceFreshTts },
      );
      if (cachedPath) {
        cachedResults.push({
          scene_id: sh.scene.scene_id,
          scene_index: sh.sceneIndex,
          path: cachedPath,
          // Timeline / alignment / cues are not consumed downstream of this
          // function — only `path` feeds concatenation + manifest (which
          // ffprobes duration directly from the file). Empty placeholders
          // preserve the SceneAssemblyResult shape.
          timeline: { events: [] } as unknown as Timeline,
          alignment: { lines: [] } as unknown as SceneAlignment,
          cues: { music: [], ambience: [], sfx: [] } as unknown as SceneCues,
          duration_ms: 0,
          mix_warnings: [],
        });
      } else {
        freshScenes.push(sh);
      }
    }),
  );

  log.info('[scene-cache] parallel pipeline partition', {
    cached: cachedResults.length,
    fresh: freshScenes.length,
    total: sceneHashes.length,
  });

  // Step 1: Parallel TTS Generation — only on uncached scenes.
  log.generation(director.project_id, 'parallel-tts-start', {
    totalLines,
    cachedScenes: cachedResults.length,
  });

  let stitchResult: { scenes: typeof cachedResults; total_duration_ms: number; mix_warnings: string[] };
  // TTS counters used in the final report. Default to zero for full-cache-hit
  // runs (no TTS was invoked).
  let ttsCachedLines = 0;
  let ttsGeneratedLines = 0;

  if (freshScenes.length === 0) {
    // Full cache hit — skip TTS + assembly entirely.
    log.info('[scene-cache] all scenes cached — skipping TTS and assembly');
    stitchResult = {
      scenes: [...cachedResults].sort((a, b) => a.scene_index - b.scene_index),
      total_duration_ms: 0,
      mix_warnings: [],
    };
    if (onProgress) {
      onProgress({ step: 'assembling', percent: 85, message: 'All scenes cached — skipping render' });
    }
  } else {
    // Build a subset director for the cache-miss scenes only. The director's
    // shape is preserved so parallelTTSGenerate / progressiveStitch see a
    // normal-looking DirectorJSON.
    const subsetDirector = { ...director, scenes: freshScenes.map((s) => s.scene) };

    const ttsResult = await parallelTTSGenerate(
      subsetDirector,
      (ttsProgress) => {
        if (onProgress) {
          onProgress({
            step: 'tts',
            percent: Math.round(ttsProgress.percent * 0.6), // TTS is 60% of work
            message: `Generating TTS: ${ttsProgress.completed_lines}/${ttsProgress.total_lines} lines`,
            details: ttsProgress,
          });
        }
      },
      // #378: default dropped from 6→2 to match ElevenLabs grant-tier
      // concurrency cap; tts.ts uses the same env + default.
      parseInt(process.env.TTS_CONCURRENCY || '2', 10),
      emotionOverrides,
      { narrationSpeed: options.audioTuning?.narrationSpeed },
    );

    // Step 2: Progressive Scene Assembly — on the same subset.
    log.generation(director.project_id, 'progressive-assembly-start');

    if (onProgress) {
      onProgress({ step: 'assembling', percent: 60, message: 'Assembling scenes...' });
    }

    const partialStitch = await progressiveStitch(
      subsetDirector,
      ttsResult.stems_by_scene,
      projectDir,
      parseInt(process.env.SCENE_CONCURRENCY ?? '1', 10), // Env-tunable; default 1 to prevent OOM on standard instances
      (stitchProgress) => {
        if (onProgress) {
          const basePercent = 60;
          const assemblyPercent = (stitchProgress.percent / 100) * 25; // Assembly is 25% of work
          onProgress({
            step: 'assembling',
            percent: Math.round(basePercent + assemblyPercent),
            message: `Assembling scene ${stitchProgress.current_scene}...`,
            details: stitchProgress,
          });
        }
      },
      // B-003b — forward per-user mix offsets so each scene's timeline
      // events get the user's locked gain adjustments.
      {
        musicGainOffsetDb: options.audioTuning?.musicGainOffsetDb,
        ambienceGainOffsetDb: options.audioTuning?.ambienceGainOffsetDb,
        sfxGainOffsetDb: options.audioTuning?.sfxGainOffsetDb,
      },
    );

    // Record cache entries for the freshly-rendered scenes so the next run
    // gets a hit. Failure is non-fatal (see scene-cache.ts).
    await Promise.all(
      partialStitch.scenes.map(async (stitchedScene) => {
        const entry = freshScenes.find((f) => f.scene.scene_id === stitchedScene.scene_id);
        if (entry) {
          await recordSceneRender(
            director.project_id,
            stitchedScene.scene_id,
            entry.contentHash,
            stitchedScene.path,
          );
        }
      }),
    );

    // Merge cached + freshly-rendered scenes back into original scene order.
    // Need scene_index on the fresh results — re-attach by finding the
    // original index from the freshScenes list.
    const freshWithIndex = partialStitch.scenes.map((s) => {
      const entry = freshScenes.find((f) => f.scene.scene_id === s.scene_id);
      return { ...s, scene_index: entry?.sceneIndex ?? 0 };
    });

    stitchResult = {
      scenes: [...cachedResults, ...freshWithIndex].sort(
        (a, b) => a.scene_index - b.scene_index,
      ),
      total_duration_ms: partialStitch.total_duration_ms,
      mix_warnings: partialStitch.mix_warnings,
    };

    // Surface TTS counters for the final report.
    ttsCachedLines = ttsResult.cached_lines;
    ttsGeneratedLines = ttsResult.generated_lines;
  }

  // Step 3: Final Concatenation
  log.generation(director.project_id, 'final-concatenation-start');

  if (onProgress) {
    onProgress({ step: 'stitching', percent: 85, message: 'Creating final episode...' });
  }

  // Sprint K: when chunkIndex is set, write episode-N.m4a to avoid overwriting between chunks
  const episodeName = options.chunkIndex !== undefined ? `episode-${options.chunkIndex}.m4a` : 'episode.m4a';
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const episodePath = path.join(projectDir, episodeName);
  await finalConcatenation(stitchResult.scenes, episodePath, 1.5);

  // For chunked generation: skip manifest (stitch step generates the final manifest)
  if (options.chunkIndex !== undefined) {
    const sceneOutputsChunk: SceneOutput[] = stitchResult.scenes.map((s) => ({
      scene_id: s.scene_id,
      path: s.path,
      timeline: s.timeline,
      alignment: s.alignment,
      cues: s.cues,
    }));
    if (onProgress) {
      onProgress({ step: 'complete', percent: 100, message: 'Orchestration complete!' });
    }
    return {
      project_id: director.project_id,
      output_dir: projectDir,
      episode_path: episodePath,
      manifest_path: '',
      scenes: sceneOutputsChunk,
      audio_urls: [`/audio/${safeProjectId}/${episodeName}`],
      manifest: null,
      mix_warnings: stitchResult.mix_warnings,
    };
  }

  // Step 4: Generate Manifest
  log.generation(director.project_id, 'manifest-start');

  if (onProgress) {
    onProgress({ step: 'manifest', percent: 95, message: 'Generating playback manifest...' });
  }

  const manifest = await makePlaybackManifest(
    director.project_id,
    stitchResult.scenes.map((s) => ({ scene_id: s.scene_id, path: s.path })),
    1.5
  );
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const manifestPath = path.join(projectDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Convert scene results to expected format
  const sceneOutputs: SceneOutput[] = stitchResult.scenes.map((s) => ({
    scene_id: s.scene_id,
    path: s.path,
    timeline: s.timeline,
    alignment: s.alignment,
    cues: s.cues,
  }));

  // Final report
  log.generation(director.project_id, 'parallel-orchestration-complete', {
    outputDir: projectDir,
    episodeFile: 'episode.m4a',
    manifestFile: 'manifest.json',
    totalDurationSec: parseFloat(manifest.total.toFixed(2)),
    totalDurationMin: parseFloat((manifest.total / 60).toFixed(2)),
    ttsCachedLines: ttsCachedLines,
    ttsGeneratedLines: ttsGeneratedLines,
    scenesProcessed: stitchResult.scenes.length,
    pipeline: 'parallel',
  });

  if (onProgress) {
    onProgress({ step: 'complete', percent: 100, message: 'Orchestration complete!' });
  }

  return {
    project_id: director.project_id,
    output_dir: projectDir,
    episode_path: episodePath,
    manifest_path: manifestPath,
    scenes: sceneOutputs,
    audio_urls: [manifest.public_url],
    manifest: manifest,
    mix_warnings: stitchResult.mix_warnings,
  };
}
