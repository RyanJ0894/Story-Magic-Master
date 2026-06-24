/**
 * Director scene cache — cross-project per-scene cache of DirectorAgent output.
 *
 * Director is the ~330 s tentpole on a cold 10-page generation. Re-runs of
 * the same project already short-circuit via `project.directorJson` persisted
 * on the row. This cache is for the cross-project case: identical (or
 * partially-identical) scripts uploaded to fresh projects.
 *
 * Lookup is ALL-OR-NOTHING:
 *   1. Split incoming script into scene blocks via `extractSceneInfo`
 *   2. Hash each block + model
 *   3. Look them all up
 *   4. If every hash hits → assemble a synthetic DirectorJSON and SKIP
 *      DirectorAgent.process() entirely.
 *   5. If any miss → run DirectorAgent normally, then persist each output
 *      scene by its source-text hash for next time.
 *
 * Why all-or-nothing instead of splicing: DirectorAgent makes context-aware
 * choices (cross-scene character continuity, voice consistency) that don't
 * survive partial splice. Skipping director only when 100 % of scenes are
 * cached preserves quality unconditionally.
 *
 * Persistence is fire-and-forget. A cache write failure never fails a job.
 * The DirectorJSONValidator runs after assembly, so any malformed cached
 * data is caught and auto-corrected by the existing safety net.
 *
 * Known limitation (documented for follow-up): cached scenes include
 * `voice_key` values from whichever DirectorAgent run first populated them.
 * Cross-project hits inherit those assignments. The pre-flight voice check
 * (#338/#343) substitutes any voice that's no longer in the catalog, and
 * `voice_overrides` from the user still take precedence post-cache.
 */

import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { log } from '../lib/logger.js';
import { extractSceneInfo } from './utils/script-chunker.js';
import type { DirectorJSON, Scene } from '../schemas/director-json.js';

export interface SceneTextWithHash {
  /** 0-based ordinal in the script */
  index: number;
  /** Raw scene text including heading */
  text: string;
  /** sha256(text + '|' + model) */
  hash: string;
}

/**
 * Split a script into scene blocks and hash each one. Hash combines
 * scene text and model so a director-model upgrade naturally orphans
 * old entries without any keying change.
 *
 * For scripts with no recognisable slug lines (prose treatments) we
 * return a single block over the whole script — same fallback behavior
 * as the existing chunker. The cache still works in that mode; it just
 * has scene-count=1 and behaves like a full-script content-hash cache.
 */
export function hashScenes(scriptText: string, model: string): SceneTextWithHash[] {
  const scenes = extractSceneInfo(scriptText);
  if (scenes.length === 0) {
    const text = scriptText.trim();
    return text.length > 0
      ? [{ index: 0, text, hash: hashSceneText(text, model) }]
      : [];
  }
  return scenes.map((s, i) => {
    const text = scriptText.slice(s.start_index, s.end_index).trim();
    return { index: i, text, hash: hashSceneText(text, model) };
  });
}

function hashSceneText(text: string, model: string): string {
  return crypto.createHash('sha256').update(`${text}|${model}`).digest('hex');
}

/**
 * Try to assemble a full DirectorJSON from cache.
 *
 * Returns null when ANY scene is missing — partial hits do NOT splice.
 * On a full hit, bumps hit_count + last_hit_at for every row (fire-and-
 * forget so the cache update can't slow down the pipeline).
 */
export async function lookupCachedDirectorJson(
  projectId: string,
  scriptText: string,
  model: string,
): Promise<DirectorJSON | null> {
  const scenes = hashScenes(scriptText, model);
  if (scenes.length === 0) return null;

  const hashes = scenes.map((s) => s.hash);

  let rows: Array<{ contentHash: string; sceneJson: unknown }>;
  try {
    rows = await prisma.directorSceneCache.findMany({
      where: { contentHash: { in: hashes } },
      select: { contentHash: true, sceneJson: true },
    });
  } catch (err) {
    log.warn('[director-scene-cache] lookup failed (non-fatal)', {
      projectId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  if (rows.length !== scenes.length) {
    log.info('[director-scene-cache] partial miss — DirectorAgent will run', {
      projectId,
      totalScenes: scenes.length,
      hits: rows.length,
    });
    return null;
  }

  const byHash = new Map<string, unknown>();
  for (const r of rows) byHash.set(r.contentHash, r.sceneJson);

  // Assemble in original script order. A hash should be present for every
  // scene because we just verified rows.length === scenes.length, but the
  // fallback to undefined keeps the type guard explicit.
  const assembledScenes: Scene[] = [];
  for (const s of scenes) {
    const cached = byHash.get(s.hash);
    if (cached === undefined) {
      log.warn('[director-scene-cache] inconsistent lookup result — bailing', {
        projectId,
        hash: s.hash.slice(0, 12),
      });
      return null;
    }
    assembledScenes.push(cached as Scene);
  }

  // Bump hit metadata. Fire-and-forget — never block the hot path.
  void prisma.directorSceneCache
    .updateMany({
      where: { contentHash: { in: hashes } },
      data: { hitCount: { increment: 1 }, lastHitAt: new Date() },
    })
    .catch((err) => {
      log.warn('[director-scene-cache] hit-metadata update failed (non-fatal)', {
        error: err instanceof Error ? err.message : String(err),
      });
    });

  log.info('[director-scene-cache] HIT — skipping DirectorAgent', {
    projectId,
    sceneCount: scenes.length,
    model,
  });

  return {
    project_id: projectId,
    scenes: assembledScenes,
  };
}

/**
 * Persist DirectorAgent output to the cache.
 *
 * Defense against scene-count drift: only persists if our scene splitter
 * produced the same scene count as the agent's output. Otherwise we have
 * no reliable mapping from input-scene-text → output-scene-json, and a
 * mismatched persist could poison the cache.
 *
 * Uses createMany(skipDuplicates) — a parallel job that already populated
 * the same hashes is fine; we leave existing rows alone (their hit_count
 * and last_hit_at stay accurate).
 */
export async function persistDirectorJson(
  scriptText: string,
  model: string,
  directorJson: DirectorJSON,
): Promise<void> {
  const inputScenes = hashScenes(scriptText, model);
  const outputScenes = directorJson.scenes ?? [];

  if (inputScenes.length !== outputScenes.length) {
    log.warn('[director-scene-cache] skip persist: input/output scene count mismatch', {
      inputCount: inputScenes.length,
      outputCount: outputScenes.length,
    });
    return;
  }

  const rows = inputScenes.map((s, i) => ({
    contentHash: s.hash,
    model,
    sceneJson: outputScenes[i] as unknown as object,
    charCount: s.text.length,
  }));

  try {
    const result = await prisma.directorSceneCache.createMany({
      data: rows,
      skipDuplicates: true,
    });
    log.info('[director-scene-cache] persisted', {
      attempted: rows.length,
      created: result.count,
      model,
    });
  } catch (err) {
    log.warn('[director-scene-cache] persist failed (non-fatal)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
