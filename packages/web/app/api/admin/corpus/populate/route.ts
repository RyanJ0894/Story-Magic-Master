/**
 * Corpus Embedding Population Route (Admin)
 *
 * POST /api/admin/corpus/populate - Generate embeddings for scripts without them
 */

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { populateMissingEmbeddings } from '@/lib/comparable/service';
import { validateCsrf } from '@/lib/csrf';

// =============================================================================
// POST - Populate Missing Embeddings
// =============================================================================

export async function POST(request: Request) {
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json(
      { error: 'CSRF validation failed', code: 'CSRF_ERROR' },
      { status: 403 }
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

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
    console.error('[Admin] Populate embeddings error:', error);
    return NextResponse.json(
      {
        error: 'Failed to populate embeddings',
        code: 'POPULATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
