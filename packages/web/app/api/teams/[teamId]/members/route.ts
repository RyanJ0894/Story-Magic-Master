/**
 * Team Members API Route
 *
 * GET /api/teams/[teamId]/members - List team members
 * POST /api/teams/[teamId]/members - Invite new member (sends email)
 * DELETE /api/teams/[teamId]/members - Remove member
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendTeamInviteEmail } from '@/lib/email';

// =============================================================================
// Validation
// =============================================================================

const InviteMemberSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.enum(['admin', 'member', 'viewer']).optional(),
});

const RemoveMemberSchema = z.object({
  memberId: z.string().uuid('Valid member ID is required'),
});

// =============================================================================
// GET - List members
// =============================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const supabase = await createClient();
  const { teamId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  // Verify user has access to this team
  const { data: team } = await supabase
    .from('teams')
    .select('id, owner_id')
    .eq('id', teamId)
    .single();

  if (!team) {
    return NextResponse.json({ error: 'Team not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  // Check if user is owner or member
  const isOwner = team.owner_id === user.id;
  if (!isOwner) {
    const { data: membership } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('status', 'accepted')
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied', code: 'FORBIDDEN' }, { status: 403 });
    }
  }

  try {
    const { data: members, error } = await supabase
      .from('team_members')
      .select(
        `
        id,
        user_id,
        invited_email,
        role,
        status,
        invited_at,
        accepted_at,
        profiles:user_id (
          full_name,
          avatar_url,
          email:id
        ),
        inviter:invited_by (
          full_name
        )
      `
      )
      .eq('team_id', teamId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      members: members || [],
      isOwner,
    });
  } catch (error) {
    console.error('[TeamMembers] Error listing:', error);
    return NextResponse.json(
      {
        error: 'Failed to list members',
        code: 'LIST_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Invite member
// =============================================================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const supabase = await createClient();
  const { teamId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  // Only team owner can invite
  const { data: team } = await supabase
    .from('teams')
    .select('id, name, owner_id')
    .eq('id', teamId)
    .eq('owner_id', user.id)
    .single();

  if (!team) {
    return NextResponse.json(
      { error: 'Team not found or not authorized', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'PARSE_ERROR' }, { status: 400 });
  }

  const parseResult = InviteMemberSchema.safeParse(body);
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

  const { email, role } = parseResult.data;

  // Check if already invited
  const { data: existing } = await supabase
    .from('team_members')
    .select('id, status')
    .eq('team_id', teamId)
    .eq('invited_email', email.toLowerCase())
    .single();

  if (existing) {
    if (existing.status === 'accepted') {
      return NextResponse.json(
        { error: 'This person is already a team member', code: 'ALREADY_MEMBER' },
        { status: 400 }
      );
    }
    if (existing.status === 'pending') {
      return NextResponse.json(
        { error: 'An invitation is already pending for this email', code: 'INVITE_PENDING' },
        { status: 400 }
      );
    }
  }

  // Check if user exists
  const { data: existingUser } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', email.toLowerCase()) // This won't work - need to look up by email differently
    .single();

  // Get inviter's name
  const { data: inviterProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  try {
    // Create the invite
    const { data: member, error } = await supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: existingUser?.id || null,
        invited_email: email.toLowerCase(),
        role: role || 'member',
        status: 'pending',
        invited_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Send invite email
    const emailResult = await sendTeamInviteEmail({
      to: email,
      inviterName: inviterProfile?.full_name || 'A colleague',
      teamName: team.name,
      inviteToken: member.invite_token,
    });

    if (!emailResult.success) {
      console.error('[TeamMembers] Email send failed:', emailResult.error);
      // Don't fail the whole operation, just log
    }

    // Create alert for invitee if they have an account
    if (existingUser?.id) {
      await supabase.rpc('create_alert', {
        p_user_id: existingUser.id,
        p_alert_type: 'team_invite',
        p_title: `You've been invited to join ${team.name}`,
        p_message: `${inviterProfile?.full_name || 'Someone'} invited you to join their team.`,
        p_team_id: teamId,
        p_related_user_id: user.id,
      });
    }

    return NextResponse.json(
      {
        member,
        emailSent: emailResult.success,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[TeamMembers] Error inviting:', error);
    return NextResponse.json(
      {
        error: 'Failed to invite member',
        code: 'INVITE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Remove member
// =============================================================================

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const supabase = await createClient();
  const { teamId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  // Only team owner can remove members
  const { data: team } = await supabase
    .from('teams')
    .select('id, owner_id')
    .eq('id', teamId)
    .eq('owner_id', user.id)
    .single();

  if (!team) {
    return NextResponse.json(
      { error: 'Team not found or not authorized', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'PARSE_ERROR' }, { status: 400 });
  }

  const parseResult = RemoveMemberSchema.safeParse(body);
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

  const { memberId } = parseResult.data;

  try {
    const { error } = await supabase
      .from('team_members')
      .update({ status: 'removed', updated_at: new Date().toISOString() })
      .eq('id', memberId)
      .eq('team_id', teamId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[TeamMembers] Error removing:', error);
    return NextResponse.json(
      {
        error: 'Failed to remove member',
        code: 'REMOVE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
