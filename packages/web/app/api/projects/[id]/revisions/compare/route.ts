/**
 * Revision Comparison API Route
 *
 * GET /api/projects/[id]/revisions/compare?from=xxx&to=yyy
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { isFeatureEnabled } from '@/lib/features';
import { compareRevisions, getRevision } from '@/lib/revisions';

// =============================================================================
// GET - Compare two revisions
// =============================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isFeatureEnabled('REVISION_TRACKING')) {
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
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (!project) {
    return NextResponse.json(
      { error: 'Project not found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  // Get revision IDs from query params
  const url = new URL(request.url);
  const fromId = url.searchParams.get('from');
  const toId = url.searchParams.get('to');

  if (!fromId || !toId) {
    return NextResponse.json(
      { error: 'Both from and to revision IDs are required', code: 'VALIDATION_ERROR' },
      { status: 400 }
    );
  }

  try {
    // Verify both revisions belong to this project
    const [fromRevision, toRevision] = await Promise.all([
      getRevision(fromId),
      getRevision(toId),
    ]);

    if (!fromRevision || fromRevision.projectId !== projectId) {
      return NextResponse.json(
        { error: 'From revision not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    if (!toRevision || toRevision.projectId !== projectId) {
      return NextResponse.json(
        { error: 'To revision not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const comparison = await compareRevisions(fromId, toId);
    return NextResponse.json({ comparison });
  } catch (error) {
    console.error('[Revisions] Error comparing:', error);
    return NextResponse.json(
      {
        error: 'Failed to compare revisions',
        code: 'COMPARISON_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
