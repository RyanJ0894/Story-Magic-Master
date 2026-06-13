/**
 * Voice catalog auto-seed
 * =======================
 *
 * Background: the orchestrator's voice search reads from
 * `voice_catalog_entries` (a DB-backed table) with a JSON-file fallback.
 * When the table is empty — a freshly migrated DB, a restored snapshot, a
 * staging env nobody seeded — every search falls through. Two outcomes:
 *
 *   1. JSON files exist → the orch uses them. Works, but no admin can
 *      manage the catalog through the DB because the DB is empty.
 *   2. JSON files missing → only DEFAULT_VOICES (3 hardcoded entries)
 *      remain, and every project ends up cast with George/Will/Jessica.
 *
 * Symptom Ryan reported on 2026-06-13 was outcome 1: "custom catalog
 * isn't getting used". Empirically: `SELECT COUNT(*) FROM
 * voice_catalog_entries` returned 0 in prod even though migration 0034
 * had created the table.
 *
 * This module runs once at orchestrator startup, after a 2-second delay
 * so it doesn't block the server from binding. If the DB has zero rows
 * and the catalog JSON is reachable, it bulk-upserts every entry, then
 * logs the row count. Idempotent — safe to invoke on every boot.
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

export async function seedVoiceCatalogIfEmpty(): Promise<void> {
  let existing: number;
  try {
    existing = await prisma.voiceCatalogEntry.count();
  } catch (err) {
    log.warn('[seed-voice-catalog] DB count failed, skipping seed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  if (existing > 0) {
    log.debug('[seed-voice-catalog] table populated, no seed needed', { existing });
    return;
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

  let upserted = 0;
  for (const v of entries) {
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

  log.info('[seed-voice-catalog] seeded voice catalog from JSON', { upserted, sourceEntries: entries.length });
}
