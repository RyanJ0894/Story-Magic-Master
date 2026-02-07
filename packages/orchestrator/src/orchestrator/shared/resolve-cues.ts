/**
 * Shared cue resolution - converts SceneCues into MixInputs
 *
 * Used by pipeline.ts, preview-pipeline.ts, and progressive-stitch.ts
 * to avoid duplicating the music/ambience/SFX resolution logic.
 */

import fs from 'fs';
import { getTrackPath } from '../../lib/catalog-loader.js';
import type { MixInputs, SFXInput } from '../workers/mixer.js';
import type { SceneCues } from '../workers/cues.js';
import type { LineAlignment } from '../workers/align.js';

export interface ResolveCuesOptions {
  cues: SceneCues;
  alignmentLines: LineAlignment[];
  dialoguePath: string;
}

/**
 * Resolve audio cues into concrete MixInputs with file paths.
 * Handles music, ambience, and SFX (including line_id → timestamp lookup).
 */
export function resolveCuesToMixInputs(opts: ResolveCuesOptions): MixInputs {
  const { cues, alignmentLines, dialoguePath } = opts;
  const mixInputs: MixInputs = { dialogue: dialoguePath };

  // Music: use first cue's file
  if (cues.music && cues.music.length > 0) {
    const trackId = cues.music[0].file;
    if (trackId) {
      const musicPath = getTrackPath(trackId);
      if (musicPath && fs.existsSync(musicPath)) {
        mixInputs.music = musicPath;
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
      }
    }
  }

  // SFX: resolve each cue, converting line_id references to timestamps
  if (cues.sfx && cues.sfx.length > 0) {
    const sfxInputs: SFXInput[] = [];

    for (const sfxCue of cues.sfx) {
      if (!sfxCue.file) continue;

      const sfxPath = getTrackPath(sfxCue.file);
      if (!sfxPath || !fs.existsSync(sfxPath)) continue;

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

  return mixInputs;
}

/**
 * Default mix parameters for professional audio output.
 * Scene-level overrides via scene.mix are spread on top.
 */
export function getDefaultMixParams(sceneOverrides?: Record<string, unknown>) {
  return {
    music_gain_db: -22,
    ambience_gain_db: -26,
    sfx_gain_db: -12,
    target_lufs: -16,
    true_peak_db: -1.5,
    use_dialogue_processing: true,
    use_advanced_ducking: true,
    ...(sceneOverrides || {}),
  };
}
