/**
 * Preview Pipeline - Generates 15-second audio previews for individual scenes
 *
 * Lightweight version of the full orchestration pipeline:
 * 1. Truncates dialogue to ~15s worth of lines
 * 2. Runs TTS -> Align -> Cues -> Timeline -> Mix (single scene)
 * 3. Hard-trims output to 15s with 1s fade-out via FFmpeg
 * 4. Serves preview from local Render Disk
 */

import { execa } from 'execa';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';
import type { Scene } from '../schemas/director-json.js';
import { ttsForScene, type StemResult } from './workers/tts.js';
import { alignScene, type SceneAlignment } from './workers/align.js';
import { pickCues, type SceneCues } from './workers/cues.js';
import { buildTimeline } from './workers/timeline.js';
import { mixScene } from './workers/mixer.js';
import { loadCatalog } from '../lib/catalog-loader.js';
import { getOutputDir } from '../lib/env.js';
import { resolveCuesToMixInputs, getDefaultMixParams } from './shared/resolve-cues.js';
import { log } from '../lib/logger.js';

const ffmpeg = ffmpegStatic as unknown as string;

if (!ffmpeg) {
  throw new Error('FFmpeg binary not found. Please ensure ffmpeg-static is installed.');
}

const PREVIEW_DURATION_SECONDS = 15;
const FADE_OUT_DURATION = 1;

export interface PreviewResult {
  project_id: string;
  scene_id: string;
  preview_url: string | null;
  preview_path: string;
  duration_seconds: number;
}

/**
 * Estimate speech duration for a line of text.
 * Rough heuristic: ~15 characters per second of speech.
 */
function estimateLineDuration(text: string): number {
  return Math.max(2, text.length / 15);
}

/**
 * Truncate scene dialogue to approximately the target duration.
 * Returns a shallow copy of the scene with a shortened dialogue array.
 */
function truncateDialogue(scene: Scene, targetSeconds: number): Scene {
  const buffer = targetSeconds + 3; // Add buffer above target for safety
  let accumulated = 0;
  const truncatedDialogue = [];

  for (const line of scene.dialogue) {
    const lineDuration = estimateLineDuration(line.text);
    accumulated += lineDuration;
    truncatedDialogue.push(line);

    if (accumulated >= buffer) {
      break;
    }
  }

  return {
    ...scene,
    dialogue: truncatedDialogue,
  };
}

// concatenateDialogueStems extracted to shared/concat-stems.ts
import { concatenateDialogueStems } from './shared/concat-stems.js';

/**
 * Hard-trim audio to target duration with fade-out
 */
async function trimWithFadeOut(
  inputPath: string,
  outputPath: string,
  durationSec: number,
  fadeOutSec: number
): Promise<void> {
  const fadeStart = durationSec - fadeOutSec;

  await execa(ffmpeg, [
    '-i', inputPath,
    '-t', String(durationSec),
    '-af', `afade=t=out:st=${fadeStart}:d=${fadeOutSec}`,
    '-c:a', 'aac',
    '-b:a', '192k',
    '-y',
    outputPath,
  ]);
}

/**
 * Generate a 15-second audio preview for a single scene
 */
export async function generatePreview(
  projectId: string,
  scene: Scene,
  accessToken?: string
): Promise<PreviewResult> {
  log.info('Starting preview generation', { projectId, sceneId: scene.scene_id });

  if (!scene.dialogue || scene.dialogue.length === 0) {
    throw new Error(`Scene ${scene.scene_id} has no dialogue lines to preview`);
  }

  // Strip any path separators from user-supplied IDs before using in filenames
  const safeProjectId = path.basename(projectId);
  const safeSceneId = path.basename(scene.scene_id);

  // Setup output directories
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const projectDir = path.join(getOutputDir(), safeProjectId, 'previews');
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const scenesDir = path.join(projectDir, 'scenes');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(scenesDir, { recursive: true });

  // Step 1: Truncate dialogue to ~15s worth of lines
  const truncatedScene = truncateDialogue(scene, PREVIEW_DURATION_SECONDS);
  log.debug('Truncated dialogue for preview', {
    truncatedLines: truncatedScene.dialogue.length,
    totalLines: scene.dialogue.length,
  });

  // Step 2: Load catalog
  const catalog = loadCatalog();

  // Step 3: Generate TTS for truncated dialogue
  log.info('Preview: generating TTS', { projectId, sceneId: scene.scene_id });
  const stems = await ttsForScene(projectId, truncatedScene);
  log.debug('Preview: TTS complete', { stemCount: stems.length });

  // Step 4: Compute alignment
  log.debug('Preview: computing alignment');
  const alignment = await alignScene(projectId, truncatedScene, stems);

  // Step 5: Pick cues
  log.debug('Preview: selecting audio cues');
  const cues = await pickCues(truncatedScene, catalog);

  // Step 6: Build timeline
  log.debug('Preview: building timeline');
  const timeline = await buildTimeline(truncatedScene, alignment, cues, projectId);

  // Step 7: Mix scene
  log.debug('Preview: mixing scene');
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const fullMixPath = path.join(projectDir, `scene-${safeSceneId}-full.m4a`);
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const dialoguePath = path.join(scenesDir, `dialogue-${safeSceneId}.m4a`);
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const tempWav = path.join(scenesDir, `temp-${safeSceneId}.wav`);

  await concatenateDialogueStems(stems, dialoguePath);

  const { mixInputs, warnings: previewWarnings } = resolveCuesToMixInputs({
    cues,
    alignmentLines: alignment.lines,
    dialoguePath,
  });
  if (previewWarnings.length > 0) {
    log.warn('Preview: audio tracks missing from mix', { sceneId: scene.scene_id, warnings: previewWarnings });
  }

  const mixParams = getDefaultMixParams(scene.mix as Record<string, unknown>);

  await mixScene({
    project_id: projectId,
    scene_id: scene.scene_id,
    inputs: mixInputs,
    outWav: tempWav,
    outFinal: fullMixPath,
    mixParams,
  });

  // Cleanup temp WAV
  if (fs.existsSync(tempWav)) {
    fs.unlinkSync(tempWav);
  }

  // Step 8: Trim to 15s with fade-out
  log.debug('Preview: trimming to 15s with fade-out');
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const previewPath = path.join(projectDir, `preview-${safeSceneId}.m4a`);
  await trimWithFadeOut(fullMixPath, previewPath, PREVIEW_DURATION_SECONDS, FADE_OUT_DURATION);

  // Cleanup full mix
  if (fs.existsSync(fullMixPath)) {
    fs.unlinkSync(fullMixPath);
  }

  // Step 9: Serve preview from local Render Disk
  const storagePath = `previews/${projectId}/${scene.scene_id}.m4a`;
  const previewUrl = `/audio/${storagePath}`;
  log.info('Preview available at local path', { storagePath, previewUrl });

  log.info('Preview generation complete', {
    projectId,
    sceneId: scene.scene_id,
    previewUrl,
  });

  return {
    project_id: projectId,
    scene_id: scene.scene_id,
    preview_url: previewUrl,
    preview_path: storagePath,
    duration_seconds: PREVIEW_DURATION_SECONDS,
  };
}
