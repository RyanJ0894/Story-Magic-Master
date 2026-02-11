/**
 * Storage utilities for TTS stems
 * Local filesystem only (Render Disk at /var/data/audio)
 */

import fs from 'fs';
import path from 'path';
import { log } from './logger.js';

const localBase = path.join(process.cwd(), 'data', 'stems');

export interface StemResult {
  path: string;
}

/**
 * Read stem by cache key
 * Checks local filesystem
 */
export async function readStemByKey(key: string): Promise<StemResult | null> {
  const localPath = path.join(localBase, key + '.wav');

  // Check local
  if (fs.existsSync(localPath)) {
    return { path: localPath };
  }

  return null;
}

/**
 * Write stem to local storage
 */
export async function writeStem(
  project_id: string,
  scene_id: string,
  line_id: string,
  wavBuffer: Buffer,
  key?: string
): Promise<string> {
  const filename = key || `${project_id}_${scene_id}_${line_id}`;
  const localPath = path.join(localBase, filename + '.wav');

  // Write locally
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, wavBuffer);

  return localPath;
}
