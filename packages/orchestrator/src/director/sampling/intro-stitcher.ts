/**
 * Intro Stitcher — builds a compact, deduplicated text sample covering every
 * character's first N pages of dialogue context.
 *
 * Phase A of the sampling-architecture roadmap. Output is consumed in Phase B
 * by VoiceAssignmentAgent (sample-driven mode); for now it runs in shadow
 * mode for telemetry only.
 *
 * Algorithm:
 *   1. For each character in the CharacterIndex, compute their intro span:
 *      [first_cue_offset, first_cue_offset + INTRO_CONTEXT_CHARS]
 *   2. Interval-merge the spans so two characters introduced on the same
 *      page produce one slice, not two overlapping ones.
 *   3. Concatenate the deduplicated slices in script order, with separators
 *      so the LLM understands the boundaries.
 *
 * Hard contract (same as character-index.ts): the source `scriptText` is
 * never modified. Every byte of the stitched output is a copy from a
 * specific [start, end] range of the original. PR #405's cache hashes
 * scene text by byte range; if we normalized whitespace here, the hashes
 * would shift and break cache hits.
 */

import type { CharacterIndex } from './character-index.js';

/** Standard 1-page character count for screenplays. Used by sampler heuristics. */
const PAGE_CHARS = 2_200;

/** Default intro window — 2 pages worth of context per character. */
const DEFAULT_INTRO_PAGES = 2;

export interface PageSlice {
  /** Inclusive byte offset of the slice start in the original script. */
  start: number;
  /** Exclusive byte offset of the slice end. */
  end: number;
  /** Canonical character names introduced or first-visible within this slice. */
  characters: string[];
}

export interface StitchedSample {
  /**
   * The stitched text. Each slice is preceded by a separator comment
   * containing its character offsets so the LLM can refer back to absolute
   * positions if needed.
   */
  text: string;
  /** The deduplicated slices, in script order. */
  slices: PageSlice[];
  /** Total characters in the original script — for cost-savings telemetry. */
  originalChars: number;
  /** Total characters in the stitched output. */
  stitchedChars: number;
  /** Every canonical character name covered. */
  charactersCovered: string[];
  /** Characters present in the index but with no dialogue space sampled. */
  charactersMissing: string[];
}

export interface StitchOptions {
  /** How many pages of context to include per character. Default 2. */
  introPagesPerCharacter?: number;
  /** Hard ceiling on the stitched output. Defaults to no ceiling. */
  maxStitchedChars?: number;
}

/**
 * Merge overlapping/adjacent intervals. Standard sweep-line.
 *
 * Two intervals merge when `b.start <= a.end` — i.e. they overlap or
 * touch. Touching is included on purpose: two characters whose intro
 * windows abut should share one slice rather than producing back-to-back
 * fragments that double the separator overhead.
 */
function mergeIntervals(
  intervals: Array<{ start: number; end: number; chars: Set<string> }>,
): Array<{ start: number; end: number; chars: Set<string> }> {
  if (intervals.length === 0) return [];
  const sorted = intervals.slice().sort((a, b) => a.start - b.start);
  const out: Array<{ start: number; end: number; chars: Set<string> }> = [
    { ...sorted[0], chars: new Set(sorted[0].chars) },
  ];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const cur = sorted[i];
    if (cur.start <= last.end) {
      // Overlap or touch — merge into `last`.
      last.end = Math.max(last.end, cur.end);
      for (const c of cur.chars) last.chars.add(c);
    } else {
      out.push({ ...cur, chars: new Set(cur.chars) });
    }
  }
  return out;
}

/**
 * Build a StitchedSample from the script + CharacterIndex.
 *
 * The output text format includes lightweight separators so the LLM in
 * Phase B can interpret what it's reading. Format chosen to be human-
 * readable in logs but unambiguous to the LLM:
 *
 *   ── INTRO @ chars 1234-5678 — characters: JOHN, MARY ──
 *   <script slice copied verbatim>
 *
 *   ── INTRO @ chars 9012-12345 — characters: BEN ──
 *   <next slice>
 */
export function stitchIntroSample(
  scriptText: string,
  index: CharacterIndex,
  options: StitchOptions = {},
): StitchedSample {
  const introPages = options.introPagesPerCharacter ?? DEFAULT_INTRO_PAGES;
  const introWindowChars = introPages * PAGE_CHARS;
  const maxChars = options.maxStitchedChars ?? Number.MAX_SAFE_INTEGER;

  // 1. Build raw intervals — one per character, anchored at their first cue.
  const raw: Array<{ start: number; end: number; chars: Set<string> }> = [];
  const missing: string[] = [];
  for (const [name, appearance] of index.characters) {
    if (
      appearance.firstCueOffset < 0 ||
      appearance.firstCueOffset >= scriptText.length
    ) {
      missing.push(name);
      continue;
    }
    raw.push({
      start: appearance.firstCueOffset,
      end: Math.min(
        scriptText.length,
        appearance.firstCueOffset + introWindowChars,
      ),
      chars: new Set([name]),
    });
  }

  // 2. Merge.
  const merged = mergeIntervals(raw);

  // 3. Build PageSlice array + stitch text.
  const slices: PageSlice[] = [];
  const parts: string[] = [];
  let stitchedChars = 0;
  const covered = new Set<string>();
  for (const m of merged) {
    const charsList = Array.from(m.chars).sort();
    const slice: PageSlice = { start: m.start, end: m.end, characters: charsList };
    const separator = `── INTRO @ chars ${m.start}-${m.end} — characters: ${charsList.join(', ')} ──\n`;
    // scriptText.slice — pure copy, no normalization. This is the
    // cache-hash compatibility invariant.
    const body = scriptText.slice(m.start, m.end);
    const piece = separator + body + '\n\n';
    if (stitchedChars + piece.length > maxChars) {
      // Hit the ceiling. Truncate this slice and stop.
      const remaining = maxChars - stitchedChars - separator.length - 2;
      if (remaining > 0) {
        parts.push(separator + body.slice(0, remaining) + '\n\n');
        stitchedChars += separator.length + remaining + 2;
        slice.end = m.start + remaining;
        slices.push(slice);
        for (const c of charsList) covered.add(c);
      }
      break;
    }
    parts.push(piece);
    stitchedChars += piece.length;
    slices.push(slice);
    for (const c of charsList) covered.add(c);
  }

  // 4. Characters that exist in the index but weren't included in any
  // slice (because their introWindow was empty or off the end of the
  // script).
  for (const name of index.characters.keys()) {
    if (!covered.has(name) && !missing.includes(name)) missing.push(name);
  }

  return {
    text: parts.join(''),
    slices,
    originalChars: scriptText.length,
    stitchedChars,
    charactersCovered: Array.from(covered).sort(),
    charactersMissing: missing,
  };
}
