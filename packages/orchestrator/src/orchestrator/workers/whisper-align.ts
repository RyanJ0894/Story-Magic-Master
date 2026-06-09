/**
 * Whisper ASR Worker - Word-level alignment using Whisper
 */

import { execa } from 'execa';
import fs from 'fs';
import FormData from 'form-data';
import { withRetry } from '../../lib/retry.js';
import { log } from '../../lib/logger.js';

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

  const whisperCppPath = process.env.WHISPER_CPP_PATH || 'whisper';
  const modelPath = process.env.WHISPER_MODEL_PATH || 'models/ggml-base.en.bin';

  // Create a specific path for the JSON output file
  const outputBase = audioPath.replace(/\.[^/.]+$/, '');
  const jsonOutputPath = `${outputBase}.json`;

  try {
    if (whisperCppPath !== 'whisper' && !fs.existsSync(whisperCppPath)) {
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
    // Fallback chain (Tier 2 of #186 PR F):
    //   1. Groq Whisper (default ON if GROQ_API_KEY set) — ~12x cheaper than
    //      OpenAI Whisper for the same whisper-large-v3 model. Disable with
    //      ENABLE_GROQ_WHISPER_FALLBACK=false.
    //   2. OpenAI Whisper (default OFF — opt in via ENABLE_OPENAI_WHISPER_FALLBACK=true).
    //   3. Duration-based estimator (free, lower quality).
    //
    // Both API paths transcribe via OpenAI-compatible `/audio/transcriptions`,
    // so they share `transcribeViaApi`.
    const errMsg = (err as Error).message;

    const groqEnabled = process.env.ENABLE_GROQ_WHISPER_FALLBACK !== 'false';
    if (groqEnabled && process.env.GROQ_API_KEY) {
      log.warn('whisper.cpp failed; falling back to Groq Whisper (cheap)', { error: errMsg });
      try {
        return await transcribeViaApi(audioPath, {
          url: 'https://api.groq.com/openai/v1/audio/transcriptions',
          apiKey: process.env.GROQ_API_KEY,
          model: process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3',
          providerLabel: 'groq',
        });
      } catch (groqErr) {
        log.warn('Groq Whisper failed; trying next fallback', {
          error: (groqErr as Error).message,
        });
      }
    }

    const openaiEnabled = process.env.ENABLE_OPENAI_WHISPER_FALLBACK === 'true';
    if (openaiEnabled && process.env.OPENAI_API_KEY) {
      log.warn('falling back to OpenAI Whisper API (billed)', { error: errMsg });
      return await transcribeViaApi(audioPath, {
        url: 'https://api.openai.com/v1/audio/transcriptions',
        apiKey: process.env.OPENAI_API_KEY,
        model: 'whisper-1',
        providerLabel: 'openai',
      });
    }

    log.warn('whisper.cpp + API fallbacks unavailable; using duration-based estimator', {
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
      const form = new FormData();

      form.append('file', fs.createReadStream(audioPath));
      form.append('model', config.model);
      form.append('response_format', 'verbose_json');
      form.append('timestamp_granularities[]', 'word');

      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          ...form.getHeaders(),
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: form as any,
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
