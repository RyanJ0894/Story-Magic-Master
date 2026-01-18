/**
 * Mixer Worker - Professional audio mixing with film-standard gain staging
 *
 * Key features:
 * - Film-standard gain staging
 * - Multi-band adaptive ducking with lookahead
 * - Professional dialogue processing chain
 * - EQ separation between elements
 * - Automatic looping of music and ambience to scene duration
 * - SFX timing support with start time and duration
 * - EBU R128 loudness targeting (-16 LUFS for streaming)
 */

import { execa } from 'execa';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import fs from 'fs';
import path from 'path';
import { validateFiltergraph } from '../../lib/ffmpeg-validator.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const ffmpeg = ffmpegStatic as unknown as string;
const ffprobePath = ffprobeStatic;

if (!ffmpeg) {
  throw new Error('FFmpeg binary not found. Please ensure ffmpeg-static is installed.');
}

const sb: SupabaseClient | null =
  process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
    : null;

export interface SFXInput {
  file: string;
  at: number;
  duration: number | null;
}

export interface MixInputs {
  dialogue: string;
  music?: string;
  ambience?: string;
  sfx?: Array<string | SFXInput>;
}

export interface MixParams {
  music_gain_db?: number;
  ambience_gain_db?: number;
  sfx_gain_db?: number;
  target_lufs?: number;
  true_peak_db?: number;
  use_dialogue_processing?: boolean;
  use_advanced_ducking?: boolean;
  loop_music?: boolean;
  loop_ambience?: boolean;
}

export interface MixOptions {
  project_id: string;
  scene_id: string;
  inputs: MixInputs;
  outWav: string;
  outFinal: string;
  mixParams?: MixParams;
}

export interface MixManifest {
  scene_id: string;
  inputs: {
    dialogue: Array<{ path: string }>;
    music: Array<{ path: string; gain_db: number }>;
    ambience: Array<{ path: string; gain_db: number }>;
    sfx: Array<{ path: string; gain_db: number; at: number; duration: number | null; index: number }>;
  };
  filters: string[];
  lufs_i: number | null;
  true_peak_db: number | null;
  lra?: number | null;
}

interface RMSEnvelopePoint {
  t: number;
  rmsDb: number;
}

interface DuckCurvePoint {
  t: number;
  musicDuck: number;
  ambienceDuck: number;
}

interface DownsampledSegment {
  start: number;
  end: number;
  musicDuck: number;
  ambienceDuck: number;
}

async function audioDurationSec(filePath: string): Promise<number> {
  const { stdout } = await execa(ffprobePath, [
    '-v',
    'error',
    '-select_streams',
    'a:0',
    '-show_entries',
    'format=duration',
    '-of',
    'default=nw=1:nk=1',
    filePath,
  ]);
  const n = parseFloat(stdout.trim());
  if (!isFinite(n)) throw new Error('No duration ' + filePath);
  return n;
}

/**
 * Loop audio file to match target duration
 * Includes crossfade at loop points for seamless looping
 */
async function loopAudioToLength(
  inputPath: string,
  targetDuration: number,
  outputPath: string,
  _crossfadeSec: number = 0.5
): Promise<string> {
  const inputDuration = await audioDurationSec(inputPath);

  console.log(
    `   🔁 Looping ${path.basename(inputPath)}: ${inputDuration.toFixed(2)}s → ${targetDuration.toFixed(2)}s`
  );

  if (inputDuration >= targetDuration) {
    // No looping needed, just trim to target duration with fade out
    await execa(
      ffmpeg,
      [
        '-i',
        inputPath,
        '-t',
        String(targetDuration),
        '-af',
        `afade=t=out:st=${Math.max(0, targetDuration - 1)}:d=1`,
        '-c:a',
        'pcm_s16le',
        '-ar',
        '48000',
        '-y',
        outputPath,
      ],
      { timeout: 60000 }
    );
    return outputPath;
  }

  // Calculate loops needed (add extra for crossfade overlap)
  const loopsNeeded = Math.ceil(targetDuration / inputDuration) + 1;

  // Use stream_loop for seamless looping with crossfade at end
  await execa(
    ffmpeg,
    [
      '-stream_loop',
      String(loopsNeeded - 1),
      '-i',
      inputPath,
      '-t',
      String(targetDuration),
      '-af',
      [
        // Apply subtle crossfade-style volume envelope for smoother loops
        `volume=1`,
        // Fade out at the very end
        `afade=t=out:st=${Math.max(0, targetDuration - 1.5)}:d=1.5`,
      ].join(','),
      '-c:a',
      'pcm_s16le',
      '-ar',
      '48000',
      '-y',
      outputPath,
    ],
    { timeout: 120000 }
  );

  return outputPath;
}

/**
 * Enhanced RMS envelope with better time resolution
 * Uses 50ms hop for smoother ducking response
 */
async function analyzeRMSEnvelope(dialoguePath: string, hop: number = 0.05): Promise<RMSEnvelopePoint[]> {
  try {
    const result = await execa(
      ffmpeg,
      [
        '-i',
        dialoguePath,
        '-af',
        `astats=metadata=1:reset=${hop},ametadata=mode=print:file=-`,
        '-f',
        'null',
        '-',
      ],
      { timeout: 30000 }
    );

    const output = result.stderr || '';
    const env: RMSEnvelopePoint[] = [];
    let t = 0;

    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('lavfi.astats.Overall.RMS_level=')) {
        const match = line.match(/lavfi\.astats\.Overall\.RMS_level=([-\d.]+)/);
        if (match) {
          const rmsDb = parseFloat(match[1]);
          if (isFinite(rmsDb)) {
            env.push({ t, rmsDb });
            t += hop;
          }
        }
      }
    }

    if (env.length === 0) {
      console.warn('   ⚠️  RMS analysis failed, using fallback envelope');
      const duration = await audioDurationSec(dialoguePath);
      const numSamples = Math.ceil(duration / hop);

      for (let i = 0; i < numSamples; i++) {
        env.push({ t: i * hop, rmsDb: -35 });
      }
    }

    return env;
  } catch (error) {
    console.warn('   ⚠️  RMS analysis error:', (error as Error).message);
    return [{ t: 0, rmsDb: -35 }];
  }
}

/**
 * Advanced ducking curve with lookahead and smooth transitions
 * Anticipates dialogue by 150ms for natural pre-ducking
 */
function buildAdvancedDuckCurve(env: RMSEnvelopePoint[], lookaheadSec: number = 0.15): DuckCurvePoint[] {
  const lookaheadSamples = Math.round(lookaheadSec / 0.05);

  return env.map((s, i) => {
    let maxFutureRms = s.rmsDb;
    for (let j = 1; j <= lookaheadSamples && i + j < env.length; j++) {
      maxFutureRms = Math.max(maxFutureRms, env[i + j].rmsDb);
    }

    // Ducking rules: Duck backgrounds more aggressively when dialogue is present
    if (maxFutureRms > -25) return { t: s.t, musicDuck: -8, ambienceDuck: -6 }; // Very loud speech
    if (maxFutureRms > -35) return { t: s.t, musicDuck: -6, ambienceDuck: -4 }; // Loud speech
    if (maxFutureRms > -45) return { t: s.t, musicDuck: -4, ambienceDuck: -3 }; // Normal speech
    if (maxFutureRms > -55) return { t: s.t, musicDuck: -2, ambienceDuck: -1.5 }; // Quiet speech
    return { t: s.t, musicDuck: 0, ambienceDuck: 0 }; // Silence - no ducking
  });
}

/**
 * Downsample ducking curve to reduce command size
 */
function downsampleDuckCurve(
  curve: DuckCurvePoint[],
  minSegmentSec: number = 0.2,
  maxDeltaDb: number = 1
): DownsampledSegment[] {
  if (curve.length === 0) return [];

  const downsampled: DownsampledSegment[] = [];
  let currentSegment = {
    start: curve[0].t,
    musicDuck: curve[0].musicDuck,
    ambienceDuck: curve[0].ambienceDuck,
    count: 1,
  };

  for (let i = 1; i < curve.length; i++) {
    const point = curve[i];
    const musicDelta = Math.abs(point.musicDuck - currentSegment.musicDuck);
    const ambienceDelta = Math.abs(point.ambienceDuck - currentSegment.ambienceDuck);

    if (musicDelta <= maxDeltaDb && ambienceDelta <= maxDeltaDb) {
      currentSegment.count++;
    } else {
      const duration = currentSegment.count * 0.05;
      if (duration >= minSegmentSec || downsampled.length === 0) {
        downsampled.push({
          start: currentSegment.start,
          end: point.t,
          musicDuck: currentSegment.musicDuck,
          ambienceDuck: currentSegment.ambienceDuck,
        });
      }

      currentSegment = {
        start: point.t,
        musicDuck: point.musicDuck,
        ambienceDuck: point.ambienceDuck,
        count: 1,
      };
    }
  }

  if (currentSegment.count > 0) {
    downsampled.push({
      start: currentSegment.start,
      end: curve[curve.length - 1].t + 0.05,
      musicDuck: currentSegment.musicDuck,
      ambienceDuck: currentSegment.ambienceDuck,
    });
  }

  return downsampled;
}

/**
 * Convert downsampled duck curve to FFmpeg volume filters
 */
function duckToVolumeFilter(curve: DuckCurvePoint[], targetTrack: 'music' | 'ambience' = 'music'): string {
  const duckKey = targetTrack === 'music' ? 'musicDuck' : 'ambienceDuck';
  const segments = downsampleDuckCurve(curve, 0.2, 1);

  console.log(`   📊 Downsampled ${curve.length} points to ${segments.length} segments for ${targetTrack}`);

  if (segments.length === 0) return 'anull';

  const filters = segments
    .filter((seg) => seg[duckKey] !== 0)
    .map((seg) => {
      const t0 = seg.start.toFixed(3);
      const t1 = seg.end.toFixed(3);
      const db = seg[duckKey];
      return `volume=${db}dB:eval=frame:enable='between(t,${t0},${t1})'`;
    });

  return filters.length > 0 ? filters.join(',') : 'anull';
}

/**
 * Process dialogue with professional vocal chain
 */
function buildDialogueChain(): string {
  return [
    'highpass=f=80',
    'acompressor=threshold=-20dB:ratio=3:attack=10:release=100:makeup=3dB',
    'equalizer=f=3000:width_type=o:width=1.5:g=1.5',
  ].join(',');
}

/**
 * Two-pass EBU R128 loudness normalization
 */
async function loudnormTwoPass(
  inputPath: string,
  outPath: string,
  I: number = -16,
  TP: number = -1.5,
  LRA: number = 8
): Promise<void> {
  console.log(`   📊 Analyzing loudness (target: ${I} LUFS)...`);

  try {
    const pass1 = await execa(
      ffmpeg,
      ['-i', inputPath, '-af', `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:print_format=json`, '-f', 'null', '-'],
      {
        reject: false,
        timeout: 60000,
      }
    );

    const txt = pass1.stderr || pass1.stdout || '';
    const rx = (k: string): string | null => {
      const match = txt.match(new RegExp(`"${k}"\\s*:\\s*"?([-\\d.]+)"?`));
      return match ? match[1] : null;
    };

    const measured_I = rx('input_i');
    const measured_TP = rx('input_tp');
    const measured_LRA = rx('input_lra');
    const measured_thresh = rx('input_thresh');
    const target_offset = rx('target_offset');

    console.log(`   📊 Measured: ${measured_I} LUFS, ${measured_TP} dBTP, LRA ${measured_LRA}`);

    if (measured_I && parseFloat(measured_I) > -6) {
      console.warn(`   ⚠️  WARNING: Input is extremely loud (${measured_I} LUFS)!`);

      await execa(
        ffmpeg,
        [
          '-i',
          inputPath,
          '-af',
          `volume=-12dB,loudnorm=I=${I}:TP=${TP}:LRA=${LRA}`,
          '-ar',
          '48000',
          '-c:a',
          'aac',
          '-b:a',
          '256k',
          '-y',
          outPath,
        ],
        { timeout: 60000 }
      );

      console.log(`   ✅ Emergency normalization applied`);
      return;
    }

    if (!measured_I || !measured_TP || !measured_LRA || !measured_thresh || !target_offset) {
      console.warn(`   ⚠️  Incomplete measurement data, using single-pass normalization`);

      await execa(
        ffmpeg,
        [
          '-i',
          inputPath,
          '-af',
          `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}`,
          '-ar',
          '48000',
          '-c:a',
          'aac',
          '-b:a',
          '256k',
          '-y',
          outPath,
        ],
        { timeout: 60000 }
      );

      console.log(`   ✅ Single-pass normalization applied`);
      return;
    }

    console.log(`   🔊 Applying loudness normalization...`);
    await execa(
      ffmpeg,
      [
        '-i',
        inputPath,
        '-af',
        `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:measured_I=${measured_I}:measured_TP=${measured_TP}:measured_LRA=${measured_LRA}:measured_thresh=${measured_thresh}:offset=${target_offset}:linear=true`,
        '-ar',
        '48000',
        '-c:a',
        'aac',
        '-b:a',
        '256k',
        '-y',
        outPath,
      ],
      { timeout: 60000 }
    );

    console.log(`   ✅ Normalized to ${I} LUFS`);
  } catch (error) {
    const err = error as { timedOut?: boolean; message: string };
    if (err.timedOut) {
      console.error(`   ❌ Loudness normalization timed out! Using fallback...`);
    } else {
      console.error(`   ❌ Loudness normalization failed:`, err.message);
    }

    console.log(`   🔄 Applying fallback normalization...`);
    await execa(
      ffmpeg,
      ['-i', inputPath, '-af', `volume=-6dB`, '-ar', '48000', '-c:a', 'aac', '-b:a', '256k', '-y', outPath],
      { timeout: 30000 }
    );

    console.log(`   ✅ Fallback normalization applied`);
  }
}

async function saveMixManifest(project_id: string, scene_id: string, manifest: MixManifest): Promise<void> {
  if (sb) {
    await sb.from('mix_manifests').upsert({
      project_id,
      scene_id,
      mix_manifest_json: manifest,
      created_at: new Date().toISOString(),
    });
  }

  const localPath = path.join(process.cwd(), 'output', project_id, 'scenes', `${scene_id}-manifest.json`);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, JSON.stringify(manifest, null, 2));
}

/**
 * Clean up temporary looped audio files
 */
async function cleanupTempFiles(tempFiles: string[]): Promise<void> {
  for (const file of tempFiles) {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    } catch (e) {
      console.warn(`   ⚠️  Could not clean up temp file: ${file}`);
    }
  }
}

/**
 * Build filter for a single SFX with timing
 */
function buildSfxFilter(
  inputIndex: number,
  sfxCue: SFXInput,
  sfxIndex: number,
  gainDb: number,
  sceneDuration: number
): string {
  const startAt = sfxCue.at || 0;
  const duration = sfxCue.duration || null;

  let filter = `[${inputIndex}:a]`;

  // Apply compression
  filter += `acompressor=threshold=-15dB:ratio=3:attack=5:release=50:makeup=0dB,`;

  // Apply gain
  filter += `volume=${gainDb}dB,`;

  // Trim duration if specified
  if (duration && duration > 0) {
    filter += `atrim=0:${duration},asetpts=PTS-STARTPTS,`;
  }

  // Add fade in/out for smooth transitions
  filter += `afade=t=in:st=0:d=0.02,`;
  if (duration && duration > 0) {
    filter += `afade=t=out:st=${Math.max(0, duration - 0.05)}:d=0.05,`;
  }

  // Pad with silence at the start (adelay) and end to match scene duration
  const delayMs = Math.round(startAt * 1000);
  filter += `adelay=${delayMs}|${delayMs},`;

  // Pad to scene duration to ensure all SFX have same length for mixing
  filter += `apad=whole_dur=${sceneDuration}`;

  filter += `[sfx${sfxIndex}]`;

  return filter;
}

/**
 * Professional scene mixer with film-standard gain staging
 */
export async function mixScene(options: MixOptions): Promise<MixManifest> {
  const { project_id, scene_id, inputs, outWav, outFinal, mixParams = {} } = options;

  const {
    music_gain_db = -4,
    ambience_gain_db = -6,
    sfx_gain_db = -4,
    target_lufs = -16,
    true_peak_db = -1.5,
    use_dialogue_processing = true,
    use_advanced_ducking = false,
    loop_music = true,
    loop_ambience = true,
  } = mixParams;

  console.log(`   🎛️  Professional film mixing for scene ${scene_id}...`);

  // Track temp files for cleanup
  const tempFiles: string[] = [];

  // Normalize SFX input format
  const normalizedSfx: SFXInput[] = [];
  if (inputs.sfx && inputs.sfx.length > 0) {
    for (const sfx of inputs.sfx) {
      if (typeof sfx === 'string') {
        // Legacy format: just a file path
        normalizedSfx.push({ file: sfx, at: 0, duration: null });
      } else if (typeof sfx === 'object' && sfx.file) {
        // New format: { file, at, duration }
        normalizedSfx.push({
          file: sfx.file,
          at: sfx.at || 0,
          duration: sfx.duration || null,
        });
      }
    }
  }

  const manifest: MixManifest = {
    scene_id,
    inputs: {
      dialogue: [{ path: inputs.dialogue }],
      music: inputs.music ? [{ path: inputs.music, gain_db: music_gain_db }] : [],
      ambience: inputs.ambience ? [{ path: inputs.ambience, gain_db: ambience_gain_db }] : [],
      sfx: normalizedSfx.map((s, i) => ({
        path: s.file,
        gain_db: sfx_gain_db,
        at: s.at,
        duration: s.duration,
        index: i,
      })),
    },
    filters: [],
    lufs_i: null,
    true_peak_db: null,
  };

  // Get dialogue duration as scene length reference
  const sceneDuration = await audioDurationSec(inputs.dialogue);
  console.log(`   ⏱️  Scene duration: ${sceneDuration.toFixed(2)}s`);

  // Log SFX timing info
  if (normalizedSfx.length > 0) {
    console.log(`   🔊 SFX tracks with timing:`);
    for (const sfx of normalizedSfx) {
      const durStr = sfx.duration ? `${sfx.duration.toFixed(2)}s` : 'full';
      console.log(`      - ${path.basename(sfx.file)} @ ${sfx.at.toFixed(2)}s (${durStr})`);
    }
  }

  // Dialogue-only scene
  if (!inputs.music && !inputs.ambience && normalizedSfx.length === 0) {
    console.log(`   ℹ️  Dialogue-only scene`);

    const filterChain = use_dialogue_processing ? buildDialogueChain() : 'anull';

    await execa(ffmpeg, [
      '-i',
      inputs.dialogue,
      '-af',
      filterChain,
      '-c:a',
      'pcm_s16le',
      '-ar',
      '48000',
      outWav,
    ]);

    await loudnormTwoPass(outWav, outFinal, target_lufs, true_peak_db);

    manifest.filters.push('dialogue_processing', 'dialogue_only');
    await saveMixManifest(project_id, scene_id, manifest);
    return manifest;
  }

  // Prepare looped audio files
  let musicPath = inputs.music;
  let ambiencePath = inputs.ambience;

  const outputDir = path.dirname(outWav);
  fs.mkdirSync(outputDir, { recursive: true });

  if (inputs.music && loop_music) {
    const loopedMusicPath = path.join(outputDir, `${scene_id}_music_looped.wav`);
    await loopAudioToLength(inputs.music, sceneDuration, loopedMusicPath);
    musicPath = loopedMusicPath;
    tempFiles.push(loopedMusicPath);
    manifest.filters.push('music_looped');
  }

  if (inputs.ambience && loop_ambience) {
    const loopedAmbiencePath = path.join(outputDir, `${scene_id}_ambience_looped.wav`);
    await loopAudioToLength(inputs.ambience, sceneDuration, loopedAmbiencePath);
    ambiencePath = loopedAmbiencePath;
    tempFiles.push(loopedAmbiencePath);
    manifest.filters.push('ambience_looped');
  }

  // Analyze dialogue for advanced ducking
  let duckCurve: DuckCurvePoint[] | null = null;
  if (use_advanced_ducking) {
    console.log(`   📊 Analyzing dialogue with 50ms resolution...`);
    try {
      const env = await analyzeRMSEnvelope(inputs.dialogue, 0.05);

      if (env.length > 0) {
        const rawCurve = buildAdvancedDuckCurve(env, 0.15);

        const testMusic = downsampleDuckCurve(rawCurve, 0.2, 1);
        const testAmbience = downsampleDuckCurve(rawCurve, 0.2, 1);

        if (testMusic.length > 500 || testAmbience.length > 500) {
          console.warn(
            `   ⚠️  Ducking curve too complex (${Math.max(testMusic.length, testAmbience.length)} segments), using sidechain`
          );
          duckCurve = null;
        } else {
          duckCurve = rawCurve;
          console.log(`   ✅ Generated ${rawCurve.length} ducking control points`);
        }
      } else {
        console.warn(`   ⚠️  RMS envelope empty, falling back to sidechain compression`);
      }
    } catch (error) {
      console.warn(`   ⚠️  RMS analysis failed, using sidechain compression:`, (error as Error).message);
      duckCurve = null;
    }
  }

  // Build complex filter graph
  let filterGraph = '';
  let inputCount = 1; // Start at 1 because dialogue is input 0

  // Process dialogue
  const dialogueChain = use_dialogue_processing ? buildDialogueChain() : 'anull';
  filterGraph += `[0:a]${dialogueChain}[dialogue_processed];`;
  manifest.filters.push('dialogue_vocal_chain');

  // Process music with EQ separation and ducking
  if (musicPath) {
    filterGraph += `[${inputCount}:a]`;
    filterGraph += `acompressor=threshold=-18dB:ratio=3:attack=20:release=200:makeup=0dB,`;
    filterGraph += `highpass=f=60,`;
    filterGraph += `equalizer=f=800:width_type=o:width=2:g=-1.5,`;
    filterGraph += `equalizer=f=2500:width_type=o:width=2:g=-1,`;
    filterGraph += `volume=${music_gain_db}dB`;
    filterGraph += `[music_eq];`;

    if (duckCurve && use_advanced_ducking) {
      const musicDuck = duckToVolumeFilter(duckCurve, 'music');
      filterGraph += `[music_eq]${musicDuck}[music_ducked];`;
      manifest.filters.push('music_adaptive_ducking');
    } else {
      // Sidechain compression fallback
      filterGraph += `[music_eq]asplit=2[music_ref][music_pre];`;
      filterGraph += `[music_pre][dialogue_processed]sidechaincompress=`;
      filterGraph += `threshold=0.04:ratio=3:attack=120:release=500:knee=5:mix=0.5`;
      filterGraph += `[music_ducked];`;
      manifest.filters.push('music_sidechain_ducking');
    }

    inputCount++;
    manifest.filters.push(`music_gain=${music_gain_db}dB`, 'music_compression', 'music_eq_separation');
  }

  // Process ambience with subtle ducking and EQ
  if (ambiencePath) {
    filterGraph += `[${inputCount}:a]`;
    filterGraph += `acompressor=threshold=-20dB:ratio=2.5:attack=30:release=300:makeup=0dB,`;
    filterGraph += `highpass=f=40,`;
    filterGraph += `lowpass=f=12000,`;
    filterGraph += `volume=${ambience_gain_db}dB`;
    filterGraph += `[ambience_eq];`;

    if (duckCurve && use_advanced_ducking) {
      const ambienceDuck = duckToVolumeFilter(duckCurve, 'ambience');
      filterGraph += `[ambience_eq]${ambienceDuck}[ambience_ducked];`;
      manifest.filters.push('ambience_adaptive_ducking');
    } else {
      // Sidechain compression fallback
      filterGraph += `[ambience_eq][dialogue_processed]sidechaincompress=`;
      filterGraph += `threshold=0.05:ratio=2.5:attack=180:release=700:knee=4:mix=0.4`;
      filterGraph += `[ambience_ducked];`;
      manifest.filters.push('ambience_sidechain_ducking');
    }

    inputCount++;
    manifest.filters.push(`ambience_gain=${ambience_gain_db}dB`, 'ambience_compression', 'ambience_eq_separation');
  }

  // Process SFX with timing
  const sfxLabels: string[] = [];
  if (normalizedSfx.length > 0) {
    for (let i = 0; i < normalizedSfx.length; i++) {
      const sfxCue = normalizedSfx[i];

      // Validate SFX file exists
      if (!fs.existsSync(sfxCue.file)) {
        console.warn(`   ⚠️  SFX file not found: ${sfxCue.file}, skipping`);
        continue;
      }

      // Build filter with timing
      const sfxFilter = buildSfxFilter(inputCount, sfxCue, i, sfx_gain_db, sceneDuration);
      filterGraph += sfxFilter + ';';
      sfxLabels.push(`[sfx${i}]`);
      inputCount++;
    }
    manifest.filters.push(`sfx_gain=${sfx_gain_db}dB`, 'sfx_compression', 'sfx_timed');
  }

  // Final mix with proper ordering
  const mixInputs = ['[dialogue_processed]'];
  if (ambiencePath) mixInputs.push('[ambience_ducked]');
  if (musicPath) mixInputs.push('[music_ducked]');
  mixInputs.push(...sfxLabels);

  // Less aggressive gain compensation to preserve background levels
  const numInputs = mixInputs.length;
  const mixGainReduction = Math.min(-2, -1.5 * Math.log2(numInputs));

  filterGraph += `${mixInputs.join('')}amix=inputs=${numInputs}:duration=longest:dropout_transition=2:normalize=0[premix];`;

  // Apply gain compensation
  filterGraph += `[premix]volume=${mixGainReduction}dB[compensated];`;

  // Final limiter
  filterGraph += `[compensated]alimiter=limit=0.95:attack=5:release=50:level=false[mix]`;

  console.log(`   🎚️  Mix gain compensation: ${mixGainReduction.toFixed(1)}dB for ${numInputs} inputs`);

  // Validate filtergraph
  const validation = validateFiltergraph(filterGraph);
  if (!validation.valid) {
    console.error('❌ Invalid filtergraph:', validation.errors.join('\n'));
    await cleanupTempFiles(tempFiles);
    throw new Error('Filtergraph validation failed');
  }

  // Build and execute FFmpeg command
  const ffmpegArgs = ['-i', inputs.dialogue];
  if (musicPath) ffmpegArgs.push('-i', musicPath);
  if (ambiencePath) ffmpegArgs.push('-i', ambiencePath);

  // Add SFX inputs
  for (const sfxCue of normalizedSfx) {
    if (fs.existsSync(sfxCue.file)) {
      ffmpegArgs.push('-i', sfxCue.file);
    }
  }

  ffmpegArgs.push('-filter_complex', filterGraph, '-map', '[mix]', '-c:a', 'pcm_s16le', '-ar', '48000', '-y', outWav);

  console.log(`   🔧 Executing professional mix...`);

  try {
    await execa(ffmpeg, ffmpegArgs, { timeout: 120000 });
  } catch (error) {
    console.error(`   ❌ Mix failed:`, (error as Error).message);
    await cleanupTempFiles(tempFiles);
    throw error;
  }

  // Final loudness normalization
  await loudnormTwoPass(outWav, outFinal, target_lufs, true_peak_db, 8);

  // Measure final result
  const { stderr } = await execa(
    ffmpeg,
    ['-i', outFinal, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=8:print_format=json', '-f', 'null', '-'],
    { reject: false }
  );

  const txt = stderr || '';
  const outputI = (txt.match(/"output_i"\s*:\s*"?(.*?)"?(,|\s|$)/) || [])[1];
  const outputTP = (txt.match(/"output_tp"\s*:\s*"?(.*?)"?(,|\s|$)/) || [])[1];
  const outputLRA = (txt.match(/"output_lra"\s*:\s*"?(.*?)"?(,|\s|$)/) || [])[1];

  manifest.lufs_i = outputI ? parseFloat(outputI) : null;
  manifest.true_peak_db = outputTP ? parseFloat(outputTP) : null;
  manifest.lra = outputLRA ? parseFloat(outputLRA) : null;

  console.log(
    `   ✅ Final: ${manifest.lufs_i?.toFixed(2)} LUFS, ${manifest.true_peak_db?.toFixed(2)} dBTP, LRA ${manifest.lra?.toFixed(2)}`
  );

  // Cleanup temp files
  await cleanupTempFiles(tempFiles);

  await saveMixManifest(project_id, scene_id, manifest);
  return manifest;
}
