/**
 * Idempotency utilities for caching TTS stems
 */

import crypto from 'crypto';

/**
 * Create a SHA256 hash of a string
 */
export function hash(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

/**
 * Generate a cache key for a TTS stem
 * Uses underscores instead of colons for Windows compatibility
 */
export function ttsKey(
  project_id: string,
  scene_id: string,
  line_id: string,
  voice_id: string,
  params: Record<string, unknown>,
  text: string
): string {
  const vhash = hash(voice_id + JSON.stringify(params));
  const thash = hash(text);
  return `${project_id}_${scene_id}_${line_id}_${vhash}_${thash}`;
}

// Alias for backwards compatibility
export const ttskey = ttsKey;
