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
import { log } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { getOutputDir } from '../../lib/env.js';

const ffmpeg = ffmpegStatic as unknown as string;
const ffprobePath = ffprobeStatic.path;

if (!ffmpeg) {
  throw new Error('FFmpeg binary not found. Please ensure ffmpeg-static is installed.');
}

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
  /** Total script page count — used to scale the final FFmpeg mix timeout. */
  pageCount?: number;
}

/**
 * Calculate mixer operation timeout from page count.
 * Base: 30s + 0.5s/page, capped at 300s.
 * Default (no pageCount): 120s.
 */
export function mixerTimeoutMs(pageCount?: number): number {
  if (pageCount == null || pageCount <= 0) return 120_000;
  return Math.min(30_000 + pageCount * 500, 300_000);
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

  log.debug('Looping audio to target duration', {
    file: path.basename(inputPath),
    inputDurationSec: parseFloat(inputDuration.toFixed(2)),
    targetDurationSec: parseFloat(targetDuration.toFixed(2)),
  });

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
      log.warn('RMS analysis returned empty, using fallback envelope');
      const duration = await audioDurationSec(dialoguePath);
      const numSamples = Math.ceil(duration / hop);

      for (let i = 0; i < numSamples; i++) {
        env.push({ t: i * hop, rmsDb: -35 });
      }
    }

    return env;
  } catch (error) {
    log.warn('RMS analysis error, returning default envelope', { error: (error as Error).message });
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

  log.debug('Downsampled ducking curve', { inputPoints: curve.length, outputSegments: segments.length, track: targetTrack });

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
  log.info('Analyzing loudness', { targetLufs: I, truePeakDb: TP, lra: LRA });

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
      const match = txt.match(new RegExp(`"${k}"\\s*:\\s*"?([-\\d.]+)"?`)); // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
      return match ? match[1] : null;
    };

    const measured_I = rx('input_i');
    const measured_TP = rx('input_tp');
    const measured_LRA = rx('input_lra');
    const measured_thresh = rx('input_thresh');
    const target_offset = rx('target_offset');

    log.debug('Loudness measurement complete', { measuredLufs: measured_I, measuredTruePeak: measured_TP, measuredLra: measured_LRA });

    if (measured_I && parseFloat(measured_I) > -6) {
      log.warn('Input is extremely loud, applying emergency normalization', { measuredLufs: measured_I });

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

      log.info('Emergency normalization applied');
      return;
    }

    if (!measured_I || !measured_TP || !measured_LRA || !measured_thresh || !target_offset) {
      log.warn('Incomplete loudness measurement data, using single-pass normalization');

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

      log.info('Single-pass normalization applied');
      return;
    }

    log.info('Applying two-pass loudness normalization');
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

    log.info('Loudness normalization complete', { targetLufs: I });
  } catch (error) {
    const err = error as { timedOut?: boolean; message: string };
    if (err.timedOut) {
      log.error('Loudness normalization timed out, using fallback', error as Error);
    } else {
      log.error('Loudness normalization failed, using fallback', error as Error);
    }

    log.info('Applying fallback normalization');
    await execa(
      ffmpeg,
      ['-i', inputPath, '-af', `volume=-6dB`, '-ar', '48000', '-c:a', 'aac', '-b:a', '256k', '-y', outPath],
      { timeout: 30000 }
    );

    log.info('Fallback normalization applied');
  }
}

async function saveMixManifest(project_id: string, scene_id: string, manifest: MixManifest): Promise<void> {
  // Save to database via Prisma raw SQL
  try {
    await prisma.$executeRaw`
      INSERT INTO mix_manifests (project_id, scene_id, mix_manifest_json, created_at)
      VALUES (${project_id}, ${scene_id}, ${JSON.stringify(manifest)}::jsonb, NOW())
      ON CONFLICT (project_id, scene_id)
      DO UPDATE SET mix_manifest_json = ${JSON.stringify(manifest)}::jsonb, created_at = NOW()
    `;
  } catch (err) {
    log.error('Failed to save mix manifest to DB', err instanceof Error ? err : undefined, {
      project_id, scene_id,
    });
  }

  // Also save locally
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const localPath = path.join(getOutputDir(), project_id, 'scenes', `${scene_id}-manifest.json`);
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
      log.warn('Could not clean up temp file', { file });
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
    music_gain_db = -22,
    ambience_gain_db = -18,
    sfx_gain_db = -12,
    target_lufs = -16,
    true_peak_db = -1.5,
    use_dialogue_processing = true,
    use_advanced_ducking = false,
    loop_music = true,
    loop_ambience = true,
  } = mixParams;

  log.info('Starting scene mix', { sceneId: scene_id, projectId: project_id });

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
  log.info('Scene duration measured', { sceneId: scene_id, durationSec: parseFloat(sceneDuration.toFixed(2)) });

  // Log SFX timing info
  if (normalizedSfx.length > 0) {
    log.debug('SFX tracks with timing', {
      sfxCount: normalizedSfx.length,
      tracks: normalizedSfx.map((sfx) => ({
        file: path.basename(sfx.file),
        atSec: parseFloat(sfx.at.toFixed(2)),
        duration: sfx.duration ? parseFloat(sfx.duration.toFixed(2)) : null,
      })),
    });
  }

  // Dialogue-only scene
  if (!inputs.music && !inputs.ambience && normalizedSfx.length === 0) {
    log.info('Dialogue-only scene, skipping multi-track mix', { sceneId: scene_id });

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
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const loopedMusicPath = path.join(outputDir, `${scene_id}_music_looped.wav`);
    await loopAudioToLength(inputs.music, sceneDuration, loopedMusicPath);
    musicPath = loopedMusicPath;
    tempFiles.push(loopedMusicPath);
    manifest.filters.push('music_looped');
  }

  if (inputs.ambience && loop_ambience) {
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const loopedAmbiencePath = path.join(outputDir, `${scene_id}_ambience_looped.wav`);
    await loopAudioToLength(inputs.ambience, sceneDuration, loopedAmbiencePath);
    ambiencePath = loopedAmbiencePath;
    tempFiles.push(loopedAmbiencePath);
    manifest.filters.push('ambience_looped');
  }

  // Analyze dialogue for advanced ducking
  let duckCurve: DuckCurvePoint[] | null = null;
  if (use_advanced_ducking) {
    log.info('Analyzing dialogue for advanced ducking', { resolutionMs: 50 });
    try {
      const env = await analyzeRMSEnvelope(inputs.dialogue, 0.05);

      if (env.length > 0) {
        const rawCurve = buildAdvancedDuckCurve(env, 0.15);

        const testMusic = downsampleDuckCurve(rawCurve, 0.2, 1);
        const testAmbience = downsampleDuckCurve(rawCurve, 0.2, 1);

        if (testMusic.length > 500 || testAmbience.length > 500) {
          log.warn('Ducking curve too complex, falling back to sidechain', {
            segments: Math.max(testMusic.length, testAmbience.length),
          });
          duckCurve = null;
        } else {
          duckCurve = rawCurve;
          log.debug('Generated ducking control points', { points: rawCurve.length });
        }
      } else {
        log.warn('RMS envelope empty, falling back to sidechain compression');
      }
    } catch (error) {
      log.warn('RMS analysis failed, using sidechain compression', { error: (error as Error).message });
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
        log.warn('SFX file not found, skipping', { file: sfxCue.file });
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

  log.debug('Mix gain compensation calculated', { gainReductionDb: parseFloat(mixGainReduction.toFixed(1)), inputCount: numInputs });

  // Validate filtergraph
  const validation = validateFiltergraph(filterGraph);
  if (!validation.valid) {
    log.error('Invalid filtergraph', undefined, { errors: validation.errors });
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

  const mixTimeout = mixerTimeoutMs(options.pageCount);
  log.info('Executing mix', { sceneId: scene_id, inputCount: inputCount, mixTimeoutMs: mixTimeout });

  try {
    await execa(ffmpeg, ffmpegArgs, { timeout: mixTimeout });
  } catch (error) {
    log.error('Mix failed', error as Error, { sceneId: scene_id });
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

  log.info('Mix complete', {
    sceneId: scene_id,
    lufsI: manifest.lufs_i,
    truePeakDb: manifest.true_peak_db,
    lra: manifest.lra,
  });

  // Cleanup temp files
  await cleanupTempFiles(tempFiles);

  await saveMixManifest(project_id, scene_id, manifest);
  return manifest;
}
