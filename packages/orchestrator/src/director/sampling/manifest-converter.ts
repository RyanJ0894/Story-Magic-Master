/**
 * CharacterIndex → CharacterManifest converter — Phase C.
 *
 * Phase A's `buildCharacterIndex` finds every character cue in a screenplay
 * deterministically. Phase B's sample-driven voice assignment reads actual
 * dialogue rather than abstract descriptions. Together, those two pieces
 * mean the LLM's Pass 1 "extract characters and describe them" call is no
 * longer load-bearing — the descriptions it produces don't get used by
 * Pass 2 anymore.
 *
 * This converter is what makes Phase C — "skip LLM Pass 1 entirely" —
 * possible. It produces a CharacterManifest from a CharacterIndex with
 * best-effort heuristics for the fields Pass 1 used to fill in:
 *
 *   - name / canonical_name: directly from the index (already uppercase)
 *   - is_narrator: heuristic — name === "NARRATOR" or matches a narrator
 *     synonym list. The narrator detection is a hard requirement; mis-
 *     tagging means the narrator gets a character voice.
 *   - gender: left undefined. Phase B reads dialogue so the LLM picks
 *     voices from speech patterns, not from a possibly-wrong gender hint.
 *   - description: a one-line summary including line count and scene
 *     count, so any downstream consumer that still touches description
 *     gets *something* informative rather than a blank string.
 *   - aliases / age / sample_dialogue: left undefined — Phase B's
 *     dialogue sample provides all of these to the voice picker.
 *
 * Used by:
 *   - Phase C `DIRECTOR_CHARACTER_EXTRACTION_MODE=regex` in director-agent.ts
 *   - Phase C `hybrid` mode for side-by-side comparison logging
 */

import type { CharacterIndex } from './character-index.js';
import type { CharacterManifest, CharacterEntry } from '../../schemas/character-manifest.js';

/**
 * Names that mean "the narrator" in screenplay convention. If a cue
 * matches any of these (case-insensitive), the resulting CharacterEntry
 * gets `is_narrator: true`. This is conservative on purpose — false
 * positives here mean a character gets the narrator default voice,
 * which is much worse than a missed narrator that gets a character voice.
 */
const NARRATOR_SYNONYMS = new Set<string>([
  'NARRATOR',
  'NARR',
  'NARR.',
  'V.O.', // unattributed V.O.
  'VOICE OVER',
  'VOICEOVER',
  'STORYTELLER',
]);

function isLikelyNarrator(name: string): boolean {
  const upper = name.trim().toUpperCase();
  return NARRATOR_SYNONYMS.has(upper);
}

function summarizeCharacter(
  name: string,
  lineCount: number,
  sceneCount: number,
): string {
  // Brief, factual one-liner. Voice picker (Phase B) reads dialogue
  // directly so it doesn't depend on this. Kept for any downstream
  // consumer that reads CharacterEntry.description.
  return `${name} — ${lineCount} dialogue lines across ${sceneCount} scene(s).`;
}

/**
 * Build a CharacterManifest from a CharacterIndex.
 *
 * Deterministic; no LLM calls. Loses the descriptive richness Pass 1
 * used to provide, but Phase B's sample-driven voice assignment doesn't
 * need that richness — it reads dialogue directly.
 */
export function characterIndexToManifest(
  projectId: string,
  index: CharacterIndex,
): CharacterManifest {
  const characters: CharacterEntry[] = [];
  for (const [name, appearance] of index.characters) {
    characters.push({
      name,
      canonical_name: name,
      aliases: [],
      description: summarizeCharacter(
        name,
        appearance.lineCount,
        appearance.scenesAppearing.length,
      ),
      is_narrator: isLikelyNarrator(name),
    });
  }
  return {
    project_id: projectId,
    characters,
  };
}

/**
 * Compare a regex-derived CharacterManifest to an LLM-derived one.
 * Returns a diff snapshot suitable for logging in hybrid mode.
 *
 * This is the data-collection side of the Phase C roll-out: 2 weeks of
 * `hybrid` mode telemetry on dev tells us whether discrepancy rate is
 * low enough to flip the default to `regex`.
 */
export interface ManifestComparison {
  /** Number of canonical names that appear in both manifests. */
  intersectionCount: number;
  /** Names only in the regex (Phase 0) manifest. */
  onlyInRegex: string[];
  /** Names only in the LLM (Pass 1) manifest. */
  onlyInLlm: string[];
  /**
   * Jaccard similarity of the two name sets. 1.0 = identical, 0.0 = disjoint.
   * Caller logs this as the headline metric.
   */
  jaccard: number;
  /** Total in regex manifest. */
  regexCount: number;
  /** Total in LLM manifest. */
  llmCount: number;
}

export function compareManifests(
  regex: CharacterManifest,
  llm: CharacterManifest,
): ManifestComparison {
  const regexNames = new Set(regex.characters.map((c) => c.canonical_name.toUpperCase()));
  const llmNames = new Set(llm.characters.map((c) => c.canonical_name.toUpperCase()));
  const intersection = new Set<string>();
  for (const n of regexNames) if (llmNames.has(n)) intersection.add(n);
  const onlyInRegex = Array.from(regexNames).filter((n) => !llmNames.has(n)).sort();
  const onlyInLlm = Array.from(llmNames).filter((n) => !regexNames.has(n)).sort();
  const union = new Set<string>([...regexNames, ...llmNames]);
  const jaccard = union.size === 0 ? 1 : intersection.size / union.size;
  return {
    intersectionCount: intersection.size,
    onlyInRegex,
    onlyInLlm,
    jaccard,
    regexCount: regexNames.size,
    llmCount: llmNames.size,
  };
}
