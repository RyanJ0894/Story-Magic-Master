/**
 * Voice catalog sync
 * ==================
 *
 * Runs once per orchestrator boot (via the H2 boot-seed framework, after
 * a ~2 s delay so it doesn't block port binding). Upserts every voice
 * from the source-of-truth JSON catalog into the `voice_catalog_entries`
 * DB table, then logs the row count.
 *
 * Why on every boot, not just when empty (2026-06-14 fix):
 *   The original `seedVoiceCatalogIfEmpty` function only fired when the
 *   table had zero rows. That worked on first deploy but meant ANY later
 *   edit to the JSON catalog — adding a voice, renaming a label, fixing
 *   a gender tag — never reached the DB. The system silently froze at
 *   first-seed state. Same class of bug as the whisper persistent-disk
 *   issue caught the same day: works once, silently ignores all updates.
 *
 *   This rewrite runs the upsert unconditionally. The upsert is idempotent
 *   per voice_id, so re-running it on every boot is safe and cheap (~50 ms
 *   for the current 29 voices). DB rows whose voice_ids no longer appear
 *   in the JSON are left in place but marked `isActive=false` so admin-
 *   curated voices Ryan removed don't keep getting reassigned.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { prisma } from './prisma.js';
import { log } from './logger.js';
import { Sentry } from './sentry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FULL_CATALOG_PATH = join(__dirname, '../../knowledge_bases/eleven_labs_voices_current.json');
const METADATA_PATH = join(__dirname, '../../knowledge_bases/voice_embeddings_store/voices_metadata.json');

interface FullCatalogEntry {
  voice_id: string;
  label: string;
  gender: string;
  tone?: string;
  style?: string;
  _placeholder?: boolean;
}

interface MetadataEntry {
  voice_id: string;
  name: string;
  description?: string;
}

export async function syncVoiceCatalog(): Promise<void> {
  // We don't gate on the row count any more — see the module-level comment.
  // We DO still log the existing count so deploy logs show the before/after
  // and an operator can see "29 existing, 29 upserted" as a sanity check.
  let existing: number = -1;
  try {
    existing = await prisma.voiceCatalogEntry.count();
  } catch (err) {
    log.warn('[voice-catalog] DB count failed before sync, continuing', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (!existsSync(FULL_CATALOG_PATH)) {
    log.warn('[seed-voice-catalog] catalog JSON not shipped — orchestrator will fall back to DEFAULT_VOICES (3 entries)', {
      path: FULL_CATALOG_PATH,
    });
    Sentry.captureMessage('Voice catalog empty AND JSON missing — degraded to DEFAULT_VOICES', {
      level: 'warning',
      tags: { kind: 'voice-catalog-missing' },
      extra: { catalogPath: FULL_CATALOG_PATH },
    });
    return;
  }

  let entries: FullCatalogEntry[];
  try {
    const raw = JSON.parse(readFileSync(FULL_CATALOG_PATH, 'utf-8'));
    entries = Array.isArray(raw) ? raw : raw.data ?? [];
  } catch (err) {
    log.error('[seed-voice-catalog] catalog JSON unparseable', err instanceof Error ? err : undefined);
    return;
  }

  const metaById = new Map<string, MetadataEntry>();
  if (existsSync(METADATA_PATH)) {
    try {
      const meta = JSON.parse(readFileSync(METADATA_PATH, 'utf-8')) as MetadataEntry[];
      for (const m of meta) metaById.set(m.voice_id, m);
    } catch (err) {
      log.warn('[seed-voice-catalog] metadata JSON unparseable, continuing with labels only', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Track which voice_ids appear in the JSON so we can deactivate DB
  // entries that have been pulled from the catalog (e.g., a voice we
  // intentionally retired). We never DELETE — admins may still want to
  // see the row for analytics / past-job lookups — but `isActive=false`
  // keeps it out of voice-assignment results.
  const jsonVoiceIds = new Set<string>();
  let upserted = 0;
  for (const v of entries) {
    jsonVoiceIds.add(v.voice_id);
    const rich = metaById.get(v.voice_id);
    const name = rich?.name ?? `${v.label} — ${v.tone ?? ''} ${v.style ?? ''}`.trim();
    try {
      await prisma.voiceCatalogEntry.upsert({
        where: { voiceId: v.voice_id },
        create: {
          voiceId: v.voice_id,
          name,
          label: v.label,
          gender: v.gender,
          style: v.style ?? '',
          tone: v.tone ?? null,
          description: rich?.description ?? null,
          isPlaceholder: v._placeholder ?? false,
        },
        update: {
          name,
          label: v.label,
          gender: v.gender,
          style: v.style ?? '',
          tone: v.tone ?? null,
          description: rich?.description ?? null,
          isPlaceholder: v._placeholder ?? false,
          isActive: true,
        },
      });
      upserted++;
    } catch (err) {
      log.warn('[seed-voice-catalog] upsert failed for one row, continuing', {
        voiceId: v.voice_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Deactivate rows for voice_ids that no longer appear in the JSON.
  // updateMany is a single SQL statement so this is cheap.
  let deactivated = 0;
  if (jsonVoiceIds.size > 0) {
    try {
      const result = await prisma.voiceCatalogEntry.updateMany({
        where: {
          voiceId: { notIn: Array.from(jsonVoiceIds) },
          isActive: true,
        },
        data: { isActive: false },
      });
      deactivated = result.count;
    } catch (err) {
      log.warn('[voice-catalog] failed to deactivate stale entries — continuing', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  log.info('[voice-catalog] sync complete', {
    sourceEntries: entries.length,
    sourceUnique: jsonVoiceIds.size,
    upserted,
    deactivated,
    existingBefore: existing,
  });
}

// Back-compat alias — index.ts registered the previous name with the H2 boot
// framework. Keeping the export means a partial rollout (orchestrator on the
// new code, anything else on the old name) doesn't break.
export const seedVoiceCatalogIfEmpty = syncVoiceCatalog;
