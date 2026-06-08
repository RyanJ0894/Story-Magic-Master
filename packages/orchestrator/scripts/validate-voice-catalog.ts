/**
 * validate-voice-catalog.ts
 *
 * Cross-references the local voice catalog (JSON files) against the ElevenLabs
 * account to identify missing, placeholder, and unused voices.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=<key> npx tsx scripts/validate-voice-catalog.ts
 *   doppler run -- npx tsx scripts/validate-voice-catalog.ts
 *
 * Output: human-readable report to stdout. Exit 0 if all catalog voices verified,
 * exit 1 if any are missing from the ElevenLabs account.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const KB = join(__dirname, '../knowledge_bases');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CatalogEntry {
  voice_id: string;
  label: string;
  gender: string;
  tone: string;
  style: string;
  _placeholder?: boolean;
}

interface MetadataEntry {
  voice_id: string;
  name: string;
  label: string;
  gender: string;
  style: string;
  tone?: string;
  description?: string;
}

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  labels?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Load catalog
// ---------------------------------------------------------------------------

function loadCatalog(): CatalogEntry[] {
  const path = join(KB, 'eleven_labs_voices_current.json');
  if (!existsSync(path)) {
    console.error(`ERROR: Catalog not found at ${path}`);
    process.exit(2);
  }
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  return Array.isArray(raw) ? raw : (raw.data || []);
}

function loadMetadata(): Map<string, MetadataEntry> {
  const path = join(KB, 'voice_embeddings_store/voices_metadata.json');
  const map = new Map<string, MetadataEntry>();
  if (!existsSync(path)) return map;
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as MetadataEntry[];
  for (const v of raw) map.set(v.voice_id, v);
  return map;
}

// ---------------------------------------------------------------------------
// Fetch from ElevenLabs
// ---------------------------------------------------------------------------

async function fetchAccountVoices(): Promise<Map<string, ElevenLabsVoice>> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('ERROR: ELEVENLABS_API_KEY not set');
    process.exit(2);
  }

  const map = new Map<string, ElevenLabsVoice>();
  let page = 0;

  while (true) {
    const url = `https://api.elevenlabs.io/v1/voices?page_size=100&page=${page}`;
    const res = await fetch(url, { headers: { 'xi-api-key': apiKey } });
    if (!res.ok) {
      console.error(`ERROR: ElevenLabs API returned ${res.status}: ${await res.text()}`);
      process.exit(2);
    }
    const data = await res.json() as { voices: ElevenLabsVoice[]; has_more: boolean };
    for (const v of data.voices) map.set(v.voice_id, v);
    if (!data.has_more) break;
    page++;
  }

  return map;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Loading voice catalog…');
  const catalog = loadCatalog();
  const metadata = loadMetadata();
  console.log(`Catalog: ${catalog.length} entries, ${metadata.size} with rich metadata`);

  console.log('Fetching voices from ElevenLabs account…');
  const accountVoices = await fetchAccountVoices();
  console.log(`ElevenLabs account: ${accountVoices.size} voices\n`);

  const missing: CatalogEntry[] = [];
  const placeholders: CatalogEntry[] = [];
  const verified: CatalogEntry[] = [];

  for (const entry of catalog) {
    if (entry._placeholder) {
      placeholders.push(entry);
      continue;
    }
    if (accountVoices.has(entry.voice_id)) {
      verified.push(entry);
    } else {
      missing.push(entry);
    }
  }

  // Voices in account but not in catalog
  const catalogIds = new Set(catalog.map((v) => v.voice_id));
  const inAccountNotCatalog = Array.from(accountVoices.values()).filter(
    (v) => !catalogIds.has(v.voice_id)
  );

  // ---------------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------------

  if (missing.length > 0) {
    console.log(`MISSING FROM ELEVENLABS ACCOUNT (will silently fall back at TTS time):`);
    for (const v of missing) {
      const name = metadata.get(v.voice_id)?.name ?? `${v.label} / ${v.gender} / ${v.style} / ${v.tone}`;
      console.log(`  ✗ ${v.voice_id}  ${name}`);
    }
    console.log();
  }

  if (placeholders.length > 0) {
    console.log(`PLACEHOLDER ENTRIES (need replacement):`);
    for (const v of placeholders) {
      const name = metadata.get(v.voice_id)?.name ?? `${v.label} / ${v.gender} / ${v.style}`;
      console.log(`  ⚠ ${v.voice_id}  ${v.label} / ${v.gender} / ${v.style}  [${name}]`);
    }
    console.log();
  }

  if (inAccountNotCatalog.length > 0) {
    console.log(`IN ELEVENLABS ACCOUNT BUT NOT IN CATALOG (candidates to add):`);
    for (const v of inAccountNotCatalog) {
      const labels = Object.entries(v.labels ?? {}).map(([k, val]) => `${k}:${val}`).join(', ');
      console.log(`  + ${v.voice_id}  ${v.name}  [${labels}]`);
    }
    console.log();
  }

  const total = catalog.length;
  const verifiedCount = verified.length;
  const status = missing.length === 0 ? '✓ OK' : `✗ ${missing.length} missing`;
  console.log(`CATALOG: ${verifiedCount}/${total} voices verified (${placeholders.length} placeholders, ${missing.length} missing)  ${status}`);

  if (missing.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(2);
});
