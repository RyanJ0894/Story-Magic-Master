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

// 2026-06-21 — Ryan 6/21 item Y ("perceived instant" progressive playback):
// SCENES_PER_CHUNK reduced from 14 → 7. Was: a 15-scene script produced
// 2 chunks, so the first chunk completed at ~50% of total job time. Now:
// 15 scenes produces 3 chunks; first chunk completes at ~33%. Combined with
// the existing firstAudioUrl + segment auto-advance in audio-player.tsx,
// this materially shortens time-to-first-audio across the 5-25 page range
// where Ryan does most testing. Tradeoff: more orchestrator round-trips
// per script. Acceptable — the orchestrator's scene_renders cache (#191)
// absorbs the per-chunk overhead on retries.
export const SCENES_PER_CHUNK = 7;

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
