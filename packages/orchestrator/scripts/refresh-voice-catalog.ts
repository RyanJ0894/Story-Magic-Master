/**
 * Refreshes the local voice catalog from Ryan's live ElevenLabs account.
 *
 * Run with:  pnpm refresh:voices
 *
 * What it does:
 *   1. Calls GET /v1/voices with ELEVENLABS_API_KEY
 *   2. Rebuilds eleven_labs_voices_current.json (29 → N entries)
 *   3. Reconciles voices_metadata.json labels to match current.json
 *   4. Verifies the three hardcoded default voice IDs are still present
 *   5. Prints a staleness summary (added / removed / unchanged)
 *
 * Run this whenever Ryan adds or removes voices in his ElevenLabs account.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const KNOWLEDGE_BASE = path.join(__dirname, '../knowledge_bases');
const CURRENT_PATH = path.join(KNOWLEDGE_BASE, 'eleven_labs_voices_current.json');
const METADATA_PATH = path.join(KNOWLEDGE_BASE, 'voice_embeddings_store/voices_metadata.json');

// These three must always be in the catalog — they are hardcoded fallback defaults
const REQUIRED_IDS = {
  narrator: 'JBFqnCBsd6RMkjVDRZzb',
  male:     'bIHbv24MWmeRgasZH58o',
  female:   'cgSgspJ2msm6clMCkdW9',
};

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  labels?: {
    gender?: string;
    age?: string;
    accent?: string;
    use_case?: string;
    description?: string;
  };
  category?: string;
}

interface CatalogEntry {
  label: string;
  voice_id: string;
  gender: 'Male' | 'Female';
  tone: string;
  style: string;
}

interface MetadataEntry {
  voice_id: string;
  name: string;
  gender: string;
  label: string;
  style: string;
  tone: string;
  description: string;
}

function deriveLabel(v: ElevenLabsVoice, gender: string): string {
  const age = v.labels?.age ?? '';
  const useCase = v.labels?.use_case ?? '';
  const name = v.name.toLowerCase();

  if (useCase === 'narrative_story' || name.includes('george')) return 'Narrator';
  if (age === 'young' && gender === 'Male') return 'Male 20s to 30s';
  if (age === 'young' && gender === 'Female') return 'Female - 20s to 30s';
  if (age === 'young_adult' && gender === 'Male') return 'Male 20s to 30s';
  if (age === 'young_adult' && gender === 'Female') return 'Female - 20s to 30s';
  if ((age === 'middle_aged' || age === 'old') && gender === 'Male') return 'Older Male';
  if ((age === 'middle_aged' || age === 'old') && gender === 'Female') return 'Older Female';
  if (age === 'teen' && gender === 'Male') return 'Male Teen';
  if (age === 'teen' && gender === 'Female') return 'Female Teen';
  return gender === 'Male' ? 'Older Male' : 'Older Female';
}

function deriveTone(v: ElevenLabsVoice): string {
  const desc = (v.labels?.description ?? '').toLowerCase();
  if (/classy|formal|mature|calm|chill|casual|crisp/.test(desc)) return 'Calm';
  if (/professional/.test(desc)) return 'Professional';
  if (/energetic|hyped|upbeat|confident|sassy/.test(desc)) return 'Energetic';
  if (/rough|fierce/.test(desc)) return 'Deep';
  if (/cute|warm/.test(desc)) return 'Warm';
  return 'Calm';
}

function deriveStyle(v: ElevenLabsVoice): string {
  const accent = (v.labels?.accent ?? '').toLowerCase();
  if (accent.includes('british')) return 'British';
  if (accent.includes('australian')) return 'Australian';
  return 'American';
}

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('ERROR: ELEVENLABS_API_KEY not set');
    process.exit(1);
  }

  console.log('Fetching voices from ElevenLabs...');
  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
  });
  if (!res.ok) {
    console.error(`ERROR: ElevenLabs API returned ${res.status}`);
    process.exit(1);
  }

  const data = await res.json() as { voices: ElevenLabsVoice[] };
  const liveVoices = data.voices;
  console.log(`  Got ${liveVoices.length} voices from API`);

  // Load existing catalog to preserve hand-crafted entries
  const existing: CatalogEntry[] = JSON.parse(fs.readFileSync(CURRENT_PATH, 'utf-8'));
  const existingById = new Map(existing.map(e => [e.voice_id, e]));
  const liveIds = new Set(liveVoices.map(v => v.voice_id));

  const removed = existing.filter(e => !liveIds.has(e.voice_id));
  const added = liveVoices.filter(v => !existingById.has(v.voice_id));
  const unchanged = existing.filter(e => liveIds.has(e.voice_id));

  console.log(`  Unchanged: ${unchanged.length} | Added: ${added.length} | Removed: ${removed.length}`);

  // Build new catalog — preserve existing entries, generate new ones
  const newCatalog: CatalogEntry[] = [];
  for (const v of liveVoices) {
    const prior = existingById.get(v.voice_id);
    if (prior) {
      newCatalog.push(prior);
    } else {
      const rawGender = v.labels?.gender ?? 'male';
      const gender: 'Male' | 'Female' = rawGender.toLowerCase().includes('female') ? 'Female' : 'Male';
      newCatalog.push({
        label: deriveLabel(v, gender),
        voice_id: v.voice_id,
        gender,
        tone: deriveTone(v),
        style: deriveStyle(v),
      });
    }
  }

  // Check required default IDs
  for (const [role, id] of Object.entries(REQUIRED_IDS)) {
    if (!liveIds.has(id)) {
      console.warn(`WARNING: default ${role} voice ${id} is no longer in the account. Hardcoded fallback will be invalid.`);
    }
  }

  fs.writeFileSync(CURRENT_PATH, JSON.stringify(newCatalog, null, 2));
  console.log(`  Wrote ${newCatalog.length} entries to ${path.basename(CURRENT_PATH)}`);

  // Reconcile voices_metadata.json — update label/tone/style to match current.json
  const newById = new Map(newCatalog.map(e => [e.voice_id, e]));
  const metadata: MetadataEntry[] = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8'));
  let reconciled = 0;

  for (const m of metadata) {
    const cur = newById.get(m.voice_id);
    if (cur) {
      for (const field of ['label', 'tone', 'style'] as const) {
        if (cur[field] && m[field] !== cur[field]) {
          m[field] = cur[field];
          reconciled++;
        }
      }
    }
  }
  // Add metadata stubs for any new voices not yet in metadata
  const metadataIds = new Set(metadata.map(m => m.voice_id));
  for (const v of added) {
    if (!metadataIds.has(v.voice_id)) {
      const entry = newById.get(v.voice_id)!;
      metadata.push({
        voice_id: v.voice_id,
        name: v.name,
        gender: entry.gender,
        label: entry.label,
        style: entry.style,
        tone: entry.tone,
        description: v.labels?.description ?? '',
      });
    }
  }
  // Remove metadata entries for voices no longer in account
  const updatedMetadata = metadata.filter(m => liveIds.has(m.voice_id));

  fs.writeFileSync(METADATA_PATH, JSON.stringify(updatedMetadata, null, 2));
  console.log(`  Reconciled ${reconciled} label/tone/style fields in ${path.basename(METADATA_PATH)}`);
  console.log(`  voices_metadata.json: ${updatedMetadata.length} entries`);

  if (removed.length > 0) {
    console.log('\nRemoved voices (no longer in account):');
    removed.forEach(v => console.log(`  - ${v.voice_id} (${v.label})`));
  }
  if (added.length > 0) {
    console.log('\nAdded voices (new in account):');
    added.forEach(v => console.log(`  + ${v.voice_id} ${v.name}`));
  }

  console.log('\nDone. Commit both JSON files and push to trigger Render deploy.');
}

main().catch((e) => { console.error(e); process.exit(1); });
