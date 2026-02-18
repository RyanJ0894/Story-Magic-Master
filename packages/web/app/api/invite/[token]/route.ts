/**
 * Invite Token API Route
 *
 * GET /api/invite/[token] - Get invite details
 * POST /api/invite/[token] - Accept invite
 */

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { validateCsrf } from '@/lib/csrf';
import { log } from '@/lib/logger';

// =============================================================================
// GET - Get invite details
// =============================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const invite = await prisma.teamMember.findFirst({
      where: { inviteToken: token },
      select: {
        id: true,
        status: true,
        role: true,
        invitedEmail: true,
        invitedAt: true,
        team: {
          select: {
            id: true,
            name: true,
            description: true,
            owner: {
              select: {
                fullName: true,
              },
            },
          },
        },
        inviter: {
          select: {
            fullName: true,
          },
        },
      },
    });

    if (!invite) {
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
        email: invite.invitedEmail,
        role: invite.role,
        invitedAt: invite.invitedAt,
        team: invite.team,
        inviter: invite.inviter,
      },
    });
  } catch (error) {
    log.error('[Invite] Error getting', error);
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

  const { token } = await params;

  const { userId } = await auth();
  if (!userId) {
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
    const invite = await prisma.teamMember.findFirst({
      where: { inviteToken: token },
      select: {
        id: true,
        teamId: true,
        status: true,
        invitedEmail: true,
        team: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },
      },
    });

    if (!invite) {
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
    await prisma.teamMember.update({
      where: { id: invite.id },
      data: {
        userId,
        status: 'accepted',
        acceptedAt: new Date(),
      },
    });

    // Get user's name for alert
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });

    // Notify team owner
    const team = invite.team!;
    await prisma.alert.create({
      data: {
        userId: team.ownerId,
        alertType: 'team_member_joined',
        title: `${profile?.fullName || 'Someone'} joined ${team.name}`,
        message: `${profile?.fullName || invite.invitedEmail} accepted your team invitation.`,
        teamId: team.id,
        relatedUserId: userId,
      },
    });

    return NextResponse.json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
      },
    });
  } catch (error) {
    log.error('[Invite] Error accepting', error);
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
