import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// vi.mock factories are hoisted above imports.
vi.mock('./prisma.js', () => ({
  prisma: {
    voiceCatalogEntry: {
      count: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('./logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('./sentry.js', () => ({
  Sentry: { captureMessage: vi.fn(), addBreadcrumb: vi.fn() },
}));

import { syncVoiceCatalog, seedVoiceCatalogIfEmpty } from './seed-voice-catalog.js';
import { prisma } from './prisma.js';
import { log } from './logger.js';

const mockCount = prisma.voiceCatalogEntry.count as ReturnType<typeof vi.fn>;
const mockUpsert = prisma.voiceCatalogEntry.upsert as ReturnType<typeof vi.fn>;
const mockUpdateMany = prisma.voiceCatalogEntry.updateMany as ReturnType<typeof vi.fn>;
const mockLogInfo = log.info as ReturnType<typeof vi.fn>;
const mockLogWarn = log.warn as ReturnType<typeof vi.fn>;

describe('syncVoiceCatalog (2026-06-14 — sync on every boot, not only when empty)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts every JSON entry even when the DB already has rows', async () => {
    // Previously this case returned early. Now it must upsert so JSON edits
    // (label fixes, new voices, retired voices) actually reach the DB.
    mockCount.mockResolvedValue(29);
    mockUpsert.mockResolvedValue({});
    mockUpdateMany.mockResolvedValue({ count: 0 });

    await syncVoiceCatalog();

    expect(mockUpsert.mock.calls.length).toBeGreaterThanOrEqual(10);
  });

  it('upserts every JSON entry when the table is empty', async () => {
    mockCount.mockResolvedValue(0);
    mockUpsert.mockResolvedValue({});
    mockUpdateMany.mockResolvedValue({ count: 0 });

    await syncVoiceCatalog();

    expect(mockUpsert.mock.calls.length).toBeGreaterThanOrEqual(10);
    expect(mockLogInfo).toHaveBeenCalledWith(
      '[voice-catalog] sync complete',
      expect.objectContaining({
        upserted: expect.any(Number),
        sourceUnique: expect.any(Number),
      }),
    );
  });

  it('still proceeds when the initial count() fails (degraded DB during boot)', async () => {
    mockCount.mockRejectedValue(new Error('connection refused'));
    mockUpsert.mockResolvedValue({});
    mockUpdateMany.mockResolvedValue({ count: 0 });

    await syncVoiceCatalog();

    expect(mockLogWarn).toHaveBeenCalled();
    // Sync still ran because the upsert path doesn't depend on the count.
    expect(mockUpsert.mock.calls.length).toBeGreaterThanOrEqual(10);
  });

  it('deactivates DB rows whose voice_ids are no longer in the JSON', async () => {
    mockCount.mockResolvedValue(35);
    mockUpsert.mockResolvedValue({});
    mockUpdateMany.mockResolvedValue({ count: 6 });

    await syncVoiceCatalog();

    const calls = mockUpdateMany.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const args = calls[0][0];
    expect(args.where.voiceId).toHaveProperty('notIn');
    expect(args.where.isActive).toBe(true);
    expect(args.data).toEqual({ isActive: false });
  });

  it('back-compat alias seedVoiceCatalogIfEmpty still works', async () => {
    mockCount.mockResolvedValue(0);
    mockUpsert.mockResolvedValue({});
    mockUpdateMany.mockResolvedValue({ count: 0 });
    expect(typeof seedVoiceCatalogIfEmpty).toBe('function');
    expect(seedVoiceCatalogIfEmpty).toBe(syncVoiceCatalog);
    await seedVoiceCatalogIfEmpty();
    expect(mockUpsert).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Catalog file integrity — guards the SOURCE of truth, not the runtime sync.
// ---------------------------------------------------------------------------

describe('eleven_labs_voices_current.json (source-of-truth integrity)', () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const CATALOG_PATH = join(__dirname, '../../knowledge_bases/eleven_labs_voices_current.json');

  it('parses cleanly', () => {
    const raw = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'));
    const entries = Array.isArray(raw) ? raw : raw.data ?? raw.voices ?? [];
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
  });

  // Pure invariant — no duplicates allowed. The 2026-06-14 dupes were
  // resolved when the catalog was rebuilt from the live grant account's
  // /v1/voices output (137 unique voice_ids, source-of-truth). Was briefly
  // marked .fails while we waited for resolution; that's now off, so any
  // future re-introduction of a duplicate voice_id fails CI immediately.
  it('has no duplicate voice_ids (catches a future regression of the 2026-06-14 dup bug)', () => {
    // Three voice_ids in the source JSON had two different label rows on
    // 2026-06-14. The voice-assignment LLM saw the same ID labeled both
    // 'Female - 20s to 30s' AND 'Female Teen' and produced non-deterministic
    // age picks. Email sent to Ryan to resolve the conflicting labels; this
    // test fails until the JSON is deduped, so the resolution can't slip.
    const raw = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'));
    const entries = Array.isArray(raw) ? raw : raw.data ?? raw.voices ?? [];

    const ids: string[] = entries
      .map((e: { voice_id?: string }) => e.voice_id)
      .filter((x: unknown): x is string => typeof x === 'string');
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) dupes.add(id);
      seen.add(id);
    }

    if (dupes.size > 0) {
      const detail = Array.from(dupes).map((id) => {
        const labels = entries
          .filter((e: { voice_id?: string }) => e.voice_id === id)
          .map((e: { label?: string }) => e.label ?? '(no label)');
        return `${id}: ${labels.join(' vs ')}`;
      });
      throw new Error(
        `duplicate voice_ids in eleven_labs_voices_current.json:\n  ${detail.join('\n  ')}`,
      );
    }
    expect(dupes.size).toBe(0);
  });

  it('every entry has voice_id, label, and gender (the LLM-visible fields)', () => {
    const raw = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'));
    const entries = Array.isArray(raw) ? raw : raw.data ?? raw.voices ?? [];
    for (const e of entries) {
      expect(e.voice_id, JSON.stringify(e)).toBeTruthy();
      expect(e.label, JSON.stringify(e)).toBeTruthy();
      expect(e.gender, JSON.stringify(e)).toBeTruthy();
    }
  });
});
