/**
 * Script Chunking — splits long scripts into processable segments
 *
 * Splits a Director JSON scene array into segments of roughly SCENES_PER_CHUNK
 * scenes each. Each chunk is processed independently by the orchestrator and
 * produces a segment audio file. Segments are later concatenated into the
 * final output.
 *
 * Scene count → segment count:
 *   1–20 scenes  → 1 segment  (short scripts, no chunking overhead)
 *   21–40 scenes → 2 segments
 *   41–60 scenes → 3 segments
 *   etc.
 */

// ~25 pages ≈ 12–15 scenes at standard screenplay density
export const SCENES_PER_CHUNK = 14;

export interface SceneChunk {
  index: number;      // 0-based segment index
  scenes: unknown[];  // slice of DirectorJSON.scenes
  startScene: number; // first scene index in the original array
  endScene: number;   // last scene index (inclusive)
}

/**
 * Split a flat scenes array into ordered chunks.
 * Always returns at least one chunk (even if scenes.length === 0).
 */
export function chunkScenes(scenes: unknown[]): SceneChunk[] {
  if (scenes.length === 0) {
    return [{ index: 0, scenes: [], startScene: 0, endScene: 0 }];
  }

  const chunks: SceneChunk[] = [];
  for (let i = 0; i < scenes.length; i += SCENES_PER_CHUNK) {
    const slice = scenes.slice(i, i + SCENES_PER_CHUNK);
    chunks.push({
      index: chunks.length,
      scenes: slice,
      startScene: i,
      endScene: i + slice.length - 1,
    });
  }
  return chunks;
}

/**
 * Build the user-facing label for a segment during processing.
 * Avoids exposing "chunk" or "segment N of N" language.
 */
export function segmentProgressLabel(chunk: SceneChunk, total: number): string {
  if (total === 1) {
    return 'Generating audio…';
  }
  // "Scenes 1–14" instead of "Segment 1 of 3"
  const start = chunk.startScene + 1;
  const end = chunk.endScene + 1;
  return `Generating audio for scenes ${start}–${end}…`;
}
