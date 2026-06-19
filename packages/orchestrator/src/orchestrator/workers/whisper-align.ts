/**
 * Whisper ASR Worker - Word-level alignment using Whisper
 *
 * Fallback chain (cheapest first):
 *   1. whisper.cpp local binary (free) — only attempted when WHISPER_CPP_PATH
 *      is explicitly set to an existing file. Default behavior is to SKIP
 *      this step because the Render container doesn't ship the binary.
 *      Previously the code defaulted WHISPER_CPP_PATH to 'whisper' and tried
 *      to spawn it from PATH, getting ENOENT on every line and flooding logs.
 *   2. Groq Whisper API (cheap — ~12× cheaper than OpenAI Whisper) — default
 *      ON when GROQ_API_KEY is set. Disable via ENABLE_GROQ_WHISPER_FALLBACK=false.
 *   3. OpenAI Whisper API (expensive — opt in via
 *      ENABLE_OPENAI_WHISPER_FALLBACK=true).
 *   4. Duration-based estimator (free, lower quality).
 */

import { execa } from 'execa';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { withRetry } from '../../lib/retry.js';
import { log } from '../../lib/logger.js';
import { dedupedWarn } from '../../lib/dedup-logger.js';

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

interface WhisperSegment {
  text?: string;
  offsets?: { from: number; to: number };
  timestamps?: { from: string; to: string } | WordTimestamp[];
  from?: number;
  to?: number;
}

interface WhisperOutput {
  transcription?: WhisperSegment[];
}

/**
 * Use Whisper to get word-level timestamps from audio
 * Requires whisper.cpp or OpenAI Whisper API
 */
export async function whisperAlign(
  audioPath: string,
  expectedText: string
): Promise<WordTimestamp[] | null> {
  log.debug('Running Whisper ASR for word-level alignment');

  const whisperCppPath = process.env.WHISPER_CPP_PATH;
  const modelPath = process.env.WHISPER_MODEL_PATH || 'models/ggml-base.en.bin';

  // Use a short temp path for whisper output — deriving from audioPath yields a
  // 185+ char basename (UUID + scene/line IDs + two 64-char hashes) that
  // overflows whisper.cpp's internal fname_out buffer, causing it to silently
  // skip writing the JSON while still exiting 0.
  const outputBase = path.join(os.tmpdir(), `w_${crypto.randomBytes(8).toString('hex')}`);
  const jsonOutputPath = `${outputBase}.json`;

  try {
    // Only attempt the local binary when it's explicitly configured AND
    // either an absolute file path that exists, or any value that
    // execa can resolve from PATH. Previously this defaulted to 'whisper'
    // and tried to spawn it on every line in prod (where the binary
    // isn't installed), generating ENOENT noise per TTS line.
    if (!whisperCppPath) {
      throw new Error(
        'WHISPER_CPP_PATH not set — skipping local whisper.cpp (this is normal in environments without the binary; falling through to API)',
      );
    }
    // If the path looks like an absolute or relative file path, verify it
    // exists before trying to spawn. PATH-style names (no slash) are left to
    // execa to resolve.
    if (whisperCppPath.includes(path.sep) && !fs.existsSync(whisperCppPath)) {
      throw new Error(`Local whisper binary not found at: ${whisperCppPath}`);
    }

    // Run whisper.cpp
    await execa(whisperCppPath, [
      '-m',
      modelPath,
      '-f',
      audioPath,
      '-ojf', // Create JSON file
      '-of',
      outputBase, // Specify output filename
      '-ml',
      '1', // Max line length
    ]);

    // Check if JSON file was created
    if (!fs.existsSync(jsonOutputPath)) {
      throw new Error(`Whisper finished but JSON file is missing at: ${jsonOutputPath}`);
    }

    // Read and parse the JSON file
    const jsonContent = fs.readFileSync(jsonOutputPath, 'utf8');
    const words = parseWhisperCppOutput(jsonContent, expectedText);

    // Cleanup: Delete the generated .json file
    try {
      fs.unlinkSync(jsonOutputPath);
    } catch (e) {
      log.warn('Could not delete temp JSON file', { error: (e as Error).message });
    }

    log.debug('Whisper alignment complete', { wordCount: words.length });
    return words;
  } catch (err) {
    const errMsg = (err as Error).message;
    // Both API paths transcribe via OpenAI-compatible `/audio/transcriptions`,
    // so they share `transcribeViaApi`.

    const groqEnabled = process.env.ENABLE_GROQ_WHISPER_FALLBACK !== 'false';
    if (groqEnabled && process.env.GROQ_API_KEY) {
      // The "whisper.cpp not configured/missing" case fires once per TTS line
      // in a normal generation — was producing thousands of identical warns.
      // dedupedWarn emits at debug for every hit, but warns at most once per
      // category per 60s and tags the suppressed count on the next warn.
      const routineSkip = !whisperCppPath || errMsg.includes('WHISPER_CPP_PATH not set');
      if (routineSkip) {
        dedupedWarn('whisper-cpp-skipped', 'falling back to Groq Whisper for alignment', { error: errMsg });
      } else {
        dedupedWarn('whisper-cpp-runtime-error', 'whisper.cpp failed; falling back to Groq Whisper', { error: errMsg });
      }
      try {
        return await transcribeViaApi(audioPath, {
          url: 'https://api.groq.com/openai/v1/audio/transcriptions',
          apiKey: process.env.GROQ_API_KEY,
          model: process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3',
          providerLabel: 'groq',
        });
      } catch (groqErr) {
        dedupedWarn('groq-whisper-failed', 'Groq Whisper failed; trying next fallback', {
          error: (groqErr as Error).message,
        });
      }
    }

    const openaiEnabled = process.env.ENABLE_OPENAI_WHISPER_FALLBACK === 'true';
    if (openaiEnabled && process.env.OPENAI_API_KEY) {
      dedupedWarn('openai-whisper-fallback', 'falling back to OpenAI Whisper API (billed)', { error: errMsg });
      return await transcribeViaApi(audioPath, {
        url: 'https://api.openai.com/v1/audio/transcriptions',
        apiKey: process.env.OPENAI_API_KEY,
        model: 'whisper-1',
        providerLabel: 'openai',
      });
    }

    dedupedWarn('whisper-all-fallbacks-unavailable', 'whisper.cpp + API fallbacks unavailable; using duration-based estimator', {
      error: errMsg,
      hint: 'Set GROQ_API_KEY for cheap Whisper, or ENABLE_OPENAI_WHISPER_FALLBACK=true for paid OpenAI Whisper.',
    });
    return null;
  }
}

/**
 * Parse whisper.cpp JSON output
 */
function parseWhisperCppOutput(jsonString: string, expectedText: string): WordTimestamp[] {
  const words: WordTimestamp[] = [];

  try {
    const data: WhisperOutput = JSON.parse(jsonString);

    if (!data.transcription || !Array.isArray(data.transcription)) {
      log.warn('Whisper JSON format unexpected: transcription array missing', {
        jsonPreview: jsonString.substring(0, 200),
      });
      return [];
    }

    for (const segment of data.transcription) {
      let start: number | null = null;
      let end: number | null = null;
      const text = segment.text;

      if (segment.offsets) {
        start = segment.offsets.from / 1000.0;
        end = segment.offsets.to / 1000.0;
      } else if (typeof segment.from === 'number' && typeof segment.to === 'number') {
        start = segment.from / 1000.0;
        end = segment.to / 1000.0;
      }

      if (start !== null && end !== null && text) {
        words.push({
          word: text.trim(),
          start: start,
          end: end,
        });
        continue;
      }

      // Handle nested timestamps array
      if (segment.timestamps && Array.isArray(segment.timestamps)) {
        for (const ts of segment.timestamps as WordTimestamp[]) {
          words.push({
            word: ts.word.trim(),
            start: ts.start / 1000,
            end: ts.end / 1000,
          });
        }
      }
    }
  } catch (err) {
    log.error('Failed to parse whisper.cpp output', err instanceof Error ? err : undefined);
  }

  return words;
}

/**
 * Generic OpenAI-compatible `/audio/transcriptions` client. Used for both
 * Groq Whisper (cheap, via api.groq.com/openai/v1) and OpenAI Whisper
 * (expensive, opt-in). The wire format is identical between the two — only
 * URL, key, and model name differ.
 *
 * `providerLabel` is logging-only.
 */
export async function transcribeViaApi(
  audioPath: string,
  config: { url: string; apiKey: string; model: string; providerLabel: string },
): Promise<WordTimestamp[]> {
  return withRetry(
    async () => {
      // Use the native browser-style FormData + Blob (Node 18+) instead of
      // the `form-data` package piped into native fetch(). The previous
      // approach failed against Groq with "multipart: NextPart: EOF" because
      // form-data streams without a Content-Length, and Node's fetch doesn't
      // automatically serialize the multipart envelope from a third-party
      // form-data instance — Groq's parser hit EOF on the boundary.
      //
      // Reading the WAV into a Buffer is fine here: TTS stems are short (one
      // dialogue line ≈ 50 KB-2 MB). For long audio this would need streaming,
      // but the call site only passes per-line stems.
      const audioBuffer = await fs.promises.readFile(audioPath);
      const audioName = path.basename(audioPath);
      const ext = path.extname(audioName).slice(1).toLowerCase() || 'wav';
      const audioMimeType =
        ext === 'mp3' ? 'audio/mpeg'
        : ext === 'm4a' ? 'audio/mp4'
        : ext === 'flac' ? 'audio/flac'
        : 'audio/wav';

      const form = new FormData();
      form.append('file', new Blob([audioBuffer], { type: audioMimeType }), audioName);
      form.append('model', config.model);
      form.append('response_format', 'verbose_json');
      form.append('timestamp_granularities[]', 'word');

      // Do NOT manually set Content-Type — native fetch derives the
      // multipart boundary from the FormData and sets the right header.
      // Setting it manually would yield a stale boundary that doesn't
      // match the body's actual boundary.
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: form,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(
          `Whisper API (${config.providerLabel}) failed: ${response.status} - ${error}`,
        );
      }

      const data = (await response.json()) as { words?: WordTimestamp[] };

      const words: WordTimestamp[] = [];
      if (data.words) {
        for (const w of data.words) {
          words.push({ word: w.word, start: w.start, end: w.end });
        }
      }

      log.debug('Whisper API alignment complete', {
        provider: config.providerLabel,
        model: config.model,
        wordCount: words.length,
      });
      return words;
    },
    {
      maxRetries: 3,
      initialDelayMs: 1000,
      retryableStatuses: [429, 500, 502, 503, 504],
    },
  );
}

/**
 * Map word timestamps to punctuation positions
 * Uses fuzzy matching to handle transcription differences
 */
export function mapWordsToText(
  words: WordTimestamp[],
  text: string
): Array<WordTimestamp & { textWord: string }> {
  const textWords = text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);

  const wordTimestamps: Array<WordTimestamp & { textWord: string }> = [];
  let wordIdx = 0;

  for (const tw of textWords) {
    let bestMatch: (WordTimestamp & { textWord: string }) | null = null;
    let bestScore = 0;

    for (let i = wordIdx; i < Math.min(wordIdx + 5, words.length); i++) {
      const w = words[i];
      const score = similarity(tw, w.word.toLowerCase());

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { ...w, textWord: tw };
      }
    }

    if (bestMatch && bestScore > 0.6) {
      wordTimestamps.push(bestMatch);
      wordIdx++;
    }
  }

  return wordTimestamps;
}

/**
 * Simple string similarity score (Levenshtein-based)
 */
function similarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshtein(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshtein(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}
