/**
 * Long-Script Chunking for StoryScore
 *
 * For scripts over CHUNK_THRESHOLD characters, extract representative sections
 * proportionally from Act 1, Act 2, and Act 3 to preserve structural signals
 * while staying within practical LLM prompt budgets.
 *
 * Standard screenplay structure:
 *   Act 1 — pages 1–25  (~25%)
 *   Act 2 — pages 26–75 (~50%)
 *   Act 3 — pages 76–120 (~25%)
 *
 * Each section is extracted from the structural midpoint of its act so the LLM
 * sees opening image, midpoint, and climax — the beats most diagnostic for scoring.
 */

// =============================================================================
// Constants
// =============================================================================

/**
 * Scripts longer than this are chunked before scoring (chars, ~80 pages).
 * Below this threshold the full text is used — Claude 200K context handles it.
 */
export const CHUNK_THRESHOLD = 80_000;

/**
 * Target size of each extracted section (chars, ~15 pages each).
 */
export const SECTION_SIZE = 15_000;

// =============================================================================
// Types
// =============================================================================

export interface ChunkedScript {
  /** Text sent to the LLM — either the full script or the chunked excerpt */
  text: string;
  /** True if the script was chunked (i.e., was over the threshold) */
  wasChunked: boolean;
  /** Original character count */
  originalLength: number;
  /** Character count after chunking (same as originalLength if not chunked) */
  chunkedLength: number;
  /** Human-readable note appended to help the LLM interpret the excerpt */
  note: string | null;
}

// =============================================================================
// Core function
// =============================================================================

/**
 * Prepare script text for scoring. Returns full text for short scripts.
 * For long scripts, extracts proportional Act 1 / Act 2 / Act 3 samples and
 * wraps them in context annotations the LLM can use.
 *
 * @param scriptText - Raw screenplay text
 * @param options    - Optional overrides for threshold and section size
 */
export function chunkScriptForScoring(
  scriptText: string,
  options: { threshold?: number; sectionSize?: number } = {}
): ChunkedScript {
  const threshold = options.threshold ?? CHUNK_THRESHOLD;
  const sectionSize = options.sectionSize ?? SECTION_SIZE;

  if (scriptText.length <= threshold) {
    return {
      text: scriptText,
      wasChunked: false,
      originalLength: scriptText.length,
      chunkedLength: scriptText.length,
      note: null,
    };
  }

  const len = scriptText.length;

  // Act boundaries (approximate page proportions)
  const act1End = Math.floor(len * 0.25);
  const act2Mid = Math.floor(len * 0.50);
  const act3Start = Math.floor(len * 0.75);

  // Extract a window around the midpoint of each section,
  // snapping to the nearest newline to avoid cutting mid-sentence.
  const act1 = snapToNewline(scriptText, act1End - Math.floor(sectionSize / 2), sectionSize);
  const act2 = snapToNewline(scriptText, act2Mid - Math.floor(sectionSize / 2), sectionSize);
  const act3 = snapToNewline(scriptText, act3Start - Math.floor(sectionSize / 2), sectionSize);

  const note =
    `[SCORING NOTE: This is a ${estimatePages(len)}-page screenplay. ` +
    `The excerpt below shows representative samples from Act 1 (~pages ${estimatePageRange(0, act1End, len)}), ` +
    `Act 2 midpoint (~pages ${estimatePageRange(act1End, act3Start, len)}), ` +
    `and Act 3 (~pages ${estimatePageRange(act3Start, len, len)}). ` +
    `Score based on these samples as a proxy for the full script.]`;

  const chunkedText =
    `${note}\n\n` +
    `===== ACT 1 SAMPLE =====\n${act1}\n\n` +
    `===== ACT 2 MIDPOINT SAMPLE =====\n${act2}\n\n` +
    `===== ACT 3 SAMPLE =====\n${act3}`;

  return {
    text: chunkedText,
    wasChunked: true,
    originalLength: len,
    chunkedLength: chunkedText.length,
    note,
  };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Extract `size` chars starting at `start`, snapping both boundaries to
 * the nearest newline to avoid mid-sentence cuts.
 */
export function snapToNewline(text: string, start: number, size: number): string {
  const clampedStart = Math.max(0, Math.min(start, text.length));
  const clampedEnd = Math.min(text.length, clampedStart + size);

  // Snap start to next newline
  const newlineStart = text.indexOf('\n', clampedStart);
  const snapStart = newlineStart !== -1 && newlineStart < clampedEnd ? newlineStart + 1 : clampedStart;

  // Snap end to previous newline
  const newlineEnd = text.lastIndexOf('\n', clampedEnd);
  const snapEnd = newlineEnd > snapStart ? newlineEnd : clampedEnd;

  return text.slice(snapStart, snapEnd).trim();
}

/**
 * Estimate page count from character count (~1000 chars/page in screenplay format).
 */
export function estimatePages(charCount: number): number {
  return Math.round(charCount / 1000);
}

function estimatePageRange(fromChar: number, toChar: number, totalChars: number): string {
  const totalPages = estimatePages(totalChars);
  const from = Math.max(1, Math.round((fromChar / totalChars) * totalPages));
  const to = Math.min(totalPages, Math.round((toChar / totalChars) * totalPages));
  return `${from}–${to}`;
}
