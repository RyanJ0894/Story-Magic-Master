/**
 * Scene-level idempotency cache (T2-2 of cost-opt Phase 2, issue #190).
 *
 * The TTS layer already has a per-line stem cache that prevents redundant
 * ElevenLabs calls (see `lib/idempotency.ts` + `ttsForScene`). But the
 * downstream per-scene work — Whisper alignment, audio-cue resolution,
 * timeline build, ffmpeg mix — runs on every orchestrate request even when
 * the scene's content is unchanged.
 *
 * This module fixes that. Each scene's "rendering inputs" are hashed into a
 * SHA-256 content hash. On a subsequent run, if the hash matches a previously
 * cached render AND the rendered file still exists on disk, the entire
 * scene block is skipped.
 *
 * Disable via `SCENE_CACHE_DISABLED=true` (e.g. while debugging mix output
 * and you want every run to be fresh).
 */

import crypto from 'crypto';
import fs from 'fs';
import { prisma } from './prisma.js';
import { log } from './logger.js';
import type { Scene } from '../schemas/director-json.js';

/**
 * Determines whether the cache is in effect for this process. Read at call
 * time so an operator can flip it via Render env without restart.
 */
export function isSceneCacheEnabled(): boolean {
  return process.env.SCENE_CACHE_DISABLED !== 'true';
}

/**
 * SHA-256 of the scene inputs that determine the rendered output.
 *
 * Includes:
 *   - scene_id (so renaming a scene invalidates its cache)
 *   - mood / intensity (alignment + mix params depend on them)
 *   - dialogue lines: line_id + character + text + voice_key + emotion
 *     (these together drive every per-line decision the pipeline makes)
 *   - audio cues: music / ambience / sfx file refs + reasoning
 *     (cue selection feeds the mixer)
 *   - mix params (LUFS, true peak, gain — these define the final encode)
 *   - B-003 (2026-06-15): per-user audio tuning offsets. CRITICAL — without
 *     this a user who locks new tuning values would silently get the OLD
 *     cached render. The whole sliders feature would break invisibly.
 *
 * Deliberately excludes:
 *   - summary / description (presentational, not rendered)
 *   - LLM reasoning fields that don't affect downstream output
 */

/**
 * Per-user audio tuning offsets that affect the final mix. When the user
 * hasn't locked any tuning, pass `undefined` — that hashes to a stable
 * "no tuning" sentinel matching legacy projects rendered before this feature.
 *
 * Shape matches `AudioTuningDto` from `packages/web/lib/services/audio-tuning`
 * minus the housekeeping fields (`locked`, `updatedAt`) since those don't
 * affect the render.
 */
export interface AudioTuningOverrides {
  musicGainOffsetDb: number;
  ambienceGainOffsetDb: number;
  sfxGainOffsetDb: number;
  narrationSpeed: number;
}

export function computeSceneRenderHash(
  scene: Scene,
  tuning?: AudioTuningOverrides,
): string {
  // Stable structural projection — same scene must always serialize to the
  // same string regardless of property-order quirks elsewhere.
  const fingerprint = {
    scene_id: scene.scene_id,
    mood: scene.mood ?? null,
    intensity: scene.intensity ?? null,
    dialogue: scene.dialogue.map((line) => ({
      line_id: line.line_id,
      character: line.character,
      text: line.text,
      voice_key: line.voice_key,
      emotion: line.emotion ?? null,
    })),
    music: (scene.music ?? []).map((cue) => ({
      file: cue.file,
      start_at: cue.start_at ?? null,
      end_at: cue.end_at ?? null,
      duration: cue.duration ?? null,
      volume: cue.volume ?? null,
    })),
    ambience: (scene.ambience ?? []).map((cue) => ({
      file: cue.file,
      start_at: cue.start_at ?? null,
      end_at: cue.end_at ?? null,
      duration: cue.duration ?? null,
      volume: cue.volume ?? null,
    })),
    sfx: (scene.sfx ?? []).map((cue) => ({
      file: cue.file,
      start_at: cue.start_at ?? null,
      end_at: cue.end_at ?? null,
      duration: cue.duration ?? null,
      volume: cue.volume ?? null,
    })),
    mix: scene.mix ?? null,
    // B-003 — `null` sentinel for "no tuning" so legacy rendered projects
    // keep their existing hash. Only present-and-non-null tuning changes
    // the hash, which is the desired invalidation behavior.
    tuning: tuning ?? null,
  };

  return crypto.createHash('sha256').update(JSON.stringify(fingerprint)).digest('hex');
}

/**
 * Look up a previously cached render for `(projectId, sceneId)`. Returns
 * the cached scene path only if the stored hash matches `contentHash` AND
 * the file still exists on disk.
 *
 * A DB hit with a stale `contentHash` returns null (cache miss). A DB hit
 * whose file has been cleaned off disk also returns null and the stale row
 * is left for the writer to overwrite — the per-scene primary key means
 * the next `recordSceneRender` will upsert it cleanly.
 */
export async function findCachedSceneRender(
  projectId: string,
  sceneId: string,
  contentHash: string,
): Promise<string | null> {
  if (!isSceneCacheEnabled()) return null;

  try {
    const row = await prisma.sceneRender.findUnique({
      where: { projectId_sceneId: { projectId, sceneId } },
      select: { contentHash: true, scenePath: true },
    });

    if (!row) return null;
    if (row.contentHash !== contentHash) return null;
    if (!fs.existsSync(row.scenePath)) {
      log.debug('[scene-cache] hash matched but file missing on disk — treating as miss', {
        projectId,
        sceneId,
        scenePath: row.scenePath,
      });
      return null;
    }

    return row.scenePath;
  } catch (err) {
    // DB hiccup must not break the pipeline — fall through to fresh render.
    log.warn('[scene-cache] lookup failed; rendering fresh', {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Persist a successful render so the next request with the same content
 * hash can skip the pipeline. Upserts on the (projectId, sceneId) primary
 * key — old hashes are silently overwritten.
 *
 * Failures here are non-fatal: the current request still completes and
 * returns the freshly rendered path; only the cache is missing.
 */
export async function recordSceneRender(
  projectId: string,
  sceneId: string,
  contentHash: string,
  scenePath: string,
): Promise<void> {
  if (!isSceneCacheEnabled()) return;

  try {
    await prisma.sceneRender.upsert({
      where: { projectId_sceneId: { projectId, sceneId } },
      update: { contentHash, scenePath },
      create: { projectId, sceneId, contentHash, scenePath },
    });
  } catch (err) {
    log.warn('[scene-cache] write failed; render uncached but otherwise OK', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
