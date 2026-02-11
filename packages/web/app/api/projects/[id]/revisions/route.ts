/**
 * Revisions API Route
 *
 * GET /api/projects/[id]/revisions - List revisions and timeline
 * POST /api/projects/[id]/revisions - Create a new revision
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isFeatureEnabled } from '@/lib/features';
import { withProjectAuth } from '@/lib/api/middleware';
import {
  getRevisions,
  getRevisionTimeline,
  createRevision,
} from '@/lib/revisions';

// =============================================================================
// Validation
// =============================================================================

const CreateRevisionSchema = z.object({
  scriptText: z.string().min(1, 'Script text is required'),
  label: z.string().optional(),
  autoScore: z.boolean().optional(),
});

// =============================================================================
// GET - List revisions
// =============================================================================

export const GET = withProjectAuth(
  async (request, { projectId }) => {
    if (!isFeatureEnabled('REVISION_TRACKING')) {
      return NextResponse.json(
        { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
        { status: 403 }
      );
    }

    try {
      // Check if timeline is requested
      const url = new URL(request.url);
      const includeTimeline = url.searchParams.get('timeline') === 'true';

      if (includeTimeline) {
        const timeline = await getRevisionTimeline(projectId);
        return NextResponse.json({ timeline });
      }

      const revisions = await getRevisions(projectId);
      return NextResponse.json({ revisions });
    } catch (error) {
      console.error('[Revisions] Error fetching:', error);
      return NextResponse.json(
        {
          error: 'Failed to fetch revisions',
          code: 'FETCH_ERROR',
        },
        { status: 500 }
      );
    }
  },
  { rateLimit: 'normal' }
);

// =============================================================================
// POST - Create revision
// =============================================================================

export const POST = withProjectAuth(
  async (request, { projectId, user }) => {
    if (!isFeatureEnabled('REVISION_TRACKING')) {
      return NextResponse.json(
        { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
        { status: 403 }
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

    const parseResult = CreateRevisionSchema.safeParse(body);
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
      const revision = await createRevision(projectId, parseResult.data.scriptText, {
        label: parseResult.data.label,
        autoScore: parseResult.data.autoScore,
        userId: user.id,
      });

      return NextResponse.json({
        success: true,
        revision,
      });
    } catch (error) {
      console.error('[Revisions] Error creating:', error);
      return NextResponse.json(
        {
          error: 'Failed to create revision',
          code: 'CREATION_ERROR',
        },
        { status: 500 }
      );
    }
  },
  { rateLimit: 'normal' }
);
