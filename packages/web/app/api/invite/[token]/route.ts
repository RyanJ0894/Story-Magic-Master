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
import { rateLimit, getClientIp } from '@/lib/api/rate-limit';
import { log } from '@/lib/logger';
import { errorResponse } from '@/lib/api/error-response';
import { ensureProfile } from '@/lib/ensure-profile';

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
      return errorResponse('Invite not found or expired', 404, { code: 'NOT_FOUND' });
    }

    if (invite.status !== 'pending') {
      return errorResponse(
        invite.status === 'accepted'
          ? 'This invite has already been accepted'
          : 'This invite is no longer valid',
        400,
        { code: 'INVALID_STATUS', details: { status: invite.status } },
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
    return errorResponse('Failed to get invite', 500, { code: 'GET_ERROR', details: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// =============================================================================
// POST - Accept invite
// =============================================================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  // Rate limit invite acceptance (strict — prevents brute-force token guessing)
  const ip = getClientIp(request);
  const limited = await rateLimit(`invite:${ip}`, 'strict');
  if (limited) return limited;

  const csrfError = validateCsrf(request);
  if (csrfError) {
    return errorResponse('CSRF validation failed', 403, { code: 'CSRF_ERROR' });
  }

  const { token } = await params;

  const { userId } = await auth();
  if (!userId) {
    return errorResponse('Please sign in to accept this invite', 401, { code: 'AUTH_REQUIRED', details: { redirectTo: `/login?redirect=/invite/${token}` } });
  }

  try {
    // Ensure a Profile row exists — teamMember.userId is a FK to profiles.id,
    // so new Clerk users who haven't visited the dashboard yet would trigger a
    // FK violation without this call. Inside try/catch so any Clerk API failure
    // returns a clean 500 JSON response instead of an unhandled exception.
    await ensureProfile(userId);

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
      return errorResponse('Invite not found or expired', 404, { code: 'NOT_FOUND' });
    }

    if (invite.status !== 'pending') {
      return errorResponse(
        invite.status === 'accepted'
          ? 'This invite has already been accepted'
          : 'This invite is no longer valid',
        400,
        { code: 'INVALID_STATUS' },
      );
    }

    // Accept the invite.
    // Guard against the unique constraint on (teamId, userId): if the user
    // already has a team member record for this team (e.g. from a prior partial
    // accept or a duplicate invite), treat it as already-accepted rather than failing.
    const existingMembership = await prisma.teamMember.findFirst({
      where: { teamId: invite.teamId, userId, status: 'accepted' },
      select: { id: true },
    });

    if (!existingMembership) {
      await prisma.teamMember.update({
        where: { id: invite.id },
        data: {
          userId,
          status: 'accepted',
          acceptedAt: new Date(),
        },
      });
    }

    // Upgrade sub-account from free → creator (Starter plan) on first acceptance.
    // Only applies when the user is currently on the free tier — preserves any
    // existing paid subscription.
    await prisma.profile.updateMany({
      where: { id: userId, subscriptionTier: 'free' },
      data: { subscriptionTier: 'creator' },
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
    return errorResponse('Failed to accept invite', 500, { code: 'ACCEPT_ERROR', details: error instanceof Error ? error.message : 'Unknown error' });
  }
}
