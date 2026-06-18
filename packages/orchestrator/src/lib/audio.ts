/**
 * Audio utilities for TTS generation and processing
 *
 * ElevenLabs optimisations (2026-04-26):
 *  - model_id: eleven_turbo_v2_5 — same credits/char as standard, ~3× faster latency
 *  - output_format: pcm_24000 — raw PCM avoids lossy MP3 encode/decode round-trip
 *  - use_speaker_boost: false — removes unnecessary post-processing per call
 *  - 30 s AbortController timeout — prevents silent hangs on slow ElevenLabs responses
 *  - Configurable via ELEVENLABS_MODEL env var (default: eleven_turbo_v2_5)
 */

import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { execa } from 'execa';
import { withRetry, RetryableError } from './retry.js';
import fs from 'fs';
import { log } from './logger.js';

const ffprobePath = ffprobeStatic.path;
const ffmpeg = ffmpegStatic as unknown as string;

if (!ffmpeg) {
  throw new Error('FFmpeg binary not found. Please ensure ffmpeg-static is installed.');
}

// ElevenLabs model to use. eleven_turbo_v2_5 is the best price/performance ratio:
// same character credits as eleven_multilingual_v2 but ~3× faster generation.
// Override via ELEVENLABS_MODEL env var if needed (e.g. eleven_multilingual_v2 for
// non-English scripts, or eleven_flash_v2_5 for maximum speed at slight quality cost).
const DEFAULT_ELEVENLABS_MODEL = 'eleven_turbo_v2_5';

// Per-request timeout for ElevenLabs TTS calls.
// 30 s is generous for any single line; prevents silent hangs.
const ELEVENLABS_REQUEST_TIMEOUT_MS = 30_000;

export interface VoiceParams {
  voice_id: string;
  params_json: Record<string, unknown>;
}

export interface TTSOptions {
  voice: VoiceParams;
  text: string;
  /**
   * B-003b (2026-06-15): when set, overrides voice_settings.speed in the
   * ElevenLabs request. Used by the narrator's per-line TTS calls when
   * the user has a locked AudioTuning row. ElevenLabs accepts 0.7–1.2.
   */
  speedOverride?: number;
}

/**
 * Trim silence from audio file using FFmpeg
 */
export async function trimSilence(filePath: string): Promise<void> {
  const tempPath = filePath.replace('.wav', '_trimmed.wav');

  // FFmpeg Filter Explanation:
  // stop_periods=-1 : Search from the beginning until the end of the file
  // stop_duration=0.1 : Treat anything longer than 0.1s as silence
  // stop_threshold=-50dB : Anything quieter than -50dB is considered silence

  await execa(ffmpeg, [
    '-v',
    'error',
    '-i',
    filePath,
    '-af',
    'silenceremove=stop_periods=-1:stop_duration=0.1:stop_threshold=-50dB',
    '-y',
    tempPath,
  ]);

  // Overwrite the original file with the trimmed version
  fs.renameSync(tempPath, filePath);
}

/**
 * Get audio duration in seconds using FFprobe
 */
export async function audioDurationSec(filePath: string): Promise<number> {
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
 * Convert raw PCM (signed 16-bit, 24 kHz, mono) received from ElevenLabs
 * into a WAV buffer at 48 kHz stereo — the format expected by the mixer.
 *
 * Using PCM output from ElevenLabs avoids the lossy MP3 encode/decode round-trip
 * and is faster than transcoding from MP3.
 */
async function transcodePcmToWav(pcm: Buffer): Promise<Buffer> {
  const { stdout } = await execa(
    ffmpeg,
    [
      '-v', 'error',
      // Describe the raw PCM input
      '-f', 's16le', '-ar', '24000', '-ac', '1',
      '-i', 'pipe:0',
      // Output: WAV 48 kHz stereo (mixer requirement)
      '-c:a', 'pcm_s16le', '-f', 'wav', '-ar', '48000', '-ac', '2',
      'pipe:1',
    ],
    { input: pcm, encoding: 'buffer' }
  );
  return stdout as unknown as Buffer;
}

/**
 * Transcode an MP3 buffer (ElevenLabs' default output_format) to WAV 48 kHz stereo.
 *
 * #320 follow-up (2026-06-17): the progressive-fallback path uses MP3 instead
 * of PCM when an ElevenLabs 500 is suspected to be PCM-routing related.
 * Adds ~50ms per stem vs PCM but a much more battle-tested ElevenLabs path
 * (their default; what every SDK example shows).
 */
async function transcodeMp3ToWav(mp3: Buffer): Promise<Buffer> {
  const { stdout } = await execa(
    ffmpeg,
    [
      '-v', 'error',
      // MP3 input — ffmpeg auto-detects sample rate from frame headers
      '-f', 'mp3',
      '-i', 'pipe:0',
      // Output: WAV 48 kHz stereo (mixer requirement)
      '-c:a', 'pcm_s16le', '-f', 'wav', '-ar', '48000', '-ac', '2',
      'pipe:1',
    ],
    { input: mp3, encoding: 'buffer' }
  );
  return stdout as unknown as Buffer;
}

// Default fallback voices (always available in ElevenLabs)
const DEFAULT_VOICES = {
  male: 'pNInz6obpgDQGcFmaJgB', // Adam - reliable male voice
  female: '21m00Tcm4TlvDq8ikWAM', // Rachel - reliable female voice
};

/**
 * Generate a short silent WAV buffer for mock/test mode.
 */
async function generateSilentWav(durationSec = 1): Promise<Buffer> {
  const { stdout } = await execa(ffmpeg, [
    '-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo`,
    '-t', String(durationSec),
    '-f', 'wav', 'pipe:1',
  ], { encoding: 'buffer' });
  return stdout as unknown as Buffer;
}

/**
 * Generate TTS audio using ElevenLabs API.
 *
 * Set ELEVENLABS_MOCK=true to skip real API calls and return silent audio
 * instead. Useful during development and testing to avoid ElevenLabs charges.
 * If a voice is not found (404), automatically falls back to a default voice.
 */
export async function ttsGenerate(opts: TTSOptions): Promise<Buffer> {
  // ── Mock mode ─────────────────────────────────────────────────────────────
  if (process.env.ELEVENLABS_MOCK === 'true') {
    const words = opts.text.trim().split(/\s+/).length;
    const estimatedSec = Math.max(0.5, words * 0.35); // ~0.35s per word
    log.info('TTS mock: returning silent audio', { words, estimatedSec, voiceId: opts.voice.voice_id });
    return generateSilentWav(estimatedSec);
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY missing');

  const modelId = process.env.ELEVENLABS_MODEL || DEFAULT_ELEVENLABS_MODEL;

  const params = opts.voice.params_json;
  const hasParams = params && Object.keys(params).length > 0;

  const baseSettings = hasParams
    ? (params as Record<string, unknown>)
    : {
        stability: 0.4,
        similarity_boost: 0.7,
        use_speaker_boost: false,
      };
  const fullVoiceSettings: Record<string, unknown> = opts.speedOverride !== undefined
    ? { ...baseSettings, speed: opts.speedOverride }
    : { ...baseSettings };

  // #320 follow-up (2026-06-17) — progressive shape fallback.
  //
  // Peter spent the day chasing ElevenLabs 500s where the request body our
  // code sends fails but the "same" curl succeeds. Three plausible causes
  // ranked by likelihood:
  //   A. PCM output endpoint (?output_format=pcm_24000 + Accept: audio/pcm)
  //      routes through a different backend that's more fragile/often-500.
  //      Curl without that query param hits the default MP3 path and works.
  //   B. `use_speaker_boost: false` in voice_settings is now rejected for
  //      eleven_turbo_v2_5 after the 2026-06-08 schema changes.
  //   C. `speed` in voice_settings is rejected for the current model.
  //
  // Strategy: try shape (A) with full retry budget (transient handling).
  // On a final 500 after retries are exhausted, fall back to shape (B) once.
  // If still 500, fall back to (C) once. Each shape strips one suspect:
  //
  //   shape 0 (current): PCM, full voice_settings — what we send today
  //   shape 1 (MP3):     MP3 default, full voice_settings — kills suspect #1
  //   shape 2 (no boost): MP3, drop use_speaker_boost — kills suspect #2
  //   shape 3 (minimal):  MP3, drop everything except stability+similarity
  //                       — kills suspect #3 and any other validation
  //
  // The first successful shape is the answer. Tag it in logs so we can
  // converge to the right default once the dust settles.
  type ShapeStrategy = {
    name: string;
    outputFormat: string | null; // null = MP3 default
    acceptHeader: string;
    transcode: (buf: Buffer) => Promise<Buffer>;
    stripUseSpeakerBoost: boolean;
    stripSpeed: boolean;
  };

  const stripCurrent = baseSettings as Record<string, unknown>;
  const STRATEGIES: ShapeStrategy[] = [
    {
      name: 'pcm-full',
      outputFormat: 'pcm_24000',
      acceptHeader: 'audio/pcm',
      transcode: transcodePcmToWav,
      stripUseSpeakerBoost: false,
      stripSpeed: false,
    },
    {
      name: 'mp3-full',
      outputFormat: null,
      acceptHeader: 'audio/mpeg',
      transcode: transcodeMp3ToWav,
      stripUseSpeakerBoost: false,
      stripSpeed: false,
    },
    {
      name: 'mp3-no-boost',
      outputFormat: null,
      acceptHeader: 'audio/mpeg',
      transcode: transcodeMp3ToWav,
      stripUseSpeakerBoost: true,
      stripSpeed: false,
    },
    {
      name: 'mp3-minimal',
      outputFormat: null,
      acceptHeader: 'audio/mpeg',
      transcode: transcodeMp3ToWav,
      stripUseSpeakerBoost: true,
      stripSpeed: true,
    },
  ];

  // Allow operators to disable the fallback chain via env if needed for
  // debugging — set ELEVENLABS_FALLBACK_DISABLED=true to keep the legacy
  // PCM-only behavior and surface 500s directly.
  const fallbackDisabled = process.env.ELEVENLABS_FALLBACK_DISABLED === 'true';
  const activeStrategies = fallbackDisabled ? [STRATEGIES[0]] : STRATEGIES;

  // Try with the requested voice, fall back to default if voice not found
  const voiceId = opts.voice.voice_id;
  let usedFallback = false;

  function buildVoiceSettings(strat: ShapeStrategy): Record<string, unknown> {
    const settings = { ...fullVoiceSettings };
    if (strat.stripUseSpeakerBoost) delete settings.use_speaker_boost;
    if (strat.stripSpeed) delete settings.speed;
    if (strat.stripSpeed) {
      // The minimal strategy also drops any non-core fields the voice's
      // params_json might carry (style, similarity_boost overrides, etc.)
      // that would survive the surface-level deletes above. Keep ONLY the
      // two fields that every model accepts.
      return {
        stability: typeof settings.stability === 'number' ? settings.stability : 0.4,
        similarity_boost: typeof settings.similarity_boost === 'number' ? settings.similarity_boost : 0.7,
      };
    }
    return settings;
  }

  const generateWithVoice = async (vid: string): Promise<Buffer> => {
    // #320 follow-up: bumped from log.debug to log.info so the EXACT request
    // body lands in Render logs. Peter was bisecting blind; this gives us
    // every line of context needed to replay as curl.
    log.info('TTS: Generating audio', { voiceId: vid, modelId, usedFallback, strategies: activeStrategies.length });

    let lastError: Error | null = null;
    for (let i = 0; i < activeStrategies.length; i++) {
      const strategy = activeStrategies[i];
      const isFirstShape = i === 0;
      const voice_settings = buildVoiceSettings(strategy);
      const request_body: Record<string, unknown> = {
        text: opts.text,
        model_id: modelId,
        voice_settings,
      };

      const url = strategy.outputFormat
        ? `https://api.elevenlabs.io/v1/text-to-speech/${vid}?output_format=${strategy.outputFormat}`
        : `https://api.elevenlabs.io/v1/text-to-speech/${vid}`;

      log.info('TTS shape attempt', {
        voiceId: vid, strategy: strategy.name, shape: i + 1, totalShapes: activeStrategies.length,
        outputFormat: strategy.outputFormat ?? 'mp3-default',
        bodyKeys: Object.keys(voice_settings),
      });

      try {
        const buf = await withRetry(
          async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), ELEVENLABS_REQUEST_TIMEOUT_MS);

            let res: Response;
            try {
              res = await fetch(url, {
                method: 'POST',
                headers: {
                  'xi-api-key': apiKey,
                  'Content-Type': 'application/json',
                  'Accept': strategy.acceptHeader,
                },
                body: JSON.stringify(request_body),
                signal: controller.signal,
              });
            } finally {
              clearTimeout(timeoutId);
            }

            if (!res.ok) {
              const errorText = await res.text();
              if (res.status === 402) {
                throw new RetryableError(
                  'ElevenLabs account billing issue (402 Payment Required). Audio generation is temporarily paused — please check the ElevenLabs account billing status.',
                  res.status, false,
                );
              }
              if (res.status === 401) {
                throw new RetryableError(
                  'ElevenLabs API key is invalid or missing (401 Unauthorized). Please check the ELEVENLABS_API_KEY environment variable.',
                  res.status, false,
                );
              }
              if (res.status === 429 || res.status >= 500) {
                throw new RetryableError(
                  `ElevenLabs TTS failed ${res.status} [shape=${strategy.name}]: ${errorText}`,
                  res.status, true,
                );
              }
              throw new RetryableError(
                `ElevenLabs TTS failed ${res.status} [shape=${strategy.name}]: ${errorText}`,
                res.status, false,
              );
            }

            const rawBuffer = Buffer.from(await res.arrayBuffer());
            return strategy.transcode(rawBuffer);
          },
          {
            // First shape gets the full transient-handling budget; subsequent
            // shapes get 1 try each (we're already past transient land).
            maxRetries: isFirstShape ? 5 : 0,
            initialDelayMs: 1000,
            maxDelayMs: 30000,
            jitterFactor: 0.2,
            retryableStatuses: [429, 500, 502, 503, 504],
          },
        );
        if (!isFirstShape) {
          log.warn('TTS: succeeded with fallback shape', {
            voiceId: vid, strategy: strategy.name, shape: i + 1,
          });
        }
        return buf;
      } catch (err) {
        lastError = err as Error;
        const msg = (err as Error).message.toLowerCase();
        // Only progress to the next shape on a 500-class failure (covers
        // 5xx and the wrapped ElevenLabs TTS failed 5/429 strings). For
        // 401/402/404 etc. we want to surface immediately.
        const looksLike5xx =
          msg.includes('failed 5') || msg.includes('failed 429') ||
          msg.includes('502') || msg.includes('503') || msg.includes('504');
        if (!looksLike5xx) throw err;
        if (i === activeStrategies.length - 1) throw err;
        log.warn('TTS: shape failed with 5xx, trying next shape', {
          voiceId: vid, failedStrategy: strategy.name,
          nextStrategy: activeStrategies[i + 1].name,
          errorPreview: (err as Error).message.slice(0, 200),
        });
      }
    }
    throw lastError ?? new Error('TTS: all shape strategies exhausted');
  };

  try {
    return await generateWithVoice(voiceId);
  } catch (err) {
    // Check if it's a voice_not_found error (404)
    if (err instanceof Error && err.message.includes('404') && err.message.includes('voice_not_found')) {
      log.warn('TTS: Voice not found, using fallback voice', { voiceId });
      usedFallback = true;
      return await generateWithVoice(DEFAULT_VOICES.male);
    }
    throw err;
  }
}
