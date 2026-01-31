/**
 * Preview Pipeline - Generates 15-second audio previews for individual scenes
 *
 * Lightweight version of the full orchestration pipeline:
 * 1. Truncates dialogue to ~15s worth of lines
 * 2. Runs TTS → Align → Cues → Timeline → Mix (single scene)
 * 3. Hard-trims output to 15s with 1s fade-out via FFmpeg
 * 4. Uploads preview to Supabase storage
 */

import { execa } from 'execa';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import type { Scene } from '../schemas/director-json.js';
import { ttsForScene, type StemResult } from './workers/tts.js';
import { alignScene, type SceneAlignment } from './workers/align.js';
import { pickCues, type SceneCues } from './workers/cues.js';
import { buildTimeline } from './workers/timeline.js';
import { mixScene, type MixInputs, type SFXInput } from './workers/mixer.js';
import { loadCatalog, getTrackPath } from '../lib/catalog-loader.js';

const ffmpeg = ffmpegStatic as unknown as string;

if (!ffmpeg) {
  throw new Error('FFmpeg binary not found. Please ensure ffmpeg-static is installed.');
}

// Supabase client for uploading previews
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase: SupabaseClient | null =
  process.env.SUPABASE_URL && supabaseKey
    ? createClient(process.env.SUPABASE_URL, supabaseKey)
    : null;

const PREVIEW_DURATION_SECONDS = 15;
const FADE_OUT_DURATION = 1;
const PREVIEW_BUCKET = 'audio';

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

/**
 * Concatenate dialogue stems into a single file
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
  const concatFilePath = path.join(path.dirname(outputPath), 'preview-concat-list.txt');
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
 * Upload preview to Supabase storage
 */
async function uploadPreview(
  localPath: string,
  storagePath: string
): Promise<string | null> {
  if (!supabase) {
    console.warn('Supabase not configured - preview will not be uploaded');
    return null;
  }

  try {
    const fileBuffer = fs.readFileSync(localPath);
    const { error } = await supabase.storage
      .from(PREVIEW_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: 'audio/mp4',
        upsert: true,
      });

    if (error) {
      console.error('Preview upload error:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from(PREVIEW_BUCKET)
      .getPublicUrl(storagePath);

    return urlData.publicUrl;
  } catch (err) {
    console.error('Preview upload failed:', err);
    return null;
  }
}

/**
 * Generate a 15-second audio preview for a single scene
 */
export async function generatePreview(
  projectId: string,
  scene: Scene,
  accessToken?: string
): Promise<PreviewResult> {
  console.log(`[Preview] Starting preview for project=${projectId} scene=${scene.scene_id}`);

  // Setup output directories
  const projectDir = path.join(process.cwd(), 'output', projectId, 'previews');
  const scenesDir = path.join(projectDir, 'scenes');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(scenesDir, { recursive: true });

  // Step 1: Truncate dialogue to ~15s worth of lines
  const truncatedScene = truncateDialogue(scene, PREVIEW_DURATION_SECONDS);
  console.log(`[Preview] Truncated dialogue: ${truncatedScene.dialogue.length}/${scene.dialogue.length} lines`);

  // Step 2: Load catalog
  const catalog = loadCatalog();

  // Step 3: Generate TTS for truncated dialogue
  console.log('[Preview] Generating TTS...');
  const stems = await ttsForScene(projectId, truncatedScene);
  console.log(`[Preview] TTS complete: ${stems.length} stems`);

  // Step 4: Compute alignment
  console.log('[Preview] Computing alignment...');
  const alignment = await alignScene(projectId, truncatedScene, stems);

  // Step 5: Pick cues
  console.log('[Preview] Selecting audio cues...');
  const cues = await pickCues(truncatedScene, catalog);

  // Step 6: Build timeline
  console.log('[Preview] Building timeline...');
  const timeline = await buildTimeline(truncatedScene, alignment, cues);

  // Step 7: Mix scene
  console.log('[Preview] Mixing scene...');
  const fullMixPath = path.join(projectDir, `scene-${scene.scene_id}-full.m4a`);
  const dialoguePath = path.join(scenesDir, `dialogue-${scene.scene_id}.m4a`);
  const tempWav = path.join(scenesDir, `temp-${scene.scene_id}.wav`);

  await concatenateDialogueStems(stems, dialoguePath);

  const mixInputs: MixInputs = { dialogue: dialoguePath };

  // Add music track if present
  if (cues.music && cues.music.length > 0) {
    const musicCue = cues.music[0];
    if (musicCue.file) {
      const musicPath = getTrackPath(musicCue.file);
      if (musicPath && fs.existsSync(musicPath)) {
        mixInputs.music = musicPath;
      }
    }
  }

  // Add ambience track if present
  if (cues.ambience && cues.ambience.length > 0) {
    const ambienceCue = cues.ambience[0];
    if (ambienceCue.file) {
      const ambiencePath = getTrackPath(ambienceCue.file);
      if (ambiencePath && fs.existsSync(ambiencePath)) {
        mixInputs.ambience = ambiencePath;
      }
    }
  }

  // Add SFX tracks if present
  if (cues.sfx && cues.sfx.length > 0) {
    const sfxCues: SFXInput[] = [];
    for (const sfxCue of cues.sfx) {
      if (sfxCue.file) {
        const sfxPath = getTrackPath(sfxCue.file);
        if (sfxPath && fs.existsSync(sfxPath)) {
          let startAtSeconds = 0;
          if (typeof sfxCue.start_at === 'string' && sfxCue.start_at.startsWith('line_')) {
            const lineId = sfxCue.start_at;
            for (const line of alignment.lines) {
              if (line.line_id === lineId) {
                startAtSeconds = line.start;
                break;
              }
            }
          } else if (typeof sfxCue.start_at === 'number') {
            startAtSeconds = sfxCue.start_at;
          }

          sfxCues.push({
            file: sfxPath,
            at: startAtSeconds,
            duration: sfxCue.duration || null,
          });
        }
      }
    }

    if (sfxCues.length > 0) {
      mixInputs.sfx = sfxCues;
    }
  }

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
  console.log('[Preview] Trimming to 15s with fade-out...');
  const previewPath = path.join(projectDir, `preview-${scene.scene_id}.m4a`);
  await trimWithFadeOut(fullMixPath, previewPath, PREVIEW_DURATION_SECONDS, FADE_OUT_DURATION);

  // Cleanup full mix
  if (fs.existsSync(fullMixPath)) {
    fs.unlinkSync(fullMixPath);
  }

  // Step 9: Upload to Supabase storage
  const storagePath = `previews/${projectId}/${scene.scene_id}.m4a`;
  console.log(`[Preview] Uploading to ${storagePath}...`);
  const previewUrl = await uploadPreview(previewPath, storagePath);

  // Get actual duration of the preview
  let durationSeconds = PREVIEW_DURATION_SECONDS;
  try {
    const { stdout } = await execa(ffmpeg, [
      '-i', previewPath,
      '-f', 'null',
      '-',
    ], { reject: false });
    // Duration is in stderr for FFmpeg
  } catch {
    // Use default duration
  }

  console.log(`[Preview] Preview complete: ${previewUrl || previewPath}`);

  return {
    project_id: projectId,
    scene_id: scene.scene_id,
    preview_url: previewUrl,
    preview_path: storagePath,
    duration_seconds: durationSeconds,
  };
}
