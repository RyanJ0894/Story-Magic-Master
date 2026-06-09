/**
 * POST /api/admin/voices/seed
 * Seeds the voice_catalog_entries table from the JSON files shipped with the orchestrator.
 * Safe to call repeatedly — uses upsert (voiceId is unique key).
 */

import { NextResponse } from 'next/server';
import { withAuth, errorResponse } from '@/lib/api/middleware';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { log } from '@/lib/logger';

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

// Paths are relative to packages/web (Next.js process.cwd())
const ORCHESTRATOR_KB = join(process.cwd(), '../orchestrator/knowledge_bases');

export const POST = withAuth(async (_request, { userId, prisma }) => {
  const adminProfile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { userType: true },
  });

  if (adminProfile?.userType !== 'admin') {
    return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
  }

  const fullPath = join(ORCHESTRATOR_KB, 'eleven_labs_voices_current.json');
  const metaPath = join(ORCHESTRATOR_KB, 'voice_embeddings_store/voices_metadata.json');

  if (!existsSync(fullPath)) {
    return errorResponse('Voice catalog JSON not found', 500, { code: 'FILE_NOT_FOUND' });
  }

  const raw = JSON.parse(readFileSync(fullPath, 'utf-8'));
  const entries: CatalogEntry[] = Array.isArray(raw) ? raw : (raw.data || []);

  const metaMap = new Map<string, MetadataEntry>();
  if (existsSync(metaPath)) {
    const meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as MetadataEntry[];
    for (const v of meta) metaMap.set(v.voice_id, v);
  }

  let upserted = 0;
  for (const entry of entries) {
    const rich = metaMap.get(entry.voice_id);
    await prisma.voiceCatalogEntry.upsert({
      where: { voiceId: entry.voice_id },
      create: {
        voiceId: entry.voice_id,
        name: rich?.name ?? `${entry.label} — ${entry.tone} ${entry.style}`.trim(),
        label: entry.label,
        gender: entry.gender,
        style: entry.style,
        tone: entry.tone || null,
        description: rich?.description || null,
        isPlaceholder: entry._placeholder ?? false,
      },
      update: {
        name: rich?.name ?? `${entry.label} — ${entry.tone} ${entry.style}`.trim(),
        label: entry.label,
        gender: entry.gender,
        style: entry.style,
        tone: entry.tone || null,
        description: rich?.description || null,
        isPlaceholder: entry._placeholder ?? false,
      },
    });
    upserted++;
  }

  log.info('[Admin] voice catalog seeded', { userId, upserted });
  return NextResponse.json({ upserted });
});
