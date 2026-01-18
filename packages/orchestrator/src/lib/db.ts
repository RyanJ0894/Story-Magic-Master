/**
 * Database utilities for voice mapping
 * Supports Supabase with local JSON fallback
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Initialize Supabase client if credentials are available
const supabase: SupabaseClient | null =
  process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
    : null;

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
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('voice_map')
        .select('*')
        .eq('project_id', project_id)
        .eq('character', character)
        .maybeSingle();

      if (error) throw error;
      return data as VoiceMapEntry | null;
    } catch (err) {
      console.error('DB error:', err);
    }
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

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('voice_map')
        .upsert(row)
        .select('*')
        .maybeSingle();

      if (error) throw error;
      return (data as VoiceMapEntry) || row;
    } catch (err) {
      console.error('DB upsert error:', err);
    }
  }

  // Fallback to local
  const map = readLocal();
  map[`${project_id}:${character}`] = row;
  writeLocal(map);
  return row;
}
