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
    // Cost note: OpenAI's Whisper API is billed per-second of audio and is
    // expensive at scale. Default behavior is to fall through to the duration-
    // based estimator (no extra cost) when whisper.cpp is unavailable. Opt in
    // explicitly via ENABLE_OPENAI_WHISPER_FALLBACK=true if you need the
    // higher-quality alignment in production.
    const fallbackEnabled = process.env.ENABLE_OPENAI_WHISPER_FALLBACK === 'true';

    if (fallbackEnabled && process.env.OPENAI_API_KEY) {
      log.warn('whisper.cpp failed; falling back to OpenAI Whisper API (billed)', {
        error: (err as Error).message,
      });
      return await whisperAPIAlign(audioPath, expectedText);
    }

    log.warn('whisper.cpp failed; using duration-based estimator (no OpenAI cost)', {
      error: (err as Error).message,
      hint: 'Set ENABLE_OPENAI_WHISPER_FALLBACK=true to opt into the paid OpenAI Whisper API fallback.',
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
 * Use OpenAI Whisper API for word-level timestamps
 */
async function whisperAPIAlign(
  audioPath: string,
  expectedText: string
): Promise<WordTimestamp[]> {
  const apiKey = process.env.OPENAI_API_KEY;

  return withRetry(
    async () => {
      const form = new FormData();

      form.append('file', fs.createReadStream(audioPath));
      form.append('model', 'whisper-1');
      form.append('response_format', 'verbose_json');
      form.append('timestamp_granularities[]', 'word');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...form.getHeaders(),
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: form as any,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Whisper API failed: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as { words?: WordTimestamp[] };

      const words: WordTimestamp[] = [];
      if (data.words) {
        for (const w of data.words) {
          words.push({
            word: w.word,
            start: w.start,
            end: w.end,
          });
        }
      }

      log.debug('Whisper API alignment complete', { wordCount: words.length });
      return words;
    },
    {
      maxRetries: 3,
      initialDelayMs: 1000,
      retryableStatuses: [429, 500, 502, 503, 504],
    }
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
