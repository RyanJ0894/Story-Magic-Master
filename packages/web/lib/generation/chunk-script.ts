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

// 2026-06-21 (Ryan 6/21 item Y, "perceived instant" progressive playback)
// + 2026-06-22 follow-up: Ryan asked "can we set playback to start at 10
// or 15% instead of 33%?"
//
// Two knobs:
//   - SCENES_PER_CHUNK = 7  → mid-script chunks. 7 scenes amortizes the
//     per-chunk fixed overhead (orchestrator round-trip, pre-flight voice
//     probe, mix setup) without slowing total wall time.
//   - FIRST_CHUNK_SCENES = 2 → the FIRST chunk is intentionally tiny so
//     time-to-first-audio is minimized regardless of total script length.
//
// Time-to-first-audio table:
//   5 scenes  → chunks [2,3]            first audio at ~40%
//   10 scenes → chunks [2,7,1]          first audio at ~20%
//   15 scenes → chunks [2,7,6]          first audio at ~13%
//   30 scenes → chunks [2,7,7,7,7]     first audio at ~7%
//  100 scenes → chunks [2,7,7,…,2]    first audio at ~2%
//
// Trade-off: a 2-scene first chunk has higher per-scene overhead than a
// 7-scene chunk. For very short scripts (≤ FIRST_CHUNK_SCENES) we collapse
// back to a single chunk — no benefit from making chunk 0 small if the
// whole script fits in one fast pass anyway.
export const SCENES_PER_CHUNK = 7;
export const FIRST_CHUNK_SCENES = 2;

export interface SceneChunk {
  index: number;      // 0-based segment index
  scenes: unknown[];  // slice of DirectorJSON.scenes
  startScene: number; // first scene index in the original array
  endScene: number;   // last scene index (inclusive)
}

/**
 * Split a flat scenes array into ordered chunks.
 *
 * Always returns at least one chunk (even if scenes.length === 0).
 *
 * Sizing rules:
 *   - 0 scenes              → 1 empty chunk (no-op job)
 *   - ≤ FIRST_CHUNK_SCENES  → 1 chunk (script too short to benefit from a
 *                              tiny opening chunk)
 *   - Otherwise              → [first FIRST_CHUNK_SCENES, then standard
 *                              SCENES_PER_CHUNK each]
 */
export function chunkScenes(scenes: unknown[]): SceneChunk[] {
  if (scenes.length === 0) {
    return [{ index: 0, scenes: [], startScene: 0, endScene: 0 }];
  }
  if (scenes.length <= FIRST_CHUNK_SCENES) {
    return [{ index: 0, scenes, startScene: 0, endScene: scenes.length - 1 }];
  }

  const chunks: SceneChunk[] = [];
  // Small first chunk for fast time-to-first-audio.
  chunks.push({
    index: 0,
    scenes: scenes.slice(0, FIRST_CHUNK_SCENES),
    startScene: 0,
    endScene: FIRST_CHUNK_SCENES - 1,
  });
  // Standard-size chunks for the rest.
  for (let i = FIRST_CHUNK_SCENES; i < scenes.length; i += SCENES_PER_CHUNK) {
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
