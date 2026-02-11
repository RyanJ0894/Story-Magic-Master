/**
 * Revision Comparison API Route
 *
 * GET /api/revisions/[id]/compare/[toId] - Compare two revisions
 */

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { isFeatureEnabled } from '@/lib/features';
import { compareRevisions } from '@/lib/revisions';

// =============================================================================
// Helper to verify ownership
// =============================================================================

async function verifyRevisionOwnership(
  revisionId: string,
  userId: string
): Promise<boolean> {
  const revision = await prisma.revision.findUnique({
    where: { id: revisionId },
    select: {
      project: { select: { userId: true } },
    },
  });

  if (!revision) return false;

  return revision.project.userId === userId;
}

// =============================================================================
// GET - Compare revisions
// =============================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; toId: string }> }
) {
  if (!isFeatureEnabled('REVISION_TRACKING')) {
    return NextResponse.json(
      { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
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

  const { id: fromRevisionId, toId: toRevisionId } = await params;

  // Verify ownership of both revisions
  const [fromOwned, toOwned] = await Promise.all([
    verifyRevisionOwnership(fromRevisionId, userId),
    verifyRevisionOwnership(toRevisionId, userId),
  ]);

  if (!fromOwned || !toOwned) {
    return NextResponse.json(
      { error: 'One or both revisions not found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  try {
    const comparison = await compareRevisions(fromRevisionId, toRevisionId);

    // Don't send full script text in comparison response
    const sanitizedComparison = {
      fromRevision: {
        id: comparison.fromRevision.id,
        versionNumber: comparison.fromRevision.versionNumber,
        label: comparison.fromRevision.label,
        wordCount: comparison.fromRevision.wordCount,
        pageCount: comparison.fromRevision.pageCount,
        overallScore: comparison.fromRevision.overallScore,
        createdAt: comparison.fromRevision.createdAt,
      },
      toRevision: {
        id: comparison.toRevision.id,
        versionNumber: comparison.toRevision.versionNumber,
        label: comparison.toRevision.label,
        wordCount: comparison.toRevision.wordCount,
        pageCount: comparison.toRevision.pageCount,
        overallScore: comparison.toRevision.overallScore,
        createdAt: comparison.toRevision.createdAt,
      },
      changes: comparison.changes,
      diff: comparison.diff,
      scoreComparison: comparison.scoreComparison,
    };

    return NextResponse.json({ comparison: sanitizedComparison });
  } catch (error) {
    console.error('[Revision Compare] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to compare revisions',
        code: 'COMPARE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
