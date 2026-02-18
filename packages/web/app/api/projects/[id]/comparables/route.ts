/**
 * Comparable Scripts API Route
 *
 * GET /api/projects/[id]/comparables - Find similar scripts in corpus
 */

import { NextResponse } from 'next/server';
import { isFeatureEnabled } from '@/lib/features';
import { withProjectAuth } from '@/lib/api/middleware';
import { searchComparables } from '@/lib/comparable/service';
import { ProductionStatus } from '@/lib/comparable/types';
import { log } from '@/lib/logger';

// =============================================================================
// GET - Search Comparables
// =============================================================================

export const GET = withProjectAuth(
  async (request, { projectId }) => {
    if (!isFeatureEnabled('COMPARABLE_SCRIPTS')) {
      return NextResponse.json(
        { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
        { status: 403 }
      );
    }

    try {
      // Parse query params
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '5', 10);
      const minSimilarity = parseFloat(url.searchParams.get('minSimilarity') || '0.6');
      const filterStatus = url.searchParams.get('status')?.split(',') as ProductionStatus[] | undefined;
      const filterGenre = url.searchParams.get('genre')?.split(',');

      const { comparables, queryLogline } = await searchComparables(projectId, {
        limit: Math.min(limit, 20),
        minSimilarity: Math.max(0.5, Math.min(0.95, minSimilarity)),
        filterStatus,
        filterGenre,
      });

      return NextResponse.json({
        comparables,
        queryLogline,
        matchCount: comparables.length,
      });
    } catch (error) {
      log.error('[Comparables] Error', error);

      const message = error instanceof Error ? error.message : 'Failed to search comparables';

      // Check if it's a "no score" error
      if (message.includes('No score found')) {
        return NextResponse.json(
          { error: message, code: 'NO_SCORE' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: message, code: 'SEARCH_ERROR' },
        { status: 500 }
      );
    }
  },
  { rateLimit: 'normal' }
);
