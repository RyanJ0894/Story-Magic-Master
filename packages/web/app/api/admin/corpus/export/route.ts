/**
 * Corpus Export Route (Admin)
 *
 * GET /api/admin/corpus/export - Download corpus scores as CSV
 */

import { withAdminAuth } from '@/lib/api/middleware';
import { log } from '@/lib/logger';

// =============================================================================
// GET - Export corpus as CSV
// =============================================================================

export const GET = withAdminAuth(async (_request, { prisma }) => {
  try {
    const scripts = await prisma.scriptCorpus.findMany({
      where: { datasetCategory: { not: null } },
      select: {
        title: true,
        datasetCategory: true,
        genre: true,
        pageCount: true,
        sceneCount: true,
        dialoguePct: true,
        conflictDensity: true,
        corpusScores: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            overallScore: true,
            conceptScore: true,
            structureScore: true,
            characterScore: true,
            craftScore: true,
            confidence: true,
            modelVersion: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ datasetCategory: 'asc' }, { title: 'asc' }],
    });

    const header = [
      'Title',
      'Category',
      'Genre',
      'Pages',
      'Scenes',
      'Dialogue%',
      'ConflictDensity',
      'Overall',
      'Concept',
      'Structure',
      'Character',
      'Craft',
      'Confidence',
      'Model',
      'ScoredAt',
    ].join(',');

    const rows = scripts.map(s => {
      const score = s.corpusScores[0];
      return [
        csvEscape(s.title),
        csvEscape(s.datasetCategory ?? ''),
        csvEscape(s.genre.join('|')),
        s.pageCount ?? '',
        s.sceneCount ?? '',
        s.dialoguePct != null ? Number(s.dialoguePct).toFixed(1) : '',
        s.conflictDensity != null ? Number(s.conflictDensity).toFixed(2) : '',
        score ? Number(score.overallScore).toFixed(2) : '',
        score ? Number(score.conceptScore).toFixed(2) : '',
        score ? Number(score.structureScore).toFixed(2) : '',
        score ? Number(score.characterScore).toFixed(2) : '',
        score ? Number(score.craftScore).toFixed(2) : '',
        score ? Number(score.confidence).toFixed(2) : '',
        score ? csvEscape(score.modelVersion) : '',
        score ? score.createdAt.toISOString() : '',
      ].join(',');
    });

    const csv = [header, ...rows].join('\n');
    const date = new Date().toISOString().slice(0, 10);

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="storyscore-corpus-${date}.csv"`,
      },
    });
  } catch (error) {
    log.error('[Admin] Corpus export error', error);
    return new Response(JSON.stringify({ error: 'Export failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}, { rateLimit: 'strict' });

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
