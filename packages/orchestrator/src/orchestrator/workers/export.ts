/**
 * Export Worker - Scene concatenation and manifest generation
 */

import { execa } from 'execa';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';
import { audioDurationSec } from '../../lib/audio.js';
import { createClient } from '@supabase/supabase-js';

const ffmpeg = ffmpegStatic as unknown as string;

if (!ffmpeg) {
  throw new Error('FFmpeg binary not found. Please ensure ffmpeg-static is installed.');
}

export interface CrossfadeOptions {
  fadeDuration?: number;
  fadeType?: string;
}

export interface SceneInput {
  scene_id: string;
  path: string;
  lineTimings?: Array<{
    line_id: string;
    start: number;
    duration: number;
  }>;
}

export interface ManifestSceneEntry {
  scene_id: string;
  offset: number;
  duration: number;
  lines?: Array<{
    line_id: string;
    start: number;
    duration: number;
  }>;
}

export interface PlaybackManifest {
  project_id: string;
  order: ManifestSceneEntry[];
  total: number;
  public_url: string | null;
}

/**
 * Concatenate scene audio files with smooth crossfades
 * Uses FFmpeg acrossfade filter with equal-power curves
 */
export async function concatScenesWithCrossfade(
  scenePaths: string[],
  outPath: string,
  options: CrossfadeOptions = {}
): Promise<void> {
  const { fadeDuration = 1.5, fadeType = 'tri' } = options;

  if (scenePaths.length === 0) {
    throw new Error('No scenes to concatenate');
  }

  // Single scene = no crossfade needed
  if (scenePaths.length === 1) {
    fs.copyFileSync(scenePaths[0], outPath);
    return;
  }

  // Validate all input files exist
  for (const p of scenePaths) {
    if (!fs.existsSync(p)) {
      throw new Error(`Scene file not found: ${p}`);
    }
  }

  // Build FFmpeg input arguments
  const inputArgs: string[] = [];
  for (const scenePath of scenePaths) {
    inputArgs.push('-i', scenePath);
  }

  // Build acrossfade filter chain
  let filterComplex = '';
  let prevLabel = '[0:a]';

  for (let i = 1; i < scenePaths.length; i++) {
    const currentLabel = `[${i}:a]`;
    const outLabel = i === scenePaths.length - 1 ? '[out]' : `[a${i}]`;

    filterComplex += `${prevLabel}${currentLabel}acrossfade=d=${fadeDuration}:c1=${fadeType}:c2=${fadeType}${outLabel}`;

    if (i < scenePaths.length - 1) {
      filterComplex += ';';
    }
    prevLabel = outLabel;
  }

  // Execute FFmpeg
  const args = [
    ...inputArgs,
    '-filter_complex',
    filterComplex,
    '-map',
    '[out]',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-ar',
    '48000',
    outPath,
  ];

  try {
    await execa(ffmpeg, args);
  } catch (err) {
    const error = err as { stderr?: string; message: string };
    console.error('[Concat Error] FFmpeg failed:', error.stderr || error.message);
    throw new Error(`Scene concatenation failed: ${error.message}`);
  }
}

/**
 * Generate playback manifest with accurate offsets accounting for crossfades
 */
export async function makePlaybackManifest(
  project_id: string,
  scenePaths: SceneInput[],
  crossfadeDuration: number = 1.5
): Promise<PlaybackManifest> {
  const order: ManifestSceneEntry[] = [];
  let offset = 0;
  let totalDuration = 0;

  for (let i = 0; i < scenePaths.length; i++) {
    const scene = scenePaths[i];
    const duration = await audioDurationSec(scene.path);

    const sceneEntry: ManifestSceneEntry = {
      scene_id: scene.scene_id,
      offset: offset,
      duration: duration,
    };

    // Include line-level timing if available
    if (scene.lineTimings && scene.lineTimings.length > 0) {
      sceneEntry.lines = scene.lineTimings.map((line) => ({
        line_id: line.line_id,
        start: offset + line.start,
        duration: line.duration,
      }));
      console.log(`   📍 Scene ${scene.scene_id}: ${sceneEntry.lines.length} lines with timing`);
    }

    order.push(sceneEntry);

    // Each crossfade overlaps by fadeDuration, so subtract from next offset
    if (i < scenePaths.length - 1) {
      offset += duration - crossfadeDuration;
      totalDuration += duration - crossfadeDuration;
    } else {
      offset += duration;
      totalDuration += duration;
    }
  }

  // If only one scene, total equals that scene's duration
  if (scenePaths.length === 1) {
    totalDuration = await audioDurationSec(scenePaths[0].path);
  }

  // Upload episode to Supabase Storage
  const episodePath = path.join(process.cwd(), 'output', project_id, 'episode.m4a');
  let publicUrl: string | null = null;

  // Use service role key for uploads (bypasses RLS)
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (fs.existsSync(episodePath) && process.env.SUPABASE_URL && supabaseKey) {
    try {
      const supabase = createClient(process.env.SUPABASE_URL, supabaseKey);

      const episodeBuffer = fs.readFileSync(episodePath);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio')
        .upload(`${project_id}/episode.m4a`, episodeBuffer, {
          contentType: 'audio/mp4',
          upsert: true,
        });

      if (uploadError) {
        console.error('❌ Supabase upload error:', uploadError);
        throw uploadError;
      }

      console.log('✅ Uploaded to Supabase Storage');

      const { data: urlData } = supabase.storage
        .from('audio')
        .getPublicUrl(`${project_id}/episode.m4a`);

      publicUrl = urlData.publicUrl;
      console.log(`🔗 Public audio URL: ${publicUrl}`);
    } catch (err) {
      console.error('❌ Failed to upload to Supabase:', err);
      // Continue without upload - not fatal
    }
  }

  return {
    project_id,
    order,
    total: totalDuration,
    public_url: publicUrl,
  };
}
