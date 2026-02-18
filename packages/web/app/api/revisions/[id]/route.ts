/**
 * Individual Revision API Route
 *
 * GET /api/revisions/[id] - Get revision details
 * PUT /api/revisions/[id] - Update revision (label)
 * DELETE /api/revisions/[id] - Delete revision
 */

import { withAuth } from '@/lib/api/middleware';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isFeatureEnabled } from '@/lib/features';
import {
  getRevision,
  updateRevisionLabel,
  deleteRevision,
} from '@/lib/revisions';
import { log } from '@/lib/logger';

// =============================================================================
// Validation
// =============================================================================

const UpdateRevisionSchema = z.object({
  label: z.string().min(1).max(200),
});

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
// GET - Get revision details
// =============================================================================

export const GET = withAuth(async (_request, { userId, params }) => {
  if (!isFeatureEnabled('REVISION_TRACKING')) {
    return NextResponse.json(
      { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
      { status: 403 }
    );
  }

  const revisionId = params.id;

  const owned = await verifyRevisionOwnership(revisionId, userId);
  if (!owned) {
    return NextResponse.json(
      { error: 'Revision not found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  try {
    const revision = await getRevision(revisionId);
    if (!revision) {
      return NextResponse.json(
        { error: 'Revision not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({ revision });
  } catch (error) {
    log.error('[Revision] Error fetching', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch revision',
        code: 'FETCH_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});

// =============================================================================
// PUT - Update revision
// =============================================================================

export const PUT = withAuth(async (request, { userId, params }) => {
  if (!isFeatureEnabled('REVISION_TRACKING')) {
    return NextResponse.json(
      { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
      { status: 403 }
    );
  }

  const revisionId = params.id;

  const owned = await verifyRevisionOwnership(revisionId, userId);
  if (!owned) {
    return NextResponse.json(
      { error: 'Revision not found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'PARSE_ERROR' },
      { status: 400 }
    );
  }

  const parseResult = UpdateRevisionSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: 'Invalid request',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  try {
    const revision = await updateRevisionLabel(revisionId, parseResult.data.label);
    return NextResponse.json({
      success: true,
      revision,
    });
  } catch (error) {
    log.error('[Revision] Error updating', error);
    return NextResponse.json(
      {
        error: 'Failed to update revision',
        code: 'UPDATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});

// =============================================================================
// DELETE - Delete revision
// =============================================================================

export const DELETE = withAuth(async (_request, { userId, params }) => {
  if (!isFeatureEnabled('REVISION_TRACKING')) {
    return NextResponse.json(
      { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
      { status: 403 }
    );
  }

  const revisionId = params.id;

  const owned = await verifyRevisionOwnership(revisionId, userId);
  if (!owned) {
    return NextResponse.json(
      { error: 'Revision not found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  try {
    await deleteRevision(revisionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('[Revision] Error deleting', error);
    return NextResponse.json(
      {
        error: 'Failed to delete revision',
        code: 'DELETE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});
