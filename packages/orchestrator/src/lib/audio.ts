/**
 * Audio utilities for TTS generation and processing
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

export interface VoiceParams {
  voice_id: string;
  params_json: Record<string, unknown>;
}

export interface TTSOptions {
  voice: VoiceParams;
  text: string;
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
 * Transcode MP3 to WAV using FFmpeg
 */
async function transcodeMp3ToWav(mp3: Buffer): Promise<Buffer> {
  const { stdout } = await execa(
    ffmpeg,
    ['-v', 'error', '-i', 'pipe:0', '-f', 'wav', '-ar', '48000', '-ac', '2', 'pipe:1'],
    {
      input: mp3,
      encoding: 'buffer',
    }
  );
  return stdout as unknown as Buffer;
}

// Default fallback voices (always available in ElevenLabs)
const DEFAULT_VOICES = {
  male: 'pNInz6obpgDQGcFmaJgB', // Adam - reliable male voice
  female: '21m00Tcm4TlvDq8ikWAM', // Rachel - reliable female voice
};

/**
 * Generate TTS audio using ElevenLabs API
 * If a voice is not found (404), automatically falls back to a default voice
 */
export async function ttsGenerate(opts: TTSOptions): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY missing');

  const params = opts.voice.params_json;
  const hasParams = params && Object.keys(params).length > 0;

  const request_body = {
    text: opts.text,
    voice_settings: hasParams
      ? params
      : {
          stability: 0.4,
          similarity_boost: 0.7,
        },
    output_format: 'mp3_44100_128',
  };

  // Try with the requested voice, fall back to default if voice not found
  let voiceId = opts.voice.voice_id;
  let usedFallback = false;

  const generateWithVoice = async (vid: string): Promise<Buffer> => {
    log.info('TTS: Generating audio', { voiceId: vid, usedFallback });
    log.debug('TTS request body', { request_body });

    return withRetry(
      async () => {
        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${vid}`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
              'Accept': 'audio/mpeg',
            },
            body: JSON.stringify(request_body),
          }
        );

        if (!res.ok) {
          const errorText = await res.text();
          if (res.status === 402) {
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
              `ElevenLabs TTS failed ${res.status}: ${errorText}`,
              res.status,
              true
            );
          }
          throw new RetryableError(
            `ElevenLabs TTS failed ${res.status}: ${errorText}`,
            res.status,
            false
          );
        }

        return transcodeMp3ToWav(Buffer.from(await res.arrayBuffer()));
      },
      {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
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
