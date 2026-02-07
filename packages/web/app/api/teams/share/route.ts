/**
 * Team Share API Route
 *
 * POST /api/teams/share - Share a project with a team
 * DELETE /api/teams/share - Unshare a project from a team
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCsrf } from '@/lib/csrf';

const ShareSchema = z.object({
  projectId: z.string().uuid('Valid project ID required'),
  teamId: z.string().uuid('Valid team ID required'),
  accessLevel: z.enum(['stream', 'download']).optional().default('stream'),
});

const UnshareSchema = z.object({
  projectId: z.string().uuid('Valid project ID required'),
  teamId: z.string().uuid('Valid team ID required'),
});

// =============================================================================
// POST - Share project with team
// =============================================================================

export async function POST(request: Request) {
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json(
      { error: 'CSRF validation failed', code: 'CSRF_ERROR' },
      { status: 403 }
    );
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON', code: 'INVALID_JSON' },
      { status: 400 }
    );
  }

  const parseResult = ShareSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid parameters', code: 'VALIDATION_ERROR', details: parseResult.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { projectId, teamId, accessLevel } = parseResult.data;

  // Verify user owns the project
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (!project) {
    return NextResponse.json(
      { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
      { status: 404 }
    );
  }

  // Verify user is a member/owner of the team
  const { data: team } = await supabase
    .from('teams')
    .select('id, name, owner_id')
    .eq('id', teamId)
    .single();

  if (!team) {
    return NextResponse.json(
      { error: 'Team not found', code: 'TEAM_NOT_FOUND' },
      { status: 404 }
    );
  }

  // Create the share
  const { data: share, error: shareError } = await supabase
    .from('team_shares')
    .upsert({
      project_id: projectId,
      team_id: teamId,
      shared_by: user.id,
      access_level: accessLevel,
    }, {
      onConflict: 'project_id,team_id',
    })
    .select()
    .single();

  if (shareError) {
    return NextResponse.json(
      { error: 'Failed to share project', code: 'SHARE_ERROR' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    share,
    message: `Project shared with ${team.name}`,
  });
}

// =============================================================================
// DELETE - Unshare project from team
// =============================================================================

export async function DELETE(request: Request) {
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json(
      { error: 'CSRF validation failed', code: 'CSRF_ERROR' },
      { status: 403 }
    );
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON', code: 'INVALID_JSON' },
      { status: 400 }
    );
  }

  const parseResult = UnshareSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid parameters', code: 'VALIDATION_ERROR' },
      { status: 400 }
    );
  }

  const { projectId, teamId } = parseResult.data;

  // Verify user owns the project
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (!project) {
    return NextResponse.json(
      { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
      { status: 404 }
    );
  }

  const { error } = await supabase
    .from('team_shares')
    .delete()
    .eq('project_id', projectId)
    .eq('team_id', teamId);

  if (error) {
    return NextResponse.json(
      { error: 'Failed to unshare project', code: 'UNSHARE_ERROR' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
