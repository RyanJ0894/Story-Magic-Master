/**
 * Audio catalog loader
 * Loads music, ambience, and SFX tracks from the catalog directory
 */

import fs from 'fs';
import path from 'path';

const CATALOG_BASE = 'catalog';

export interface CatalogTrack {
  id: string;
  path: string;
  filename: string;
}

export interface AudioCatalog {
  music: CatalogTrack[];
  ambience: CatalogTrack[];
  sfx: CatalogTrack[];
}

/**
 * Load audio catalog from filesystem
 */
export function loadCatalog(): AudioCatalog {
  console.log('📂 Loading audio catalog from:', CATALOG_BASE);
  const catalog: AudioCatalog = { music: [], ambience: [], sfx: [] };

  try {
    if (!fs.existsSync(CATALOG_BASE)) {
      console.warn(`⚠️  Catalog directory not found: ${CATALOG_BASE}`);
      fs.mkdirSync(path.join(CATALOG_BASE, 'music'), { recursive: true });
      fs.mkdirSync(path.join(CATALOG_BASE, 'ambience'), { recursive: true });
      fs.mkdirSync(path.join(CATALOG_BASE, 'sfx'), { recursive: true });
      return catalog;
    }

    const audioExtensions = ['.mp3', '.wav', '.m4a'];
    const isAudioFile = (f: string) => audioExtensions.some((ext) => f.endsWith(ext));

    const musicDir = path.join(CATALOG_BASE, 'music');
    if (fs.existsSync(musicDir)) {
      const musicFiles = fs.readdirSync(musicDir).filter(isAudioFile);
      for (const file of musicFiles) {
        catalog.music.push({
          id: `music/${file}`,
          path: path.join(musicDir, file),
          filename: file,
        });
      }
      console.log(`   ✅ Loaded ${catalog.music.length} music tracks`);
    }

    const ambienceDir = path.join(CATALOG_BASE, 'ambience');
    if (fs.existsSync(ambienceDir)) {
      const ambienceFiles = fs.readdirSync(ambienceDir).filter(isAudioFile);
      for (const file of ambienceFiles) {
        catalog.ambience.push({
          id: `ambience/${file}`,
          path: path.join(ambienceDir, file),
          filename: file,
        });
      }
      console.log(`   ✅ Loaded ${catalog.ambience.length} ambience tracks`);
    }

    const sfxDir = path.join(CATALOG_BASE, 'sfx');
    if (fs.existsSync(sfxDir)) {
      const sfxFiles = fs.readdirSync(sfxDir).filter(isAudioFile);
      for (const file of sfxFiles) {
        catalog.sfx.push({
          id: `sfx/${file}`,
          path: path.join(sfxDir, file),
          filename: file,
        });
      }
      console.log(`   ✅ Loaded ${catalog.sfx.length} SFX files`);
    }

    return catalog;
  } catch (error) {
    console.error('❌ Error loading catalog:', error);
    return catalog;
  }
}

/**
 * Get path to a track by its ID
 * Tries alternate extensions if the exact file is not found
 */
export function getTrackPath(trackId: string): string | null {
  if (!trackId) return null;

  const tryFile = (id: string): string | null => {
    const filePath = path.join(CATALOG_BASE, id);
    return fs.existsSync(filePath) ? filePath : null;
  };

  // 1. Try original
  let result = tryFile(trackId);
  if (result) return result;

  // 2. Try switching extension (.mp3 <-> .wav)
  const ext = path.extname(trackId).toLowerCase();
  const base = trackId.slice(0, -ext.length);

  let altId: string | null = null;
  if (ext === '.mp3') altId = base + '.wav';
  else if (ext === '.wav') altId = base + '.mp3';

  if (altId) {
    result = tryFile(altId);
    if (result) return result;
  }

  console.warn(`⚠️  Track not found: ${path.join(CATALOG_BASE, trackId)} or alternative extension`);
  return null;
}

export interface SceneWithTracks {
  music?: Array<{ track_id?: string }>;
  ambience?: { track_id?: string };
  sfx?: Array<{ track_id?: string }>;
}

/**
 * Validate that all tracks referenced in a scene exist
 */
export function validateSceneTracks(scene: SceneWithTracks): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (scene.music) {
    for (const musicCue of scene.music) {
      if (musicCue.track_id && !getTrackPath(musicCue.track_id)) {
        missing.push(musicCue.track_id);
      }
    }
  }

  if (scene.ambience?.track_id && !getTrackPath(scene.ambience.track_id)) {
    missing.push(scene.ambience.track_id);
  }

  if (scene.sfx) {
    for (const sfxCue of scene.sfx) {
      if (sfxCue.track_id && !getTrackPath(sfxCue.track_id)) {
        missing.push(sfxCue.track_id);
      }
    }
  }

  return { valid: missing.length === 0, missing };
}
