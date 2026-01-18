/**
 * Orchestrator Pipeline - Main audio generation workflow
 *
 * Coordinates the full orchestration process:
 * 1. Validate Director JSON
 * 2. Generate TTS for each scene
 * 3. Compute dialogue alignment
 * 4. Select audio cues
 * 5. Build scene timeline
 * 6. Mix scene audio
 * 7. Concatenate scenes
 * 8. Generate playback manifest
 */

import 'dotenv/config';
import { execa } from 'execa';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';

import { DirectorJSONSchema, type DirectorJSON, type Scene } from '../schemas/director-json.js';
import { ttsForScene, type StemResult } from './workers/tts.js';
import { alignScene, type SceneAlignment, type LineAlignment } from './workers/align.js';
import { pickCues, type SceneCues } from './workers/cues.js';
import { buildTimeline, type Timeline } from './workers/timeline.js';
import { mixScene, type MixInputs, type SFXInput } from './workers/mixer.js';
import { concatScenesWithCrossfade, makePlaybackManifest, type PlaybackManifest } from './workers/export.js';
import { loadCatalog, getTrackPath, type AudioCatalog } from '../lib/catalog-loader.js';

const ffmpeg = ffmpegStatic as unknown as string;

if (!ffmpeg) {
  throw new Error('FFmpeg binary not found. Please ensure ffmpeg-static is installed.');
}

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

/**
 * Concatenate dialogue stems into single file
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
  const concatFilePath = path.join(path.dirname(outputPath), 'concat-list.txt');
  fs.writeFileSync(concatFilePath, concatList);

  try {
    await execa(ffmpeg, [
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatFilePath,
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-ar',
      '48000',
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
 * Main orchestration pipeline
 */
export async function orchestrate(directorJSON: unknown): Promise<OrchestrationResult> {
  console.log('🎬 Step 0: Validating Director JSON...');
  const parsed = DirectorJSONSchema.safeParse(directorJSON);
  if (!parsed.success) {
    throw new Error('Invalid Director JSON: ' + JSON.stringify(parsed.error.issues));
  }
  const director = parsed.data;
  console.log(`   ✅ Valid Director JSON for project: ${director.project_id}`);
  console.log(`   📋 Scenes to process: ${director.scenes.length}\n`);

  console.log('📚 Loading audio catalog...');
  const catalog: AudioCatalog = loadCatalog();
  console.log('');

  const projectDir = path.join(process.cwd(), 'output', director.project_id);
  const scenesDir = path.join(projectDir, 'scenes');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(scenesDir, { recursive: true });

  const sceneOutputs: SceneOutput[] = [];

  for (let i = 0; i < director.scenes.length; i++) {
    const scene = director.scenes[i];
    console.log('─'.repeat(80));
    console.log(`🎬 SCENE ${i + 1}/${director.scenes.length}: ${scene.scene_id}`);
    console.log('─'.repeat(80) + '\n');

    console.log(`🔊 Step 1: Generating TTS for ${scene.dialogue.length} lines...`);
    const stems = await ttsForScene(director.project_id, scene);
    console.log(`   ✅ Generated ${stems.length} dialogue stems\n`);

    console.log('⏱️  Step 2: Computing dialogue alignment...');
    const alignment = await alignScene(director.project_id, scene, stems);
    console.log(`   ✅ Aligned ${alignment.lines.length} lines\n`);

    console.log('🎵 Step 3: Selecting music and ambience cues...');
    const cues = await pickCues(scene, catalog);
    console.log(`   ✅ Music cues: ${cues.music ? cues.music.length : 0}`);
    console.log(`   ✅ Ambience cues: ${cues.ambience ? cues.ambience.length : 0}\n`);

    console.log('📅 Step 4: Building scene timeline...');
    const timeline = await buildTimeline(scene, alignment, cues);
    console.log(`   ✅ Timeline built with ${timeline.events ? timeline.events.length : 0} events\n`);

    console.log('🎵 Step 5: Mixing scene audio with professional film standards...');
    const sceneOutput = path.join(projectDir, `scene-${scene.scene_id}.m4a`);

    // Prepare dialogue by concatenating stems
    const dialoguePath = path.join(scenesDir, `dialogue-${scene.scene_id}.m4a`);
    await concatenateDialogueStems(stems, dialoguePath);

    const mixInputs: MixInputs = { dialogue: dialoguePath };

    // Add music track if present in cues
    if (cues.music && cues.music.length > 0) {
      const musicCue = cues.music[0];
      const trackId = musicCue.file;
      if (trackId) {
        const musicPath = getTrackPath(trackId);
        if (musicPath && fs.existsSync(musicPath)) {
          mixInputs.music = musicPath;
          console.log(`   🎵 Adding music: ${trackId}`);
        } else {
          console.warn(`   ⚠️  Music track not found: ${trackId}`);
        }
      }
    }

    // Add ambience track if present in cues
    if (cues.ambience && cues.ambience.length > 0) {
      const ambienceCue = cues.ambience[0];
      const trackId = ambienceCue.file;
      if (trackId) {
        const ambiencePath = getTrackPath(trackId);
        if (ambiencePath && fs.existsSync(ambiencePath)) {
          mixInputs.ambience = ambiencePath;
          console.log(`   🌊 Adding ambience: ${trackId}`);
        } else {
          console.warn(`   ⚠️  Ambience track not found: ${trackId}`);
        }
      }
    }

    // Add SFX tracks if present in cues
    if (cues.sfx && cues.sfx.length > 0) {
      const sfxCues: SFXInput[] = [];
      const alignmentLines = alignment.lines;

      for (const sfxCue of cues.sfx) {
        const trackId = sfxCue.file;
        if (trackId) {
          const sfxPath = getTrackPath(trackId);
          if (sfxPath && fs.existsSync(sfxPath)) {
            // Resolve the "at" time - could be a line_id or a number
            let startAtSeconds = 0;

            if (typeof sfxCue.start_at === 'string' && sfxCue.start_at.startsWith('line_')) {
              // It's a line reference like "line_004"
              const lineId = sfxCue.start_at;
              for (const line of alignmentLines) {
                if (line.line_id === lineId) {
                  startAtSeconds = line.start;
                  break;
                }
              }
              console.log(`   🔊 SFX "${trackId}" starts at ${lineId} (${startAtSeconds}s)`);
            } else if (typeof sfxCue.start_at === 'number') {
              startAtSeconds = sfxCue.start_at;
            }

            sfxCues.push({
              file: sfxPath,
              at: startAtSeconds,
              duration: sfxCue.duration || null,
            });

            console.log(`   🔊 Adding SFX: ${trackId} @ ${startAtSeconds}s for ${sfxCue.duration || 'full'}s`);
          } else {
            console.warn(`   ⚠️  SFX track not found: ${trackId}`);
          }
        }
      }

      if (sfxCues.length > 0) {
        mixInputs.sfx = sfxCues;
      }
    }

    // Prepare temp files for mixer
    const tempWav = path.join(scenesDir, `temp-${scene.scene_id}.wav`);

    // Extract mix parameters from scene
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

    console.log(`   ✅ Scene mixed: ${path.basename(sceneOutput)}\n`);

    sceneOutputs.push({
      scene_id: scene.scene_id,
      path: sceneOutput,
      timeline,
      alignment,
      cues,
    });
  }

  console.log('─'.repeat(80));
  console.log('✅ ALL SCENES PROCESSED - STARTING FINAL EXPORT');
  console.log('─'.repeat(80) + '\n');

  console.log('🎬 Step 6: Concatenating scenes...');
  const episodePath = path.join(projectDir, 'episode.m4a');
  await concatScenesWithCrossfade(sceneOutputs.map((s) => s.path), episodePath, {
    fadeDuration: 1.5,
    fadeType: 'tri',
  });
  console.log(`   ✅ Episode created: ${path.basename(episodePath)}\n`);

  console.log('📄 Step 7: Generating playback manifest...');
  const manifest = await makePlaybackManifest(
    director.project_id,
    sceneOutputs.map((s) => ({ scene_id: s.scene_id, path: s.path })),
    1.5
  );
  const manifestPath = path.join(projectDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`   ✅ Manifest saved: manifest.json\n`);

  console.log('═'.repeat(80));
  console.log('🎊 ORCHESTRATION COMPLETE!');
  console.log('═'.repeat(80) + '\n');
  console.log(`📁 Output directory: ${projectDir}`);
  console.log(`🎵 Episode file: episode.m4a`);
  console.log(`📄 Manifest: manifest.json`);
  console.log(`⏱️  Total duration: ${manifest.total.toFixed(2)}s (${(manifest.total / 60).toFixed(2)} min)`);
  console.log('═'.repeat(80) + '\n');

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
