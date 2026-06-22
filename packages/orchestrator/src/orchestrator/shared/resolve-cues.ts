/**
 * Shared cue resolution - converts SceneCues into MixInputs
 *
 * Used by pipeline.ts, preview-pipeline.ts, and progressive-stitch.ts
 * to avoid duplicating the music/ambience/SFX resolution logic.
 */

import fs from 'fs';
import { getTrackPath } from '../../lib/catalog-loader.js';
import { log } from '../../lib/logger.js';
import type { MixInputs, SFXInput } from '../workers/mixer.js';
import type { SceneCues } from '../workers/cues.js';
import type { LineAlignment } from '../workers/align.js';

export interface ResolveCuesOptions {
  cues: SceneCues;
  alignmentLines: LineAlignment[];
  dialoguePath: string;
}

export interface ResolveCuesResult {
  mixInputs: MixInputs;
  /** Human-readable descriptions of tracks the LLM requested but couldn't be resolved. */
  warnings: string[];
}

/**
 * Resolve audio cues into concrete MixInputs with file paths.
 * Handles music, ambience, and SFX (including line_id → timestamp lookup).
 * Returns warnings for any tracks that could not be resolved — callers must
 * log or surface these so the user knows audio is missing from the mix.
 */
export function resolveCuesToMixInputs(opts: ResolveCuesOptions): ResolveCuesResult {
  const { cues, alignmentLines, dialoguePath } = opts;
  const mixInputs: MixInputs = { dialogue: dialoguePath };
  const warnings: string[] = [];

  // Music: use first cue's file
  if (cues.music && cues.music.length > 0) {
    const trackId = cues.music[0].file;
    if (trackId) {
      const musicPath = getTrackPath(trackId);
      if (musicPath && fs.existsSync(musicPath)) {
        mixInputs.music = musicPath;
      } else {
        const msg = `Music track not found in catalog: "${trackId}" — scene will have no music`;
        log.warn('[ResolveCues] ' + msg);
        warnings.push(msg);
      }
    }
  }

  // Ambience: use first cue's file
  if (cues.ambience && cues.ambience.length > 0) {
    const trackId = cues.ambience[0].file;
    if (trackId) {
      const ambiencePath = getTrackPath(trackId);
      if (ambiencePath && fs.existsSync(ambiencePath)) {
        mixInputs.ambience = ambiencePath;
      } else {
        const msg = `Ambience track not found in catalog: "${trackId}" — scene will have no ambience`;
        log.warn('[ResolveCues] ' + msg);
        warnings.push(msg);
      }
    }
  }

  // SFX: resolve each cue, converting line_id references to timestamps
  if (cues.sfx && cues.sfx.length > 0) {
    const sfxInputs: SFXInput[] = [];

    for (const sfxCue of cues.sfx) {
      if (!sfxCue.file) continue;

      const sfxPath = getTrackPath(sfxCue.file);
      if (!sfxPath || !fs.existsSync(sfxPath)) {
        const msg = `SFX track not found in catalog: "${sfxCue.file}" — effect will be omitted`;
        log.warn('[ResolveCues] ' + msg);
        warnings.push(msg);
        continue;
      }

      let startAtSeconds = 0;

      if (typeof sfxCue.start_at === 'string' && sfxCue.start_at.startsWith('line_')) {
        const line = alignmentLines.find((l) => l.line_id === sfxCue.start_at);
        if (line) startAtSeconds = line.start;
      } else if (typeof sfxCue.start_at === 'number') {
        startAtSeconds = sfxCue.start_at;
      }

      sfxInputs.push({
        file: sfxPath,
        at: startAtSeconds,
        duration: sfxCue.duration || null,
      });
    }

    if (sfxInputs.length > 0) {
      mixInputs.sfx = sfxInputs;
    }
  }

  return { mixInputs, warnings };
}

/**
 * Default mix parameters for professional audio output.
 * Scene-level overrides via scene.mix are spread on top.
 *
 * Gain levels:
 *   - #96 (earlier): ambience raised from -26 to -18 dB so room tone is
 *     clearly audible without competing with dialogue.
 *   - 2026-06-20 (Ryan 6/15 + 6/21 dev notes): music/ambience/SFX all +3 dB
 *     because Ryan reported "Volumes are slightly lower than desired. All
 *     volumes should be turned up slightly." Per-user offsets in
 *     audio_tuning table compose on top of this baseline, so users who
 *     don't like the new defaults can dial them back via the tuning UI.
 *
 *   music_gain_db:    -22 → -19
 *   ambience_gain_db: -18 → -15
 *   sfx_gain_db:      -12 →  -9
 */
export function getDefaultMixParams(sceneOverrides?: Record<string, unknown>) {
  return {
    music_gain_db: -19,
    ambience_gain_db: -15,
    sfx_gain_db: -9,
    target_lufs: -16,
    true_peak_db: -1.5,
    use_dialogue_processing: true,
    use_advanced_ducking: true,
    ...(sceneOverrides || {}),
  };
}
