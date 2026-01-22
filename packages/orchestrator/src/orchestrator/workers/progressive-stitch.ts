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
import { mixScene, type MixInputs, type SFXInput } from './mixer.js';
import { loadCatalog, getTrackPath, type AudioCatalog } from '../../lib/catalog-loader.js';

const ffmpeg = ffmpegStatic as unknown as string;

export interface SceneAssemblyResult {
  scene_id: string;
  scene_index: number;
  path: string;
  timeline: Timeline;
  alignment: SceneAlignment;
  cues: SceneCues;
  duration_ms: number;
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
}

export interface ProgressCallback {
  (progress: ProgressiveStitchProgress): void;
}

/**
 * Concatenate dialogue stems in order
 */
async function concatenateDialogueStems(stems: StemResult[], outputPath: string): Promise<void> {
  if (!stems || stems.length === 0) {
    throw new Error('No dialogue stems to concatenate');
  }

  if (stems.length === 1) {
    fs.copyFileSync(stems[0].path, outputPath);
    return;
  }

  const concatList = stems.map((s) => `file '${s.path}'`).join('\n');
  const concatFilePath = path.join(path.dirname(outputPath), `concat-${Date.now()}.txt`);
  fs.writeFileSync(concatFilePath, concatList);

  try {
    await execa(ffmpeg, [
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFilePath,
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '48000',
      '-y',
      outputPath,
    ]);
  } finally {
    if (fs.existsSync(concatFilePath)) {
      fs.unlinkSync(concatFilePath);
    }
  }
}

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
  scenesDir: string
): Promise<SceneAssemblyResult> {
  const scene_id = scene.scene_id;

  console.log(`\n🎬 Processing scene ${scene_index + 1}: ${scene_id}`);

  // 1. Compute alignment
  console.log(`   ⏱️  Aligning ${stems.length} stems...`);
  const alignment = await alignScene(project_id, scene, stems);

  // 2. Select audio cues
  console.log(`   🎵 Selecting cues...`);
  const cues = await pickCues(scene, catalog);

  // 3. Build timeline
  console.log(`   📅 Building timeline...`);
  const timeline = await buildTimeline(scene, alignment, cues);

  // 4. Concatenate dialogue stems
  const dialoguePath = path.join(scenesDir, `dialogue-${scene_id}.m4a`);
  await concatenateDialogueStems(stems, dialoguePath);

  // 5. Prepare mix inputs
  const mixInputs: MixInputs = { dialogue: dialoguePath };

  // Add music if present
  if (cues.music && cues.music.length > 0) {
    const musicCue = cues.music[0];
    if (musicCue.file) {
      const musicPath = getTrackPath(musicCue.file);
      if (musicPath && fs.existsSync(musicPath)) {
        mixInputs.music = musicPath;
        console.log(`   🎵 Adding music: ${musicCue.file}`);
      }
    }
  }

  // Add ambience if present
  if (cues.ambience && cues.ambience.length > 0) {
    const ambienceCue = cues.ambience[0];
    if (ambienceCue.file) {
      const ambiencePath = getTrackPath(ambienceCue.file);
      if (ambiencePath && fs.existsSync(ambiencePath)) {
        mixInputs.ambience = ambiencePath;
        console.log(`   🌊 Adding ambience: ${ambienceCue.file}`);
      }
    }
  }

  // Add SFX if present
  if (cues.sfx && cues.sfx.length > 0) {
    const sfxCues: SFXInput[] = [];
    for (const sfxCue of cues.sfx) {
      if (sfxCue.file) {
        const sfxPath = getTrackPath(sfxCue.file);
        if (sfxPath && fs.existsSync(sfxPath)) {
          let startAt = 0;
          if (typeof sfxCue.start_at === 'string' && sfxCue.start_at.startsWith('line_')) {
            const line = alignment.lines.find((l) => l.line_id === sfxCue.start_at);
            if (line) startAt = line.start;
          } else if (typeof sfxCue.start_at === 'number') {
            startAt = sfxCue.start_at;
          }
          sfxCues.push({
            file: sfxPath,
            at: startAt,
            duration: sfxCue.duration || null,
          });
        }
      }
    }
    if (sfxCues.length > 0) {
      mixInputs.sfx = sfxCues;
    }
  }

  // 6. Mix scene
  console.log(`   🎵 Mixing scene audio...`);
  const sceneOutput = path.join(projectDir, `scene-${scene_id}.m4a`);
  const tempWav = path.join(scenesDir, `temp-${scene_id}.wav`);

  const mixParams = {
    music_gain_db: -22,
    ambience_gain_db: -26,
    sfx_gain_db: -12,
    target_lufs: -16,
    true_peak_db: -1.5,
    use_dialogue_processing: true,
    use_advanced_ducking: true,
    ...(scene.mix || {}),
  };

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

  console.log(`   ✅ Scene ${scene_id} complete (${(duration_ms / 1000).toFixed(2)}s)`);

  return {
    scene_id,
    scene_index,
    path: sceneOutput,
    timeline,
    alignment,
    cues,
    duration_ms,
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
  onProgress?: ProgressCallback
): Promise<ProgressiveStitchResult> {
  const project_id = director.project_id;
  const totalScenes = director.scenes.length;

  console.log(`\n🔗 Progressive Stitch: Processing ${totalScenes} scenes`);
  console.log(`   Scene concurrency: ${sceneConcurrency}\n`);

  // Ensure directories exist
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
          console.warn(`   ⚠️  No stems for scene ${scene.scene_id}`);
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
          scenesDir
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

  console.log(`\n✅ Progressive Stitch Complete:`);
  console.log(`   Scenes processed: ${results.length}`);
  console.log(`   Total duration: ${(totalDuration / 1000).toFixed(2)}s\n`);

  return {
    scenes: results,
    total_duration_ms: totalDuration,
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
  console.log(`\n🎬 Final concatenation: ${scenes.length} scenes`);

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

  console.log(`   ✅ Final episode created: ${path.basename(outputPath)}`);
}
