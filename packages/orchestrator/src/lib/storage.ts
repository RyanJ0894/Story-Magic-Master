/**
 * Storage utilities for TTS stems
 * Supports local filesystem with Supabase fallback
 */

import fs from 'fs';
import path from 'path';
import { supabaseServiceClient as supabase } from './supabase.js';
import { log } from './logger.js';

const localBase = path.join(process.cwd(), 'data', 'stems');

export interface StemResult {
  path: string;
}

/**
 * Read stem by cache key
 * Checks local filesystem first, then Supabase
 */
export async function readStemByKey(key: string): Promise<StemResult | null> {
  const localPath = path.join(localBase, key + '.wav');

  // Check local first
  if (fs.existsSync(localPath)) {
    return { path: localPath };
  }

  // Try Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase.storage
        .from('stems')
        .download(key + '.wav');

      if (error || !data) return null;

      const buffer = Buffer.from(await data.arrayBuffer());
      fs.mkdirSync(localBase, { recursive: true });
      fs.writeFileSync(localPath, buffer);

      return { path: localPath };
    } catch (err) {
      log.error('Supabase download error', err instanceof Error ? err : undefined, { key });
      return null;
    }
  }

  return null;
}

/**
 * Write stem to storage
 * Writes locally and optionally uploads to Supabase
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

  // Upload to Supabase if available
  if (supabase) {
    try {
      await supabase.storage.from('stems').upload(filename + '.wav', wavBuffer, {
        contentType: 'audio/wav',
        upsert: true,
      });
    } catch (err) {
      log.error('Supabase upload error', err instanceof Error ? err : undefined, { filename });
    }
  }

  return localPath;
}
