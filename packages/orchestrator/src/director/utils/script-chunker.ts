/**
 * Script Chunker — splits a screenplay into scene-boundary-aligned chunks.
 *
 * Every chunk contains N complete scenes. The chunker never splits in the
 * middle of a scene, guaranteeing each chunk can be processed independently
 * by the SceneConstructionAgent.
 *
 * Scene headings are lines beginning with INT., EXT., INT/EXT., or I/E.
 * These are the standard FADE-proof scene delimiters used in Hollywood format.
 *
 * Also provides chunkScriptForExtraction() for Pass 1 parallel character
 * extraction on very long scripts.
 */

import type { CharacterEntry } from '../../schemas/character-manifest.js';

export interface SceneInfo {
  /** The full heading line (e.g., "INT. KEVIN'S HOUSE - DAY") */
  heading: string;
  /** Character offset of the heading in the original script text */
  start_index: number;
  /** Character offset of the next scene heading (or end of text) */
  end_index: number;
  /** 1-based sequential scene number across the full script */
  scene_num: number;
}

export interface ScriptChunk {
  /** 0-based chunk index */
  chunk_index: number;
  /** 1-based scene number of the first scene in this chunk */
  start_scene_num: number;
  /** 1-based scene number of the last scene in this chunk */
  end_scene_num: number;
  /** Raw script text for all scenes in this chunk */
  text: string;
  /** Scene headings contained in this chunk (for logging) */
  scene_headings: string[];
}

// Matches INT., EXT., INT/EXT., I/E., INT/EXT or I.E. at the start of a line
const SCENE_HEADING_RE = /^[ \t]*(INT\.|EXT\.|INT\/EXT\.|I\/E\.|INT\/EXT |I\.E\.).*$/gim;

/**
 * Find all scene headings and their character offsets.
 */
export function extractSceneInfo(scriptText: string): SceneInfo[] {
  const scenes: SceneInfo[] = [];
  const re = new RegExp(SCENE_HEADING_RE.source, SCENE_HEADING_RE.flags);
  let match: RegExpExecArray | null;

  while ((match = re.exec(scriptText)) !== null) {
    scenes.push({
      heading: match[0].trim(),
      start_index: match.index,
      end_index: -1,
      scene_num: scenes.length + 1,
    });
  }

  // Fill end_index (start of next scene, or end of text)
  for (let i = 0; i < scenes.length; i++) {
    scenes[i].end_index =
      i + 1 < scenes.length ? scenes[i + 1].start_index : scriptText.length;
  }

  return scenes;
}

/**
 * Split screenplay text into chunks of `scenesPerChunk` scenes each.
 *
 * If the script has no recognisable scene headings (e.g. a prose treatment),
 * returns a single chunk containing the full text, with scene_num=1.
 */
export function chunkScript(scriptText: string, scenesPerChunk = 15): ScriptChunk[] {
  const scenes = extractSceneInfo(scriptText);

  if (scenes.length === 0) {
    return [
      {
        chunk_index: 0,
        start_scene_num: 1,
        end_scene_num: 1,
        text: scriptText.trim(),
        scene_headings: [],
      },
    ];
  }

  const chunks: ScriptChunk[] = [];

  for (let i = 0; i < scenes.length; i += scenesPerChunk) {
    const slice = scenes.slice(i, i + scenesPerChunk);
    const startIdx = slice[0].start_index;
    const endIdx = slice[slice.length - 1].end_index;

    chunks.push({
      chunk_index: chunks.length,
      start_scene_num: slice[0].scene_num,
      end_scene_num: slice[slice.length - 1].scene_num,
      text: scriptText.slice(startIdx, endIdx).trim(),
      scene_headings: slice.map((s) => s.heading),
    });
  }

  return chunks;
}

/**
 * Count scenes in a script without building chunks.
 */
export function countScenes(scriptText: string): number {
  return extractSceneInfo(scriptText).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chunked character extraction support (Pass 1 on long scripts)
// ─────────────────────────────────────────────────────────────────────────────

/** Scripts longer than this (chars) are split for parallel Pass 1 extraction. */
export const EXTRACTION_CHUNK_THRESHOLD = 30_000;

export interface ExtractionChunk {
  chunk_index: number;
  text: string;
}

/**
 * Split a script into roughly equal character-length sections aligned on
 * scene boundaries, for parallel character extraction on long scripts.
 *
 * Returns a single chunk if the script is below the threshold.
 */
export function chunkScriptForExtraction(
  scriptText: string,
  maxCharsPerChunk = EXTRACTION_CHUNK_THRESHOLD
): ExtractionChunk[] {
  if (scriptText.length <= maxCharsPerChunk) {
    return [{ chunk_index: 0, text: scriptText }];
  }

  const scenes = extractSceneInfo(scriptText);

  // If no scene headings, fall back to a single chunk (can't split safely)
  if (scenes.length === 0) {
    return [{ chunk_index: 0, text: scriptText }];
  }

  const chunks: ExtractionChunk[] = [];
  let chunkStart = 0;
  let chunkCharCount = 0;

  for (let i = 0; i < scenes.length; i++) {
    const sceneLength = scenes[i].end_index - scenes[i].start_index;
    chunkCharCount += sceneLength;

    const isLast = i === scenes.length - 1;
    if (chunkCharCount >= maxCharsPerChunk || isLast) {
      const endIdx = scenes[i].end_index;
      chunks.push({
        chunk_index: chunks.length,
        text: scriptText.slice(chunkStart, endIdx).trim(),
      });
      chunkStart = endIdx;
      chunkCharCount = 0;
    }
  }

  return chunks;
}

/**
 * Merge CharacterEntry arrays from multiple extraction chunks.
 *
 * Deduplication rules:
 * - Characters are matched by canonical_name (case-insensitive)
 * - When the same character appears in multiple chunks, keep the entry with
 *   more fields populated (gender, age, description, sample_dialogue)
 * - Aliases are merged across chunks
 * - is_narrator=true always wins over is_narrator=false for the same name
 */
export function mergeCharacterLists(
  chunks: CharacterEntry[][]
): CharacterEntry[] {
  const byCanonical = new Map<string, CharacterEntry>();

  for (const chunkChars of chunks) {
    for (const entry of chunkChars) {
      const key = entry.canonical_name.toUpperCase().trim();
      const existing = byCanonical.get(key);

      if (!existing) {
        byCanonical.set(key, { ...entry });
        continue;
      }

      // Merge: keep whichever entry has more information
      const merged: CharacterEntry = {
        name: existing.name,
        canonical_name: existing.canonical_name,
        aliases: Array.from(new Set([...existing.aliases, ...entry.aliases])),
        // is_narrator=true wins
        is_narrator: existing.is_narrator || entry.is_narrator,
        // Prefer the richer description
        description:
          (entry.description?.length ?? 0) > (existing.description?.length ?? 0)
            ? entry.description
            : existing.description,
        // Fill in missing optional fields from the other chunk
        gender: existing.gender ?? entry.gender,
        age: existing.age ?? entry.age,
        sample_dialogue: existing.sample_dialogue ?? entry.sample_dialogue,
      };

      byCanonical.set(key, merged);
    }
  }

  return Array.from(byCanonical.values());
}
