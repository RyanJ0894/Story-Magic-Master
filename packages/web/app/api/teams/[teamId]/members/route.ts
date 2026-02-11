/**
 * Team Members API Route
 *
 * GET /api/teams/[teamId]/members - List team members
 * POST /api/teams/[teamId]/members - Invite new member (sends email)
 * DELETE /api/teams/[teamId]/members - Remove member
 */

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendTeamInviteEmail } from '@/lib/email';
import { validateCsrf } from '@/lib/csrf';

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
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const { teamId } = await params;

  // Verify user has access to this team
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, ownerId: true },
  });

  if (!team) {
    return NextResponse.json({ error: 'Team not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  // Check if user is owner or member
  const isOwner = team.ownerId === userId;
  if (!isOwner) {
    const membership = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
        status: 'accepted',
      },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Access denied', code: 'FORBIDDEN' }, { status: 403 });
    }
  }

  try {
    const members = await prisma.teamMember.findMany({
      where: { teamId },
      select: {
        id: true,
        userId: true,
        invitedEmail: true,
        role: true,
        status: true,
        invitedAt: true,
        acceptedAt: true,
        user: {
          select: {
            fullName: true,
            avatarUrl: true,
            id: true,
          },
        },
        inviter: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      members,
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
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const { teamId } = await params;

  // Only team owner can invite
  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
      ownerId: userId,
    },
    select: { id: true, name: true, ownerId: true },
  });

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
  const existing = await prisma.teamMember.findFirst({
    where: {
      teamId,
      invitedEmail: email.toLowerCase(),
    },
    select: { id: true, status: true },
  });

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
  const existingUser = await prisma.profile.findFirst({
    where: { email: email.toLowerCase() },
    select: { id: true, fullName: true },
  });

  // Get inviter's name
  const inviterProfile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { fullName: true },
  });

  try {
    // Create the invite
    const member = await prisma.teamMember.create({
      data: {
        teamId,
        userId: existingUser?.id || null,
        invitedEmail: email.toLowerCase(),
        role: role || 'member',
        status: 'pending',
        invitedBy: userId,
      },
    });

    // Send invite email
    const emailResult = await sendTeamInviteEmail({
      to: email,
      inviterName: inviterProfile?.fullName || 'A colleague',
      teamName: team.name,
      inviteToken: member.inviteToken!,
    });

    if (!emailResult.success) {
      console.error('[TeamMembers] Email send failed:', emailResult.error);
      // Don't fail the whole operation, just log
    }

    // Create alert for invitee if they have an account
    if (existingUser?.id) {
      await prisma.alert.create({
        data: {
          userId: existingUser.id,
          alertType: 'team_invite',
          title: `You've been invited to join ${team.name}`,
          message: `${inviterProfile?.fullName || 'Someone'} invited you to join their team.`,
          teamId,
          relatedUserId: userId,
        },
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
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const { teamId } = await params;

  // Only team owner can remove members
  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
      ownerId: userId,
    },
    select: { id: true, ownerId: true },
  });

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
    await prisma.teamMember.updateMany({
      where: {
        id: memberId,
        teamId,
      },
      data: { status: 'removed' },
    });

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
