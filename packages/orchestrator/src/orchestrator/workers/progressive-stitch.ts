/**
 * Progressive Stitch Worker - Assemble scenes as their TTS completes
 *
 * This worker enables parallel scene assembly:
 * 1. Monitors TTS completion per scene
 * 2. Starts scene mixing as soon as TTS for that scene is ready
 * 3. Scenes can be mixed in parallel (order-independent)
 * 4. Final concatenation happens when all scenes are ready
 */

import pLimit from 'p-limit';
import fs from 'fs';
import path from 'path';
import { execa } from 'execa';
import ffmpegStatic from 'ffmpeg-static';

import type { DirectorJSON, Scene } from '../../schemas/director-json.js';
import type { SceneStemMap, StemResult } from './parallel-tts.js';
import { alignScene, type SceneAlignment } from './align.js';
import { pickCues, type SceneCues } from './cues.js';
import { buildTimeline, type Timeline } from './timeline.js';
import { mixScene } from './mixer.js';
import { loadCatalog, type AudioCatalog } from '../../lib/catalog-loader.js';
import { resolveCuesToMixInputs, getDefaultMixParams } from '../shared/resolve-cues.js';
import { log } from '../../lib/logger.js';

const ffmpeg = ffmpegStatic as unknown as string;

export interface SceneAssemblyResult {
  scene_id: string;
  scene_index: number;
  path: string;
  timeline: Timeline;
  alignment: SceneAlignment;
  cues: SceneCues;
  duration_ms: number;
  mix_warnings: string[];
}

export interface ProgressiveStitchProgress {
  phase: 'aligning' | 'mixing' | 'stitching';
  scenes_aligned: number;
  scenes_mixed: number;
  total_scenes: number;
  current_scene?: string;
  percent: number;
}

export interface ProgressiveStitchResult {
  scenes: SceneAssemblyResult[];
  total_duration_ms: number;
  mix_warnings: string[];
}

export interface ProgressCallback {
  (progress: ProgressiveStitchProgress): void;
}

// concatenateDialogueStems extracted to shared/concat-stems.ts
import { concatenateDialogueStems } from '../shared/concat-stems.js';

/**
 * Process a single scene (align + cues + timeline + mix)
 */
async function processScene(
  project_id: string,
  scene: Scene,
  scene_index: number,
  stems: StemResult[],
  catalog: AudioCatalog,
  projectDir: string,
  scenesDir: string,
  // B-003b — per-user mix-gain offsets, passed by progressiveStitch
  gainOffsets: { musicGainOffsetDb?: number; ambienceGainOffsetDb?: number; sfxGainOffsetDb?: number } = {},
): Promise<SceneAssemblyResult> {
  const scene_id = scene.scene_id;
  // Strip any path separators from scene_id before using in filenames
  const safeSceneId = path.basename(scene_id);

  log.info('Processing scene', { sceneIndex: scene_index + 1, sceneId: scene_id });

  // 1. Compute alignment
  log.debug('Aligning stems', { sceneId: scene_id, stemCount: stems.length });
  const alignment = await alignScene(project_id, scene, stems);

  // 2. Select audio cues
  log.debug('Selecting cues', { sceneId: scene_id });
  const cues = await pickCues(scene, catalog);

  // 3. Build timeline
  log.debug('Building timeline', { sceneId: scene_id });
  const timeline = await buildTimeline(scene, alignment, cues, project_id, gainOffsets);

  // 4. Concatenate dialogue stems
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const dialoguePath = path.join(scenesDir, `dialogue-${safeSceneId}.m4a`);
  await concatenateDialogueStems(stems, dialoguePath);

  // 5. Prepare mix inputs
  const { mixInputs, warnings: sceneWarnings } = resolveCuesToMixInputs({
    cues,
    alignmentLines: alignment.lines,
    dialoguePath,
  });

  if (sceneWarnings.length > 0) {
    log.warn('[ProgressiveStitch] missing audio tracks in scene', { sceneId: scene_id, warnings: sceneWarnings });
  }

  if (mixInputs.music) log.debug('Adding music to mix', { sceneId: scene_id });
  if (mixInputs.ambience) log.debug('Adding ambience to mix', { sceneId: scene_id });

  // 6. Mix scene
  log.debug('Mixing scene audio', { sceneId: scene_id });
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  // PR α (2026-06-23): see pipeline.ts — per-scene file is now PCM WAV.
  // AAC is generated exactly once in finalConcatenation.
  const sceneOutput = path.join(projectDir, `scene-${safeSceneId}.wav`);
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const tempWav = path.join(scenesDir, `temp-${safeSceneId}.wav`);
  const mixParams = getDefaultMixParams(scene.mix as Record<string, unknown>);

  await mixScene({
    project_id,
    scene_id,
    inputs: mixInputs,
    outWav: tempWav,
    outFinal: sceneOutput,
    mixParams,
  });

  // Cleanup temp file
  if (fs.existsSync(tempWav)) {
    fs.unlinkSync(tempWav);
  }

  // Calculate duration from alignment (end of last line)
  const duration_ms = alignment.lines.length > 0
    ? Math.round(alignment.lines[alignment.lines.length - 1].end * 1000)
    : 0;

  log.info('Scene processing complete', {
    sceneId: scene_id,
    durationSec: (duration_ms / 1000).toFixed(2),
  });

  return {
    scene_id,
    scene_index,
    path: sceneOutput,
    timeline,
    alignment,
    cues,
    duration_ms,
    mix_warnings: sceneWarnings.map((w) => `Scene ${scene_id}: ${w}`),
  };
}

/**
 * Progressive stitch - process scenes in parallel as TTS completes
 *
 * @param director - Full director JSON
 * @param stemsByScene - TTS stems organized by scene
 * @param projectDir - Output directory for the project
 * @param sceneConcurrency - Max scenes to process in parallel (default: 3)
 * @param onProgress - Optional progress callback
 */
export async function progressiveStitch(
  director: DirectorJSON,
  stemsByScene: SceneStemMap,
  projectDir: string,
  sceneConcurrency: number = 3,
  onProgress?: ProgressCallback,
  // B-003b — per-user mix-gain offsets forwarded to processScene → buildTimeline
  gainOffsets: { musicGainOffsetDb?: number; ambienceGainOffsetDb?: number; sfxGainOffsetDb?: number } = {},
): Promise<ProgressiveStitchResult> {
  const project_id = director.project_id;
  const totalScenes = director.scenes.length;

  log.info('Progressive Stitch: starting scene processing', {
    totalScenes,
    sceneConcurrency,
  });

  // Ensure directories exist
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const scenesDir = path.join(projectDir, 'scenes');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(scenesDir, { recursive: true });

  // Load audio catalog once
  const catalog = loadCatalog();

  // Track progress
  let scenesAligned = 0;
  let scenesMixed = 0;

  // Create scene processing limit
  const limit = pLimit(sceneConcurrency);

  // Process all scenes in parallel (up to concurrency limit)
  const results = await Promise.all(
    director.scenes.map((scene, index) =>
      limit(async () => {
        const stems = stemsByScene[scene.scene_id] || [];

        if (stems.length === 0) {
          log.warn('No stems available for scene', { sceneId: scene.scene_id });
          throw new Error(`No TTS stems available for scene ${scene.scene_id}`);
        }

        // Report starting alignment
        if (onProgress) {
          onProgress({
            phase: 'aligning',
            scenes_aligned: scenesAligned,
            scenes_mixed: scenesMixed,
            total_scenes: totalScenes,
            current_scene: scene.scene_id,
            percent: Math.round(((scenesAligned + scenesMixed) / (totalScenes * 2)) * 100),
          });
        }

        const result = await processScene(
          project_id,
          scene,
          index,
          stems,
          catalog,
          projectDir,
          scenesDir,
          gainOffsets
        );

        scenesAligned++;
        scenesMixed++;

        // Report completion
        if (onProgress) {
          onProgress({
            phase: 'mixing',
            scenes_aligned: scenesAligned,
            scenes_mixed: scenesMixed,
            total_scenes: totalScenes,
            current_scene: scene.scene_id,
            percent: Math.round(((scenesAligned + scenesMixed) / (totalScenes * 2)) * 100),
          });
        }

        return result;
      })
    )
  );

  // Sort results by scene index to ensure correct order
  results.sort((a, b) => a.scene_index - b.scene_index);

  // Calculate total duration
  const totalDuration = results.reduce((sum, r) => sum + r.duration_ms, 0);

  log.info('Progressive Stitch complete', {
    scenesProcessed: results.length,
    totalDurationSec: (totalDuration / 1000).toFixed(2),
  });

  return {
    scenes: results,
    total_duration_ms: totalDuration,
    mix_warnings: results.flatMap((r) => r.mix_warnings),
  };
}

/**
 * Final concatenation of all scenes with crossfades
 */
export async function finalConcatenation(
  scenes: SceneAssemblyResult[],
  outputPath: string,
  crossfadeDuration: number = 1.5
): Promise<void> {
  log.info('Starting final concatenation', { sceneCount: scenes.length });

  if (scenes.length === 0) {
    throw new Error('No scenes to concatenate');
  }

  if (scenes.length === 1) {
    fs.copyFileSync(scenes[0].path, outputPath);
    return;
  }

  // Build FFmpeg input arguments
  const inputArgs: string[] = [];
  for (const scene of scenes) {
    if (!fs.existsSync(scene.path)) {
      throw new Error(`Scene file not found: ${scene.path}`);
    }
    inputArgs.push('-i', scene.path);
  }

  // Build acrossfade filter chain
  let filterComplex = '';
  let prevLabel = '[0:a]';

  for (let i = 1; i < scenes.length; i++) {
    const currentLabel = `[${i}:a]`;
    const outLabel = i === scenes.length - 1 ? '[out]' : `[a${i}]`;

    filterComplex += `${prevLabel}${currentLabel}acrossfade=d=${crossfadeDuration}:c1=tri:c2=tri${outLabel}`;

    if (i < scenes.length - 1) {
      filterComplex += ';';
    }
    prevLabel = outLabel;
  }

  // Execute FFmpeg
  await execa(ffmpeg, [
    ...inputArgs,
    '-filter_complex', filterComplex,
    '-map', '[out]',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ar', '48000',
    '-y',
    outputPath,
  ]);

  log.info('Final episode created', { filename: path.basename(outputPath) });
}
