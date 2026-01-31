/**
 * Audio Catalog - Client-side access to music, ambience, and SFX metadata
 *
 * Provides typed access to the full audio catalog for scoring and selection.
 */

import type { AudioTrackMetadata, AudioCategory, AudioCatalog } from '@/lib/types/audio';
import musicData from './music.json';
import ambienceData from './ambience.json';
import sfxData from './sfx.json';

export const audioCatalog: AudioCatalog = {
  music: musicData as AudioTrackMetadata[],
  ambience: ambienceData as AudioTrackMetadata[],
  sfx: sfxData as AudioTrackMetadata[],
};

/**
 * Get all tracks for a given category
 */
export function getTracksByCategory(category: AudioCategory): AudioTrackMetadata[] {
  return audioCatalog[category] || [];
}

/**
 * Look up a single track by ID across all categories
 */
export function getTrackById(id: string): AudioTrackMetadata | undefined {
  for (const category of ['music', 'ambience', 'sfx'] as AudioCategory[]) {
    const track = audioCatalog[category].find(t => t.id === id);
    if (track) return track;
  }
  return undefined;
}

/**
 * Get unique group names for a category (for filter dropdowns)
 */
export function getUniqueGroups(category: AudioCategory): string[] {
  const groups = new Set(audioCatalog[category].map(t => t.group));
  return Array.from(groups).sort();
}

/**
 * Get unique mood values for a category (for filter dropdowns)
 */
export function getUniqueMoods(category: AudioCategory): string[] {
  const moods = new Set(audioCatalog[category].flatMap(t => t.mood));
  return Array.from(moods).sort();
}
