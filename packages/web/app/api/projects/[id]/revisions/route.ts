/**
 * Revisions API Route
 *
 * GET /api/projects/[id]/revisions - List revisions and timeline
 * POST /api/projects/[id]/revisions - Create a new revision
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isFeatureEnabled } from '@/lib/features';
import { withProjectAuth, parseBody } from '@/lib/api/middleware';
import {
  getRevisions,
  getRevisionTimeline,
  createRevision,
} from '@/lib/revisions';
import { log } from '@/lib/logger';

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
      log.error('[Revisions] Error fetching', error);
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
  async (request, { projectId, userId }) => {
    if (!isFeatureEnabled('REVISION_TRACKING')) {
      return NextResponse.json(
        { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
        { status: 403 }
      );
    }

    const parsed = await parseBody(request, CreateRevisionSchema);
    if ('error' in parsed) return parsed.error;

    try {
      const revision = await createRevision(projectId, parsed.data.scriptText, {
        label: parsed.data.label,
        autoScore: parsed.data.autoScore,
        userId,
      });

      return NextResponse.json({
        success: true,
        revision,
      });
    } catch (error) {
      log.error('[Revisions] Error creating', error);
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
