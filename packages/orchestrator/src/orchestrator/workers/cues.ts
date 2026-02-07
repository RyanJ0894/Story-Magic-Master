/**
 * Cues Worker - Extract audio cues from scene data
 */

import type { Scene, AudioCue } from '../../schemas/director-json.js';
import type { AudioCatalog } from '../../lib/catalog-loader.js';
import { log } from '../../lib/logger.js';

export interface SceneCues {
  music: AudioCue[];
  ambience: AudioCue[];
  sfx: AudioCue[];
}

/**
 * Extract audio cues from a scene
 * Returns the scene's pre-selected music, ambience, and SFX
 */
export async function pickCues(scene: Scene, catalog: AudioCatalog): Promise<SceneCues> {
  log.debug('pickCues input for scene', {
    sceneId: scene.scene_id,
    hasMusic: !!scene.music,
    musicCount: scene.music?.length || 0,
    hasAmbience: !!scene.ambience,
    hasSfx: !!scene.sfx,
    sfxCount: scene.sfx?.length || 0,
  });

  // Return the pre-selected cues from the scene
  // These were selected by AudioDirectorAgent
  const result: SceneCues = {
    music: scene.music || [],
    ambience: scene.ambience || [],
    sfx: scene.sfx || [],
  };

  log.debug('pickCues result', {
    sceneId: scene.scene_id,
    musicCount: result.music.length,
    ambienceCount: result.ambience.length,
    sfxCount: result.sfx.length,
  });

  return result;
}
