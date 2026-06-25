/**
 * Cue pre-tagger for Pass 3 — Phase D-2.
 *
 * SceneConstructionAgent today reads raw screenplay chunks and re-detects
 * character cue lines while producing structured output. That's redundant
 * with Phase A's deterministic CharacterIndex, which already knows every
 * cue offset.
 *
 * This tagger takes a chunk text + the corresponding CharacterIndex
 * (intersection with the chunk's byte range) and produces a tagged
 * version of the chunk with `[SPEAKER: NAME]` annotations inserted
 * directly above each cue's dialogue. Pass 3's tightened prompt tells
 * the LLM to treat the annotation as the source of truth for the
 * speaker attribution, so it doesn't have to parse the cue line at all.
 *
 * Effect at the LLM level:
 *
 *   - Speaker attribution becomes deterministic (no model errors)
 *   - The model focuses its capacity on dialogue cleanup / mood /
 *     intensity / line splitting, not on cue detection
 *   - Output is shorter because the LLM no longer has to "find" the
 *     character — savings of ~5–10 % per chunk
 *
 * Important rules:
 *
 *   - We INSERT text into the chunk; we never modify existing characters.
 *     This is fine because the chunk text is a Pass 3 input only — the
 *     director_scene_cache (#405) keys on per-scene byte ranges of the
 *     ORIGINAL scriptText, not on chunk-input text.
 *   - The `[SPEAKER: NAME]` annotation format is unambiguous and unlikely
 *     to appear in real screenplays. Pass 3's prompt explicitly tells
 *     the model not to emit it in dialogue text.
 */

import type { CharacterIndex, CharacterAppearance } from './character-index.js';

/**
 * Insert `[SPEAKER: NAME]` annotations above each character cue line
 * that falls within the chunk's byte range.
 *
 * The chunk text is treated as a slice of the original script, anchored
 * at `chunkStartOffset`. We walk the CharacterIndex.cueOffsets and
 * insert annotations for the cues that land inside the chunk window.
 */
export function tagChunkWithCues(
  chunkText: string,
  chunkStartOffset: number,
  index: CharacterIndex,
): { taggedText: string; tagCount: number } {
  const chunkEnd = chunkStartOffset + chunkText.length;

  // Collect cue insertions: (offsetInChunk, characterName).
  // We insert BEFORE the cue line so the LLM reads "[SPEAKER: NAME]\n    NAME\n    dialogue".
  const insertions: Array<{ offsetInChunk: number; name: string }> = [];
  for (const [name, appearance] of index.characters) {
    for (const cueOffsetAbs of appearance.cueOffsets) {
      if (cueOffsetAbs >= chunkStartOffset && cueOffsetAbs < chunkEnd) {
        insertions.push({
          offsetInChunk: cueOffsetAbs - chunkStartOffset,
          name,
        });
      }
    }
  }

  if (insertions.length === 0) {
    return { taggedText: chunkText, tagCount: 0 };
  }

  // Sort by offset descending so we can splice without shifting earlier
  // offsets. (Standard trick for multi-position string mutation.)
  insertions.sort((a, b) => b.offsetInChunk - a.offsetInChunk);

  let result = chunkText;
  for (const ins of insertions) {
    const annotation = `[SPEAKER: ${ins.name}]\n`;
    result = result.slice(0, ins.offsetInChunk) + annotation + result.slice(ins.offsetInChunk);
  }

  return { taggedText: result, tagCount: insertions.length };
}

/**
 * Subset a CharacterIndex to only the appearances within a byte range.
 * Useful when the agent only wants to consider cues inside a specific chunk.
 */
export function filterIndexToRange(
  index: CharacterIndex,
  startOffset: number,
  endOffset: number,
): Map<string, CharacterAppearance> {
  const out = new Map<string, CharacterAppearance>();
  for (const [name, appearance] of index.characters) {
    const cuesInRange = appearance.cueOffsets.filter(
      (o) => o >= startOffset && o < endOffset,
    );
    if (cuesInRange.length === 0) continue;
    out.set(name, {
      ...appearance,
      cueOffsets: cuesInRange,
      lineCount: cuesInRange.length,
    });
  }
  return out;
}
