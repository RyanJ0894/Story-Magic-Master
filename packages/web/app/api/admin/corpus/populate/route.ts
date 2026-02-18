/**
 * Corpus Embedding Population Route (Admin)
 *
 * POST /api/admin/corpus/populate - Generate embeddings for scripts without them
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { populateMissingEmbeddings } from '@/lib/comparable/service';
import { log } from '@/lib/logger';

// =============================================================================
// POST - Populate Missing Embeddings
// =============================================================================

export const POST = withAuth(async (request, { userId, prisma }) => {
  // Check if user is admin via profile
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { userType: true },
  });

  if (profile?.userType !== 'admin') {
    return NextResponse.json(
      { error: 'Admin access required', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

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
