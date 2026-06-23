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
import { classifyElevenLabsError, parseRetryAfter } from './elevenlabs-error.js';
import fs from 'fs';
import { log } from './logger.js';
import { getRequestContext } from './request-context.js';

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

  // B-003b: merge in narrationSpeed override when present. Applied AFTER the
  // params/default merge so a locked tuning value wins regardless of the
  // voice's stored params_json.
  const baseSettings = hasParams
    ? params
    : {
        stability: 0.4,
        similarity_boost: 0.7,
        use_speaker_boost: false,
      };
  const voice_settings = opts.speedOverride !== undefined
    ? { ...baseSettings, speed: opts.speedOverride }
    : baseSettings;

  const request_body = {
    text: opts.text,
    model_id: modelId,
    voice_settings,
  };

  // Try with the requested voice, fall back to default if voice not found
  let voiceId = opts.voice.voice_id;
  let usedFallback = false;

  const generateWithVoice = async (vid: string): Promise<Buffer> => {
    log.info('TTS: Generating audio', { voiceId: vid, modelId, usedFallback });
    log.debug('TTS request body', { request_body });

    return withRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ELEVENLABS_REQUEST_TIMEOUT_MS);

        // 2026-06-17: forward our request correlation ID to ElevenLabs so a
        // support ticket can cross-reference. They don't echo it back in
        // responses (as of June 2026) but having it on outbound is free.
        const ctx = getRequestContext();
        const outboundHeaders: Record<string, string> = {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/pcm',
        };
        if (ctx?.requestId) {
          outboundHeaders['X-Request-ID'] = ctx.requestId;
        }

        const attemptStart = Date.now();
        let res: Response;
        try {
          res = await fetch(
            // output_format is a query parameter — ElevenLabs ignores it in the body
            `https://api.elevenlabs.io/v1/text-to-speech/${vid}?output_format=pcm_24000`,
            {
              method: 'POST',
              headers: outboundHeaders,
              body: JSON.stringify(request_body),
              signal: controller.signal,
            }
          );
        } finally {
          clearTimeout(timeoutId);
        }
        // Structured log of every TTS attempt + outcome. Grep `requestId=<id>`
        // to find the whole chain for one job. The mixin attaches requestId
        // and projectId automatically; we include them again here for grep-
        // ability of the raw text without parsing JSON.
        //
        // Defensive header read: in unit tests `fakeResponse` constructs a
        // Response-like object without a real Headers instance, so
        // `res.headers.get` may not exist. Fall back to direct object access
        // and finally to null. ElevenLabs occasionally echoes a request-id
        // style header — capturing it lets us cross-reference in a support
        // ticket if we ever need to.
        const readHeader = (name: string): string | null => {
          const h = res.headers;
          if (!h) return null;
          if (typeof (h as Headers).get === 'function') return (h as Headers).get(name);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const asObj = h as any;
          return (asObj[name] ?? asObj[name.toLowerCase()] ?? null) as string | null;
        };
        log.info('ElevenLabs TTS response', {
          voiceId: vid,
          modelId,
          status: res.status,
          elapsedMs: Date.now() - attemptStart,
          elevenLabsRequestId: readHeader('request-id') || readHeader('x-request-id') || null,
        });

        if (!res.ok) {
          const errorText = await res.text();
          const responseHeaders: Record<string, string> = {};
          res.headers.forEach((value, key) => { responseHeaders[key] = value; });

          // #378: classify the error body so log queries can pivot on
          // the ElevenLabs sub-type (system_busy vs too_many_concurrent_
          // requests vs rate_limit_exceeded vs quota_exceeded). Each
          // implies a different operator action; treating them as one
          // blob ("429") destroyed our ability to tune for the grant
          // tier. See packages/orchestrator/src/lib/elevenlabs-error.ts.
          const classification = classifyElevenLabsError(res.status, errorText);
          const retryAfterMs = parseRetryAfter(
            readHeader('retry-after') ?? readHeader('Retry-After'),
          );

          log.warn('ElevenLabs non-OK response', {
            status: res.status,
            voiceId: vid,
            errorKind: classification.kind,
            matchedToken: classification.matchedToken,
            retryAfterMs,
            shouldLowerConcurrency: classification.shouldLowerConcurrency,
            body: errorText,
            headers: responseHeaders,
          });

          // Loud operator signal: if we keep seeing this in dev/prod
          // it's our fault, not ElevenLabs'. Surfaces in any log search
          // for "lower TTS_CONCURRENCY" so the next deploy can tune it.
          if (classification.shouldLowerConcurrency) {
            log.warn(
              '[tts] ElevenLabs reports too_many_concurrent_requests — consider lowering TTS_CONCURRENCY',
              { voiceId: vid, currentConcurrencyEnv: process.env.TTS_CONCURRENCY ?? 'unset' },
            );
          }

          if (res.status === 402 || classification.kind === 'quota_exceeded') {
            // Payment Required — ElevenLabs account is past due or over quota.
            // Do not retry; surface a human-readable message.
            throw new RetryableError(
              'ElevenLabs account billing issue (402 Payment Required). Audio generation is temporarily paused — please check the ElevenLabs account billing status.',
              res.status,
              false
            );
          }
          if (res.status === 401) {
            throw new RetryableError(
              'ElevenLabs API key is invalid or missing (401 Unauthorized). Please check the ELEVENLABS_API_KEY environment variable.',
              res.status,
              false
            );
          }
          if (res.status === 429 || res.status >= 500) {
            throw new RetryableError(
              `ElevenLabs TTS failed ${res.status} (${classification.kind}): ${errorText}`,
              res.status,
              true,
              retryAfterMs ?? undefined,
            );
          }
          throw new RetryableError(
            `ElevenLabs TTS failed ${res.status}: ${errorText}`,
            res.status,
            false
          );
        }

        const rawBuffer = Buffer.from(await res.arrayBuffer());
        return transcodePcmToWav(rawBuffer);
      },
      {
        // #320 (2026-06-17): bumped from 3→5 retries and max delay 10s→30s
        // to ride out short ElevenLabs blips. Ryan's 2026-06-17 incident:
        // sustained ElevenLabs 500s killed chunk 0 after 3 retries (~15s
        // total backoff window), turning a transient upstream issue into
        // "no audio was produced." With 5 retries + 30s cap the total
        // window is ~60s — covers most ElevenLabs single-incident outages
        // without keeping a doomed job alive forever.
        maxRetries: 5,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        jitterFactor: 0.2,
        retryableStatuses: [429, 500, 502, 503, 504],
      }
    );
  };

  try {
    return await generateWithVoice(voiceId);
  } catch (err) {
    // Check if it's a voice_not_found error (404)
    if (err instanceof Error && err.message.includes('404') && err.message.includes('voice_not_found')) {
      log.warn('TTS: Voice not found, using fallback voice', { voiceId });
      usedFallback = true;
      // Use male voice as default fallback
      return await generateWithVoice(DEFAULT_VOICES.male);
    }
    throw err;
  }
}
