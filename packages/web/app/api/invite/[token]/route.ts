/**
 * Invite Token API Route
 *
 * GET /api/invite/[token] - Get invite details
 * POST /api/invite/[token] - Accept invite
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { validateCsrf } from '@/lib/csrf';

// =============================================================================
// GET - Get invite details
// =============================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = await createClient();
  const { token } = await params;

  try {
    const { data: invite, error } = await supabase
      .from('team_members')
      .select(
        `
        id,
        status,
        role,
        invited_email,
        invited_at,
        teams (
          id,
          name,
          description,
          profiles:owner_id (
            full_name
          )
        ),
        inviter:invited_by (
          full_name
        )
      `
      )
      .eq('invite_token', token)
      .single();

    if (error || !invite) {
      return NextResponse.json(
        { error: 'Invite not found or expired', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    if (invite.status !== 'pending') {
      return NextResponse.json(
        {
          error:
            invite.status === 'accepted'
              ? 'This invite has already been accepted'
              : 'This invite is no longer valid',
          code: 'INVALID_STATUS',
          status: invite.status,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      invite: {
        id: invite.id,
        email: invite.invited_email,
        role: invite.role,
        invitedAt: invite.invited_at,
        team: invite.teams,
        inviter: invite.inviter,
      },
    });
  } catch (error) {
    console.error('[Invite] Error getting:', error);
    return NextResponse.json(
      {
        error: 'Failed to get invite',
        code: 'GET_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Accept invite
// =============================================================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const supabase = await createClient();
  const { token } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      {
        error: 'Please sign in to accept this invite',
        code: 'AUTH_REQUIRED',
        redirectTo: `/login?redirect=/invite/${token}`,
      },
      { status: 401 }
    );
  }

  try {
    // Get invite
    const { data: invite, error: inviteError } = await supabase
      .from('team_members')
      .select(
        `
        id,
        team_id,
        status,
        invited_email,
        teams (
          id,
          name,
          owner_id
        )
      `
      )
      .eq('invite_token', token)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json(
        { error: 'Invite not found or expired', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    if (invite.status !== 'pending') {
      return NextResponse.json(
        {
          error:
            invite.status === 'accepted'
              ? 'This invite has already been accepted'
              : 'This invite is no longer valid',
          code: 'INVALID_STATUS',
        },
        { status: 400 }
      );
    }

    // Accept the invite
    const { error: updateError } = await supabase
      .from('team_members')
      .update({
        user_id: user.id,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invite.id);

    if (updateError) throw updateError;

    // Get user's name for alert
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    // Notify team owner
    // The teams field is a single object from the foreign key relation
    const team = invite.teams as unknown as { id: string; name: string; owner_id: string };
    await supabase.rpc('create_alert', {
      p_user_id: team.owner_id,
      p_alert_type: 'team_member_joined',
      p_title: `${profile?.full_name || 'Someone'} joined ${team.name}`,
      p_message: `${profile?.full_name || invite.invited_email} accepted your team invitation.`,
      p_team_id: team.id,
      p_related_user_id: user.id,
    });

    return NextResponse.json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
      },
    });
  } catch (error) {
    console.error('[Invite] Error accepting:', error);
    return NextResponse.json(
      {
        error: 'Failed to accept invite',
        code: 'ACCEPT_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
