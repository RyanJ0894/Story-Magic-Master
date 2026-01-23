/**
 * Comparable Scripts API Route
 *
 * GET /api/projects/[id]/comparables - Find similar scripts in corpus
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { isFeatureEnabled } from '@/lib/features';
import { searchComparables } from '@/lib/comparable/service';
import { ProductionStatus } from '@/lib/comparable/types';

// =============================================================================
// GET - Search Comparables
// =============================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isFeatureEnabled('COMPARABLE_SCRIPTS')) {
    return NextResponse.json(
      { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
      { status: 403 }
    );
  }

  const supabase = await createClient();
  const { id: projectId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // Verify project ownership
  const { data: project } = await supabase
    .from('projects')
    .select('id, user_id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (!project) {
    return NextResponse.json(
      { error: 'Project not found', code: 'NOT_FOUND' },
      { status: 404 }
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
    console.error('[Comparables] Error:', error);

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
}
