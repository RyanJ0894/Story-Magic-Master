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
  manifest: PlaybackManifest;
}

// concatenateDialogueStems extracted to shared/concat-stems.ts
import { concatenateDialogueStems } from './shared/concat-stems.js';

/**
 * Main orchestration pipeline
 */
export async function orchestrate(directorJSON: unknown): Promise<OrchestrationResult> {
  log.info('Validating Director JSON');
  const parsed = DirectorJSONSchema.safeParse(directorJSON);
  if (!parsed.success) {
    throw new Error('Invalid Director JSON: ' + JSON.stringify(parsed.error.issues));
  }
  const director = parsed.data;
  log.generation(director.project_id, 'validation-complete', {
    sceneCount: director.scenes.length,
  });

  log.info('Loading audio catalog');
  const catalog: AudioCatalog = loadCatalog();

  const projectDir = path.join(getOutputDir(), director.project_id);
  const scenesDir = path.join(projectDir, 'scenes');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(scenesDir, { recursive: true });

  const sceneOutputs: SceneOutput[] = [];

  for (let i = 0; i < director.scenes.length; i++) {
    const scene = director.scenes[i];
    log.generation(director.project_id, 'scene-start', {
      sceneIndex: i + 1,
      totalScenes: director.scenes.length,
      sceneId: scene.scene_id,
    });

    log.generation(director.project_id, 'tts-start', {
      sceneId: scene.scene_id,
      dialogueLines: scene.dialogue.length,
    });
    const stems = await ttsForScene(director.project_id, scene);
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
    const timeline = await buildTimeline(scene, alignment, cues);
    log.generation(director.project_id, 'timeline-complete', {
      sceneId: scene.scene_id,
      eventCount: timeline.events ? timeline.events.length : 0,
    });

    log.generation(director.project_id, 'mix-start', { sceneId: scene.scene_id });
    const sceneOutput = path.join(projectDir, `scene-${scene.scene_id}.m4a`);

    // Prepare dialogue by concatenating stems
    const dialoguePath = path.join(scenesDir, `dialogue-${scene.scene_id}.m4a`);
    await concatenateDialogueStems(stems, dialoguePath);

    const mixInputs = resolveCuesToMixInputs({
      cues,
      alignmentLines: alignment.lines,
      dialoguePath,
    });

    if (mixInputs.music) log.debug('Adding music layer', { sceneId: scene.scene_id });
    if (mixInputs.ambience) log.debug('Adding ambience layer', { sceneId: scene.scene_id });
    if (mixInputs.sfx) log.debug('Adding SFX layers', { sceneId: scene.scene_id, sfxCount: mixInputs.sfx.length });

    // Prepare temp files for mixer
    const tempWav = path.join(scenesDir, `temp-${scene.scene_id}.wav`);
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
  }

  log.generation(director.project_id, 'all-scenes-processed', {
    sceneCount: sceneOutputs.length,
  });

  log.generation(director.project_id, 'concatenation-start');
  const episodePath = path.join(projectDir, 'episode.m4a');
  await concatScenesWithCrossfade(sceneOutputs.map((s) => s.path), episodePath, {
    fadeDuration: 1.5,
    fadeType: 'tri',
  });
  log.generation(director.project_id, 'concatenation-complete', {
    outputFile: path.basename(episodePath),
  });

  log.generation(director.project_id, 'manifest-start');
  const manifest = await makePlaybackManifest(
    director.project_id,
    sceneOutputs.map((s) => ({ scene_id: s.scene_id, path: s.path })),
    1.5
  );
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
  const totalLines = director.scenes.reduce((sum, s) => sum + s.dialogue.length, 0);
  log.generation(director.project_id, 'validation-complete', {
    sceneCount: director.scenes.length,
    totalDialogueLines: totalLines,
    pipeline: 'parallel',
  });

  // Setup output directories
  const projectDir = path.join(getOutputDir(), director.project_id);
  const scenesDir = path.join(projectDir, 'scenes');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(scenesDir, { recursive: true });

  // Step 1: Parallel TTS Generation
  log.generation(director.project_id, 'parallel-tts-start', {
    totalLines,
  });

  const ttsResult = await parallelTTSGenerate(
    director,
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
    parseInt(process.env.TTS_CONCURRENCY || '6', 10), // Configurable; reduce for memory-constrained envs
    emotionOverrides
  );

  // Step 2: Progressive Scene Assembly
  log.generation(director.project_id, 'progressive-assembly-start');

  if (onProgress) {
    onProgress({ step: 'assembling', percent: 60, message: 'Assembling scenes...' });
  }

  const stitchResult = await progressiveStitch(
    director,
    ttsResult.stems_by_scene,
    projectDir,
    3, // Scene concurrency
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
    }
  );

  // Step 3: Final Concatenation
  log.generation(director.project_id, 'final-concatenation-start');

  if (onProgress) {
    onProgress({ step: 'stitching', percent: 85, message: 'Creating final episode...' });
  }

  const episodePath = path.join(projectDir, 'episode.m4a');
  await finalConcatenation(stitchResult.scenes, episodePath, 1.5);

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
    ttsCachedLines: ttsResult.cached_lines,
    ttsGeneratedLines: ttsResult.generated_lines,
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
  };
}
