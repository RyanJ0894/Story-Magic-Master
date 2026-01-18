/**
 * Cues Worker - Extract audio cues from scene data
 */

import type { Scene, AudioCue } from '../../schemas/director-json.js';
import type { AudioCatalog } from '../../lib/catalog-loader.js';

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
  console.log(`\n🔍 DIAGNOSTIC pickCues for scene ${scene.scene_id}:`);
  console.log(`   Scene has music array:`, !!scene.music, `(length: ${scene.music?.length || 0})`);
  console.log(`   Scene has ambience array:`, !!scene.ambience);
  console.log(`   Scene has sfx array:`, !!scene.sfx, `(length: ${scene.sfx?.length || 0})`);

  // Return the pre-selected cues from the scene
  // These were selected by AudioDirectorAgent
  const result: SceneCues = {
    music: scene.music || [],
    ambience: scene.ambience || [],
    sfx: scene.sfx || [],
  };

  console.log(`✅ DIAGNOSTIC pickCues result:`, {
    music_count: result.music.length,
    ambience_count: result.ambience.length,
    sfx_count: result.sfx.length,
  });

  return result;
}
