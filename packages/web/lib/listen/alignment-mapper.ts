/**
 * Alignment → absolute-time line-timing map for the Listen UI.
 *
 * Closes #207 (Listen UI display out of sync).
 *
 * Background
 * ──────────
 * The orchestrator produces high-quality per-line timestamps via whisper.cpp
 * (PR #270/#278/#279/#280) and stores them in the `alignments` table indexed
 * by (project_id, scene_id). Each row holds a `SceneAlignment` with lines
 * keyed by `line_id`, where each line's `start` / `end` are SCENE-LOCAL
 * (seconds since that scene's audio began).
 *
 * The Listen page previously read only `project.directorJson` (which lacks
 * any timing data) and let the player re-derive line offsets via character-
 * count estimation. Whisper data sat unused. That's the drift symptom #207
 * tracked. This helper closes the gap by producing a map keyed by `line_id`
 * with ABSOLUTE timings (seconds since the start of the final mix).
 *
 * Crossfade math
 * ──────────────
 * Final scenes are concatenated with a 1.5 s equal-power crossfade per join
 * (`packages/orchestrator/src/orchestrator/workers/export.ts` —
 * `makePlaybackManifest`). Each crossfade reduces the total mix duration by
 * 1.5 s vs raw sum-of-scenes. So absolute scene offsets accumulate as:
 *
 *   sceneOffset[0]   = 0
 *   sceneOffset[i+1] = sceneOffset[i] + sceneLocalDuration[i] - 1.5
 *
 * where `sceneLocalDuration[i] = max(lines[*].end)` of that scene's alignment.
 *
 * Robustness
 * ──────────
 * - Scenes without an alignment row are skipped (their lines stay unaligned,
 *   so the player falls back to char-estimation just for them).
 * - Lines without `line_id` in the stored alignment are also skipped — we
 *   never want to silently mis-map a different line's id.
 * - If the LAST scene is missing alignment, downstream scenes (none) don't
 *   accumulate, so this is benign; the renderer just degrades gracefully on
 *   that scene's lines.
 *
 * Why a separate file (not inlined in listen/page.tsx)
 * ────────────────────────────────────────────────────
 * Unit-testable in isolation. The page is a server component and tangled
 * with Clerk + Prisma; this helper takes a Prisma client as a parameter
 * specifically so the test can pass an in-memory mock.
 */

import type { PrismaClient } from '@story-magic/shared';

/** Crossfade duration that matches what `makePlaybackManifest` uses. */
export const LISTEN_CROSSFADE_SECONDS = 1.5;

/** Shape of the JSON we store in `alignments.alignment_json`. */
interface StoredLineAlignment {
  line_id?: string;
  start: number;
  end: number;
}
interface StoredSceneAlignment {
  scene_id?: string;
  lines: StoredLineAlignment[];
}

/** Result of the mapper: lookup keyed by `line_id` returning absolute times. */
export type LineTimingMap = Map<string, { start: number; end: number }>;

/**
 * Load every alignment row for the project and project them onto absolute
 * mix-time using the scene order from `sceneOrder`.
 *
 * @param prisma Prisma client (so this function is mockable in tests)
 * @param projectId Project to load alignments for
 * @param sceneOrder Scene IDs in the order the final mix concatenates them
 *                   (this MUST match `directorJson.scenes[*].scene_id` order)
 * @param crossfadeSeconds Crossfade between scene joins. Defaults to 1.5 s
 *                        matching the orchestrator's `makePlaybackManifest`
 */
export async function buildLineTimingMap(
  prisma: PrismaClient,
  projectId: string,
  sceneOrder: ReadonlyArray<string>,
  crossfadeSeconds: number = LISTEN_CROSSFADE_SECONDS,
): Promise<LineTimingMap> {
  const out: LineTimingMap = new Map();
  if (sceneOrder.length === 0) return out;

  // Fetch all alignments for this project. The table holds one row per
  // (project_id, scene_id) — at the page-load volumes we expect (<50 scenes)
  // a single `findMany` is far cheaper than per-scene round trips.
  const rows = await prisma.alignment.findMany({
    where: { projectId },
    select: { sceneId: true, alignmentJson: true },
  });

  const bySceneId = new Map<string, StoredSceneAlignment>();
  for (const r of rows) {
    bySceneId.set(r.sceneId, r.alignmentJson as unknown as StoredSceneAlignment);
  }

  let sceneOffset = 0;
  for (let i = 0; i < sceneOrder.length; i++) {
    const sceneId = sceneOrder[i];
    const align = bySceneId.get(sceneId);

    // Skip scenes with no alignment — those lines just won't appear in the
    // map and the renderer will fall back to char-estimation for them. We
    // still need to advance the offset using SOME estimate of this scene's
    // duration, but since we have nothing better, leave the offset unchanged.
    // Practical impact: if scene N is missing, scenes N+1..end will be off
    // by ~scene_N_duration. Better than crashing; future enhancement could
    // estimate from `directorJson` char counts here.
    if (!align?.lines?.length) continue;

    let sceneLocalMaxEnd = 0;
    for (const line of align.lines) {
      if (typeof line.line_id !== 'string' || line.line_id.length === 0) continue;
      if (typeof line.start !== 'number' || typeof line.end !== 'number') continue;

      out.set(line.line_id, {
        start: sceneOffset + line.start,
        end: sceneOffset + line.end,
      });

      if (line.end > sceneLocalMaxEnd) sceneLocalMaxEnd = line.end;
    }

    // Advance offset for the next scene. Last scene contributes its full
    // duration to the total but never has a downstream crossfade applied.
    if (i < sceneOrder.length - 1) {
      sceneOffset += sceneLocalMaxEnd - crossfadeSeconds;
    } else {
      sceneOffset += sceneLocalMaxEnd;
    }
  }

  return out;
}
