/**
 * Teams API Route
 *
 * GET /api/teams - List user's teams (owned and member of)
 * POST /api/teams - Create a new team
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// =============================================================================
// Validation
// =============================================================================

const CreateTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100),
  description: z.string().max(500).optional(),
  defaultShareAccess: z.enum(['stream', 'download']).optional(),
  autoShareNewProjects: z.boolean().optional(),
});

// =============================================================================
// GET - List teams
// =============================================================================

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  try {
    // Get teams user owns
    const { data: ownedTeams, error: ownedError } = await supabase
      .from('teams')
      .select(
        `
        *,
        team_members (
          id,
          user_id,
          invited_email,
          role,
          status,
          profiles:user_id (
            full_name,
            avatar_url
          )
        )
      `
      )
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (ownedError) throw ownedError;

    // Get teams user is a member of
    const { data: memberships, error: memberError } = await supabase
      .from('team_members')
      .select(
        `
        id,
        role,
        status,
        teams (
          *,
          profiles:owner_id (
            full_name,
            avatar_url
          )
        )
      `
      )
      .eq('user_id', user.id)
      .eq('status', 'accepted');

    if (memberError) throw memberError;

    const memberTeams = memberships?.map((m) => ({
      ...m.teams,
      membership: {
        id: m.id,
        role: m.role,
        status: m.status,
      },
    }));

    return NextResponse.json({
      owned: ownedTeams || [],
      member: memberTeams || [],
    });
  } catch (error) {
    console.error('[Teams] Error listing:', error);
    return NextResponse.json(
      {
        error: 'Failed to list teams',
        code: 'LIST_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create team
// =============================================================================

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'PARSE_ERROR' }, { status: 400 });
  }

  const parseResult = CreateTeamSchema.safeParse(body);
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

  const { name, description, defaultShareAccess, autoShareNewProjects } = parseResult.data;

  try {
    const { data: team, error } = await supabase
      .from('teams')
      .insert({
        owner_id: user.id,
        name,
        description: description || null,
        default_share_access: defaultShareAccess || 'stream',
        auto_share_new_projects: autoShareNewProjects || false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    console.error('[Teams] Error creating:', error);
    return NextResponse.json(
      {
        error: 'Failed to create team',
        code: 'CREATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
