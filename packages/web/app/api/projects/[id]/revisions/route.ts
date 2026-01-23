/**
 * Revisions API Route
 *
 * GET /api/projects/[id]/revisions - List revisions and timeline
 * POST /api/projects/[id]/revisions - Create a new revision
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCsrf } from '@/lib/csrf';
import { isFeatureEnabled } from '@/lib/features';
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
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create revision
// =============================================================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isFeatureEnabled('REVISION_TRACKING')) {
    return NextResponse.json(
      { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
      { status: 403 }
    );
  }

  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json(
      { error: 'CSRF validation failed', code: 'CSRF_ERROR' },
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
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
