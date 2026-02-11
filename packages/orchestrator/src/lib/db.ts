/**
 * Database utilities for voice mapping
 * Uses Prisma raw SQL with local JSON fallback
 */

import fs from 'fs';
import path from 'path';
import { prisma } from './prisma.js';
import { log } from './logger.js';

const localPath = path.join(process.cwd(), 'data', 'voice_map.json');

export interface VoiceMapEntry {
  project_id: string;
  character: string;
  voice_id: string;
  provider: string;
  params_json: Record<string, unknown>;
}

/**
 * Read local voice map from JSON file
 */
function readLocal(): Record<string, VoiceMapEntry> {
  try {
    return JSON.parse(fs.readFileSync(localPath, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Write local voice map to JSON file
 */
function writeLocal(obj: Record<string, VoiceMapEntry>): void {
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, JSON.stringify(obj, null, 2));
}

/**
 * Get voice assignment for a character
 */
export async function getVoiceForCharacter(
  project_id: string,
  character: string
): Promise<VoiceMapEntry | null> {
  try {
    const rows = await prisma.$queryRaw<VoiceMapEntry[]>`
      SELECT project_id, character, voice_id, provider, params_json
      FROM voice_map
      WHERE project_id = ${project_id}
        AND character = ${character}
      LIMIT 1
    `;

    if (rows.length > 0) return rows[0];
  } catch (err) {
    log.error('DB error fetching voice for character', err instanceof Error ? err : undefined, { project_id, character });
  }

  // Fallback to local
  const map = readLocal();
  return map[`${project_id}:${character}`] || null;
}

/**
 * Upsert voice map entry for a character
 */
export async function upsertVoiceMap(
  project_id: string,
  character: string
): Promise<VoiceMapEntry> {
  const row: VoiceMapEntry = {
    project_id,
    character,
    voice_id: '21m00Tcm4TlvDq8ikWAM', // Default ElevenLabs voice
    provider: 'elevenlabs',
    params_json: {
      stability: 0.4,
      similarity_boost: 0.7,
    },
  };

  try {
    await prisma.$executeRaw`
      INSERT INTO voice_map (project_id, character, voice_id, provider, params_json)
      VALUES (${row.project_id}, ${row.character}, ${row.voice_id}, ${row.provider}, ${JSON.stringify(row.params_json)}::jsonb)
      ON CONFLICT (project_id, character)
      DO UPDATE SET voice_id = ${row.voice_id}, provider = ${row.provider}, params_json = ${JSON.stringify(row.params_json)}::jsonb
    `;

    // Read back the upserted row
    const rows = await prisma.$queryRaw<VoiceMapEntry[]>`
      SELECT project_id, character, voice_id, provider, params_json
      FROM voice_map
      WHERE project_id = ${row.project_id}
        AND character = ${row.character}
      LIMIT 1
    `;

    if (rows.length > 0) return rows[0];
    return row;
  } catch (err) {
    log.error('DB upsert error', err instanceof Error ? err : undefined, { project_id, character });
  }

  // Fallback to local
  const map = readLocal();
  map[`${project_id}:${character}`] = row;
  writeLocal(map);
  return row;
}
