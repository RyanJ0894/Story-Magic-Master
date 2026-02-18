/**
 * Timeline Worker - Builds scene timeline from alignment and cue choices
 */

import {
  validateTimeline,
  autoFixTimeline,
  type Timeline,
  type TimelineEvent,
} from './timeline-validator.js';

// Re-export types for use by other modules
export type { Timeline, TimelineEvent };
import { prisma } from '../../lib/prisma.js';
import { log } from '../../lib/logger.js';
import type { Scene, AudioCue } from '../../schemas/director-json.js';
import type { SceneAlignment } from './align.js';
import type { SceneCues } from './cues.js';

/**
 * Build scene timeline from alignment and cue choices
 * Validates for overlaps and conflicts
 */
export async function buildTimeline(
  scene: Scene,
  alignment: SceneAlignment,
  cueChoices: SceneCues
): Promise<Timeline> {
  const events: TimelineEvent[] = [];

  // Add dialogue events
  for (const line of alignment.lines) {
    events.push({
      type: 'dialogue_in',
      line_id: line.line_id,
      at: line.start,
    });

    events.push({
      type: 'dialogue_out',
      line_id: line.line_id,
      at: line.end,
    });
  }

  // Add ambience events
  if (cueChoices.ambience && cueChoices.ambience.length > 0) {
    for (const cue of cueChoices.ambience) {
      const startAt = typeof cue.start_at === 'number' ? cue.start_at : 0;
      const fadeIn = cue.fade_out && cue.fade_out >= 5 ? cue.fade_out : 5;
      const volume = cue.volume && -30 <= cue.volume && cue.volume <= -20 ? cue.volume : -20;

      events.push({
        type: 'ambience_in',
        cue_id: cue.file,
        at: startAt,
        fade: fadeIn,
        gain_db: volume,
      });

      const end = alignment.lines.at(-1)?.end ?? 60;
      const fadeOut = cue.fade_out && cue.fade_out >= 2 ? cue.fade_out : 2;
      const endAt = typeof cue.end_at === 'number' ? cue.end_at : Math.max(0, end);

      events.push({
        type: 'ambience_out',
        cue_id: cue.file,
        at: endAt,
        fade: fadeOut,
      });
    }
  }

  // Add music events
  if (cueChoices.music && cueChoices.music.length > 0) {
    for (const cue of cueChoices.music) {
      const first = alignment.lines[0]?.start ?? 2;
      const lastIndex = alignment.lines ? alignment.lines.length - 1 : 0;
      const last = alignment.lines[lastIndex]?.end ?? 2;

      const startAt =
        typeof cue.start_at === 'number' ? cue.start_at : Math.max(0, first + 2);
      const fadeIn = cue.fade_out && cue.fade_out >= 5 ? cue.fade_out : 5;
      const volume = cue.volume && -30 <= cue.volume && cue.volume <= -20 ? cue.volume : -25;

      events.push({
        type: 'music_in',
        cue_id: cue.file,
        at: startAt,
        fade: fadeIn,
        gain_db: volume,
        duck_db: 7, // Ducking amount during dialogue
      });

      const end = alignment.lines.at(-1)?.end ?? 60;
      const fadeOut = cue.fade_out && cue.fade_out >= 2 ? cue.fade_out : 2;
      const endAt = typeof cue.end_at === 'number' ? cue.end_at : Math.max(0, end);

      events.push({
        type: 'music_out',
        cue_id: cue.file,
        at: endAt,
        fade: fadeOut,
      });
    }
  }

  // Add SFX events if present in scene
  if (scene.sfx) {
    for (const sfx of scene.sfx) {
      // Convert line_id to timestamp
      let sfxTimestamp = 0;

      if (typeof sfx.start_at === 'string') {
        // start_at is a line_id (e.g., "line_005")
        const targetLine = alignment.lines.find((line) => line.line_id === sfx.start_at);

        if (targetLine) {
          // SFX should trigger at the START of the line it's attached to
          sfxTimestamp = targetLine.start;
          log.debug('SFX synced to line', {
            sfxFile: sfx.file,
            lineId: sfx.start_at,
            timestampSec: sfxTimestamp,
          });
        } else {
          log.warn('SFX line_id not found in alignment, defaulting to 0s', {
            sfxLineId: sfx.start_at,
          });
          sfxTimestamp = 0;
        }
      } else if (typeof sfx.start_at === 'number') {
        // start_at is already a timestamp
        sfxTimestamp = sfx.start_at;
      } else {
        log.warn('Invalid sfx.start_at format, defaulting to 0s', { startAt: sfx.start_at });
        sfxTimestamp = 0;
      }

      const volume = sfx.volume && -30 <= sfx.volume && sfx.volume <= -20 ? sfx.volume : -25;

      events.push({
        type: 'sfx_at',
        cue_id: sfx.file,
        at: sfxTimestamp,
        gain_db: volume,
        duration: sfx.duration ?? 7,
        fade_out: sfx.fade_out && sfx.fade_out >= 1 ? sfx.fade_out : 1,
      });
    }
  }

  const timeline: Timeline = {
    scene_id: scene.scene_id,
    events: events.sort((a, b) => a.at - b.at),
  };

  // Validate timeline
  const validation = validateTimeline(timeline);

  if (!validation.valid) {
    log.error('Timeline validation failed', undefined, {
      sceneId: scene.scene_id,
      errors: validation.errors,
    });

    log.info('Attempting timeline auto-fix', { sceneId: scene.scene_id });
    const fixed = autoFixTimeline(timeline);

    const revalidation = validateTimeline(fixed);
    if (revalidation.valid) {
      log.info('Timeline auto-fixed successfully', { sceneId: scene.scene_id });
      return saveTimeline(scene.scene_id, fixed);
    } else {
      throw new Error(`Timeline validation failed and could not be auto-fixed`);
    }
  }

  if (validation.warnings.length > 0) {
    log.warn('Timeline has warnings', {
      sceneId: scene.scene_id,
      warnings: validation.warnings,
    });
  }

  return await saveTimeline(scene.scene_id, timeline);
}

/**
 * Save timeline to database via Prisma raw SQL
 */
async function saveTimeline(scene_id: string, timeline: Timeline): Promise<Timeline> {
  try {
    const project_id = timeline.project_id || '00000000-0000-0000-0000-000000000001';

    await prisma.$executeRaw`
      INSERT INTO timelines (project_id, scene_id, timeline_json, created_at)
      VALUES (${project_id}, ${scene_id}, ${JSON.stringify(timeline)}::jsonb, NOW())
      ON CONFLICT (project_id, scene_id)
      DO UPDATE SET timeline_json = ${JSON.stringify(timeline)}::jsonb, created_at = NOW()
    `;
  } catch (err) {
    log.error('Failed to save timeline to DB', err instanceof Error ? err : undefined, {
      scene_id,
    });
  }

  return timeline;
}
