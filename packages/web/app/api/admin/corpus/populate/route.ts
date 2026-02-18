/**
 * Corpus Embedding Population Route (Admin)
 *
 * POST /api/admin/corpus/populate - Generate embeddings for scripts without them
 */

import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/middleware';
import { populateMissingEmbeddings } from '@/lib/comparable/service';
import { log } from '@/lib/logger';

// =============================================================================
// POST - Populate Missing Embeddings
// =============================================================================

export const POST = withAdminAuth(async (request, { userId, prisma }) => {
  try {
    const updatedCount = await populateMissingEmbeddings();

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      message: `Generated embeddings for ${updatedCount} scripts`,
    });
  } catch (error) {
    log.error('[Admin] Populate embeddings error', error);
    return NextResponse.json(
      {
        error: 'Failed to populate embeddings',
        code: 'POPULATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});
