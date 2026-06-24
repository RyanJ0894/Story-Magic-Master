/**
 * Character Index — deterministic character cue + dialogue boundary detection.
 *
 * This is Phase A of the sampling-architecture roadmap
 * (docs/ROADMAP-2026-06-24_sampling-architecture.md). It runs in shadow mode
 * for now — its output is logged but not wired into the live director path.
 *
 * The goal is to replace today's LLM-driven Pass 1 (CharacterExtractionAgent)
 * for properly-formatted screenplays. A standard screenplay announces every
 * speaker with a character-cue line directly above their dialogue, formatted
 * as all-caps, indented past action lines, optionally followed by extension
 * tags like (V.O.), (O.S.), (CONT'D), etc.
 *
 * Hard contract: this module NEVER modifies `scriptText`. It only computes
 * character offsets. The cross-project scene cache (PR #405) keys on byte
 * ranges of `scriptText`, so any normalization here would invalidate every
 * cache entry. Tests assert byte-identity of representative slices.
 *
 * For unconventional formatting (PDF artifacts, fountain with stripped
 * casing, treatments without slug lines), the detection confidence drops
 * below threshold and the caller should fall back to the existing LLM path.
 */

import { extractSceneInfo, type SceneInfo } from '../utils/script-chunker.js';

export interface CharacterAppearance {
  /** Canonical character name as written in the cue (uppercase, no extension). */
  name: string;
  /** 0-based scene index where this character first speaks. */
  firstSceneIdx: number;
  /** Absolute char offset of the first character cue line for this character. */
  firstCueOffset: number;
  /** Every scene index where this character speaks. */
  scenesAppearing: number[];
  /** Every character-cue offset in the script for this character. */
  cueOffsets: number[];
  /** Total number of cue lines (dialogue blocks) — a rough activity score. */
  lineCount: number;
}

export interface CharacterIndex {
  /** Map from canonical character name → appearance metadata. */
  characters: Map<string, CharacterAppearance>;
  /** Total cues across all characters — used in confidence math. */
  totalCueCount: number;
  /** Scene boundaries from `extractSceneInfo` for downstream reuse. */
  scenes: SceneInfo[];
  /**
   * Detection confidence in [0, 1]. Caller should fall back to LLM Pass 1
   * when this drops below a threshold (we use 0.5 as the default, tunable).
   * Computed from: cues-per-page density, scene-coverage rate,
   * format-conformance signals.
   */
  confidence: number;
  /** Short string explaining why confidence is what it is — for telemetry. */
  confidenceReason: string;
}

/**
 * Character cue line regex.
 *
 * Standard format: 4+ spaces of left indent, then ALL-CAPS NAME, optionally
 * followed by extension tags in parens, optionally followed by `*` or `#`
 * (revision markers), end of line.
 *
 * Accept:
 *   `    JOHN`
 *   `    JOHN (V.O.)`
 *   `    JOHN (CONT'D)`
 *   `    JOHN AND MARY`
 *   `         MARY-ANN`
 *   `    JOHN (filtered, into phone)`
 *   `JOHN` at column 0 — some PDFs strip leading whitespace; we accept if
 *      surrounding context confirms (preceding blank, following dialogue).
 *
 * Reject:
 *   action lines (mixed case)
 *   scene headings (start with INT/EXT/etc — handled separately)
 *   `JOHN smiled.` (followed by lowercase — clearly action)
 *
 * The regex matches CANDIDATE cue lines; further state-machine filtering
 * (below) rejects false positives.
 */
const CHARACTER_CUE_RE =
  /^[ \t]{0,40}([A-Z][A-Z0-9 .'\-]{0,40}[A-Z0-9.'])(?:\s*\([^)]{1,80}\))?\s*[*#]?\s*$/;

/**
 * Words that look like ALL-CAPS character names but aren't.
 * Scene headings, common transitions, sound cues, and parentheticals
 * that escape onto their own line.
 */
const CUE_BLOCKLIST = new Set<string>([
  'INT.', 'EXT.', 'INT', 'EXT',
  'FADE IN:', 'FADE IN', 'FADE OUT', 'FADE OUT.', 'FADE TO BLACK',
  'CUT TO:', 'CUT TO', 'SMASH CUT', 'SMASH CUT TO', 'SMASH CUT TO:',
  'DISSOLVE TO:', 'DISSOLVE TO', 'WIPE TO:', 'MATCH CUT',
  'BACK TO SCENE', 'BACK TO:', 'CONTINUED:', 'CONTINUED',
  'THE END', 'END', 'OMITTED', 'BLACK', 'TITLE', 'TITLES',
  'SUPER:', 'INTERCUT', 'INTERCUT:', 'MONTAGE', 'MONTAGE:', 'END MONTAGE',
  'FLASHBACK', 'END FLASHBACK', 'PRESENT DAY', 'LATER', 'CONTINUOUS',
]);

function isPlausibleCharacterName(raw: string): boolean {
  const trimmed = raw.trim().replace(/[*#]+$/, '').trim();
  if (trimmed.length < 2 || trimmed.length > 40) return false;
  if (CUE_BLOCKLIST.has(trimmed)) return false;
  // Reject if it ends with a colon — that's a transition or label.
  if (trimmed.endsWith(':')) return false;
  // Reject if it has too many words (5+) — character names are short.
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 4) return false;
  // Reject pure numerics.
  if (/^[\d.]+$/.test(trimmed)) return false;
  return true;
}

/**
 * Strip extension tags (V.O., O.S., CONT'D, etc.) to get the canonical name.
 * Used for grouping cue offsets under one CharacterAppearance entry.
 */
function canonicalizeName(raw: string): string {
  // Take everything before the first parenthesis.
  const paren = raw.indexOf('(');
  const base = paren === -1 ? raw : raw.slice(0, paren);
  return base.trim().replace(/[*#]+$/, '').trim().toUpperCase();
}

/**
 * Find the scene index that contains a given character offset.
 * Returns -1 if the offset is before the first scene heading.
 */
function findSceneIdxForOffset(scenes: SceneInfo[], offset: number): number {
  // Binary search would be nicer; linear is fine — scene counts are small.
  for (let i = scenes.length - 1; i >= 0; i--) {
    if (offset >= scenes[i].start_index) return i;
  }
  return -1;
}

/**
 * Build a deterministic CharacterIndex from a script.
 *
 * Walks every line, applies the character-cue regex, filters against
 * known-non-character patterns, then groups by canonical name and computes
 * scene-level coverage + a confidence score.
 *
 * The script text is read but never written or normalized — all output is
 * offsets into the original string.
 */
export function buildCharacterIndex(scriptText: string): CharacterIndex {
  const scenes = extractSceneInfo(scriptText);
  const cueHits: Array<{ name: string; offset: number; sceneIdx: number }> = [];

  // Walk lines while tracking absolute offsets so we never lose byte
  // positions to slicing.
  let lineStart = 0;
  const lines = scriptText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineEnd = lineStart + line.length;
    const match = line.match(CHARACTER_CUE_RE);
    if (match) {
      const candidate = match[1];
      if (isPlausibleCharacterName(candidate)) {
        // Additional filter: the line BEFORE a cue is typically blank or
        // an action line ending in a period. The line AFTER a cue is
        // dialogue or a parenthetical. We require at least one of those
        // post-conditions so action lines accidentally all-caps don't
        // become false-positive cues.
        const nextLine = lines[i + 1] ?? '';
        const looksLikeDialogueFollows =
          nextLine.trim().length > 0 &&
          // Pure parenthetical OR dialogue text (non-cue, non-slug)
          (nextLine.trim().startsWith('(') ||
            // Dialogue tends to be indented less than action, but more
            // than column 0. Accept anything that isn't a slug or another
            // cue.
            !CHARACTER_CUE_RE.test(nextLine) &&
              !/^[ \t]*(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/.test(nextLine));
        if (looksLikeDialogueFollows) {
          cueHits.push({
            name: canonicalizeName(candidate),
            offset: lineStart,
            sceneIdx: findSceneIdxForOffset(scenes, lineStart),
          });
        }
      }
    }
    lineStart = lineEnd + 1; // +1 for the '\n' we split on
  }

  // Group by canonical name into CharacterAppearance entries.
  const characters = new Map<string, CharacterAppearance>();
  for (const hit of cueHits) {
    let entry = characters.get(hit.name);
    if (!entry) {
      entry = {
        name: hit.name,
        firstSceneIdx: hit.sceneIdx === -1 ? 0 : hit.sceneIdx,
        firstCueOffset: hit.offset,
        scenesAppearing: [],
        cueOffsets: [],
        lineCount: 0,
      };
      characters.set(hit.name, entry);
    }
    entry.cueOffsets.push(hit.offset);
    entry.lineCount += 1;
    if (hit.sceneIdx !== -1 && !entry.scenesAppearing.includes(hit.sceneIdx)) {
      entry.scenesAppearing.push(hit.sceneIdx);
    }
  }

  // Compute confidence. Signals:
  //  - cues per estimated page: real screenplays have 5–30 cues/page
  //  - characters per scene: real screenplays average 2–6
  //  - presence of any scenes at all: zero scenes → almost certainly a
  //    treatment or unformatted prose
  const estimatedPages = Math.max(1, Math.ceil(scriptText.length / 2_200));
  const cuesPerPage = cueHits.length / estimatedPages;
  const charsPerPage =
    scenes.length > 0
      ? characters.size / Math.max(1, scenes.length)
      : 0;

  let confidence = 0;
  const reasons: string[] = [];

  if (scenes.length === 0) {
    confidence = 0;
    reasons.push('no_scene_headings');
  } else if (cueHits.length === 0) {
    confidence = 0;
    reasons.push('no_cues_found');
  } else {
    // Cues-per-page: peaks around the 5–30 range.
    if (cuesPerPage >= 3) {
      confidence += 0.5;
      reasons.push(`cues_per_page=${cuesPerPage.toFixed(1)}`);
    } else {
      reasons.push(`low_cues_per_page=${cuesPerPage.toFixed(1)}`);
    }
    // Character count: at least 2 characters for any real script.
    if (characters.size >= 2) {
      confidence += 0.3;
      reasons.push(`characters=${characters.size}`);
    } else {
      reasons.push(`too_few_characters=${characters.size}`);
    }
    // Scene coverage: do detected characters appear across multiple scenes?
    const charsWithMultipleScenes = Array.from(characters.values()).filter(
      (c) => c.scenesAppearing.length >= 2,
    ).length;
    if (charsWithMultipleScenes >= 1) {
      confidence += 0.2;
      reasons.push(`multi_scene_chars=${charsWithMultipleScenes}`);
    }
  }

  return {
    characters,
    totalCueCount: cueHits.length,
    scenes,
    confidence: Math.min(1, confidence),
    confidenceReason: reasons.join(','),
  };
}

/**
 * Threshold below which the caller should fall back to LLM Pass 1.
 * Tunable; the roadmap's Phase A telemetry will tell us the right number.
 */
export const CHARACTER_INDEX_CONFIDENCE_THRESHOLD = 0.5;

export function shouldFallbackToLlmExtraction(index: CharacterIndex): boolean {
  return index.confidence < CHARACTER_INDEX_CONFIDENCE_THRESHOLD;
}
