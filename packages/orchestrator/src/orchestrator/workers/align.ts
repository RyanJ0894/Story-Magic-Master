/**
 * Align Worker - Computes dialogue alignment with context-aware pacing
 */

import { audioDurationSec } from '../../lib/audio.js';
import { whisperAlign, mapWordsToText, type WordTimestamp } from './whisper-align.js';
import { prisma } from '../../lib/prisma.js';
import { log } from '../../lib/logger.js';
import type { Scene, DialogueLine } from '../../schemas/director-json.js';
import type { StemResult } from './tts.js';

export interface LineAlignment {
  line_id: string;
  start: number;
  end: number;
  words?: Array<{ w: string; s: number; e: number }>;
}

export interface SceneAlignment {
  scene_id: string;
  lines: LineAlignment[];
}

/**
 * Context-aware gap computation
 * Adjusts gaps based on punctuation, character changes, and intensity
 */
const strong = (s: string): boolean => /[.!?]"?$/.test(s.trim());
const comma = (s: string): boolean => /[,:;]"?$/.test(s.trim());

export function computeGap(
  current: DialogueLine,
  next: DialogueLine | undefined,
  intensity: number = 0.5
): number {
  let base = 0.3;

  if (strong(current.text)) base = 0.6;
  else if (comma(current.text)) base = 0.4;

  if (next && current.character !== next.character) base += 0.4;

  base *= 1.2 - (intensity || 0.5) * 0.4;

  return Math.max(0.15, Math.min(1.5, base));
}

/**
 * Align scene dialogue with context-aware pacing
 * Uses Whisper ASR if available, falls back to duration-based
 */
export async function alignScene(
  project_id: string,
  scene: Scene,
  stems: StemResult[],
  providerAlignment?: SceneAlignment
): Promise<SceneAlignment> {
  // If provider already gave us alignment, use it
  if (providerAlignment?.lines?.length) {
    const lines = providerAlignment.lines.slice().sort((a, b) => a.start - b.start);

    // Save to database
    await saveAlignment(project_id, scene.scene_id, { scene_id: scene.scene_id, lines });

    return { scene_id: scene.scene_id, lines };
  }

  const lines: LineAlignment[] = [];
  let cursor = 0;

  for (let i = 0; i < scene.dialogue.length; i++) {
    const curr = scene.dialogue[i];
    const next = scene.dialogue[i + 1];
    const stem = stems.find((s) => s.line_id === curr.line_id);

    if (!stem) throw new Error(`Missing stem for line ${curr.line_id}`);

    const dur = await audioDurationSec(stem.path);
    const start = cursor;
    const end = start + dur;

    // Try to get word-level timestamps from Whisper
    let words: Array<{ w: string; s: number; e: number }> | undefined;
    try {
      const whisperWords = await whisperAlign(stem.path, curr.text);
      if (whisperWords && whisperWords.length > 0) {
        // Offset word timestamps by line start time
        words = whisperWords.map((w) => ({
          w: w.word,
          s: start + w.start,
          e: start + w.end,
        }));
      }
    } catch (err) {
      log.warn('Whisper alignment failed for line, using duration fallback', {
        lineId: curr.line_id,
      });
    }

    const lineAlignment: LineAlignment = {
      line_id: curr.line_id,
      start,
      end,
    };
    if (words) {
      lineAlignment.words = words;
    }
    lines.push(lineAlignment);

    cursor = end + computeGap(curr, next, scene.intensity ?? 0.5);
  }

  const alignment: SceneAlignment = { scene_id: scene.scene_id, lines };

  // Save to database
  await saveAlignment(project_id, scene.scene_id, alignment);

  return alignment;
}

/**
 * Save alignment to database via Prisma raw SQL
 */
async function saveAlignment(
  project_id: string,
  scene_id: string,
  alignment: SceneAlignment
): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO alignments (project_id, scene_id, alignment_json, created_at)
      VALUES (${project_id}, ${scene_id}, ${JSON.stringify(alignment)}::jsonb, NOW())
      ON CONFLICT (project_id, scene_id)
      DO UPDATE SET alignment_json = ${JSON.stringify(alignment)}::jsonb, created_at = NOW()
    `;
  } catch (err) {
    log.error('Failed to save alignment to DB', err instanceof Error ? err : undefined, {
      project_id, scene_id,
    });
  }
}
