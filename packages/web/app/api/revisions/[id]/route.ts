/**
 * Individual Revision API Route
 *
 * GET /api/revisions/[id] - Get revision details
 * PUT /api/revisions/[id] - Update revision (label)
 * DELETE /api/revisions/[id] - Delete revision
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCsrf } from '@/lib/csrf';
import { isFeatureEnabled } from '@/lib/features';
import {
  getRevision,
  updateRevisionLabel,
  deleteRevision,
} from '@/lib/revisions';

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
  const supabase = await createClient();

  const { data } = await supabase
    .from('revisions')
    .select('project_id, projects!inner(user_id)')
    .eq('id', revisionId)
    .single();

  if (!data) return false;

  const revisionData = data as unknown as { project_id: string; projects: { user_id: string } | { user_id: string }[] };
  const projects = revisionData.projects;
  const projectUserId = Array.isArray(projects) ? projects[0]?.user_id : projects?.user_id;
  return projectUserId === userId;
}

// =============================================================================
// GET - Get revision details
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
  const { id: revisionId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  const owned = await verifyRevisionOwnership(revisionId, user.id);
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
    console.error('[Revision] Error fetching:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch revision',
        code: 'FETCH_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT - Update revision
// =============================================================================

export async function PUT(
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
  const { id: revisionId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  const owned = await verifyRevisionOwnership(revisionId, user.id);
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
    console.error('[Revision] Error updating:', error);
    return NextResponse.json(
      {
        error: 'Failed to update revision',
        code: 'UPDATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete revision
// =============================================================================

export async function DELETE(
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
  const { id: revisionId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  const owned = await verifyRevisionOwnership(revisionId, user.id);
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
    console.error('[Revision] Error deleting:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete revision',
        code: 'DELETE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
