/**
 * Invite Token API Route
 *
 * GET /api/invite/[token] - Get invite details
 * POST /api/invite/[token] - Accept invite
 */

import { auth } from '@clerk/nextjs/server';
import { Prisma } from '@story-magic/shared';
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
    log.warn('[Invite] Unauthenticated accept attempt', { token: token.slice(0, 8) });
    return errorResponse('Please sign in to accept this invite', 401, { code: 'AUTH_REQUIRED', details: { redirectTo: `/login?redirect=/invite/${token}` } });
  }

  log.info('[Invite] Accept start', { userId, token: token.slice(0, 8) });

  try {
    // Ensure a Profile row exists — teamMember.userId is a FK to profiles.id,
    // so new Clerk users who haven't visited the dashboard yet would trigger a
    // FK violation without this call. Inside try/catch so any Clerk API failure
    // returns a clean 500 JSON response instead of an unhandled exception.
    await ensureProfile(userId);
    log.info('[Invite] Profile ensured', { userId });

    // Wrap the invite read + membership check + updates in a serializable transaction.
    // This prevents the TOCTOU race where two concurrent requests both see the invite
    // as 'pending', both pass the status check, and both attempt to accept it.
    // PostgreSQL will abort one of them with a serialization_failure (40001) if their
    // reads and writes conflict — the outer catch block returns a 500 for that case.
    const txResult = await prisma.$transaction(async (tx) => {
      // Get invite
      const invite = await tx.teamMember.findFirst({
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
        return { error: 'NOT_FOUND' as const };
      }

      if (invite.status !== 'pending') {
        return { error: 'INVALID_STATUS' as const, status: invite.status, teamId: invite.teamId, teamName: invite.team?.name };
      }

      // Accept the invite.
      // Guard against the UNIQUE(teamId, userId) constraint: a user may already
      // have a team_member row for this team with any status (accepted, removed,
      // etc.). Setting userId on the invite row would create a duplicate pair and
      // trigger a constraint violation.
      //
      // Strategy:
      //   • If an existing row exists (any status): reactivate that row to
      //     'accepted' and consume the invite token by marking it 'accepted'
      //     WITHOUT touching userId (invite row already lacks userId — safe).
      //   • If no existing row: standard path — set userId + accepted on the
      //     invite row itself (invite row becomes the membership record).
      const existingMembership = await tx.teamMember.findFirst({
        where: { teamId: invite.teamId, userId },
        select: { id: true, status: true },
      });

      if (existingMembership) {
        // Reactivate the existing membership record and consume the invite token.
        await tx.teamMember.update({
          where: { id: existingMembership.id },
          data: { status: 'accepted', acceptedAt: new Date() },
        });
        await tx.teamMember.update({
          where: { id: invite.id },
          data: { status: 'accepted', acceptedAt: new Date() },
        });
        return { branch: 'reactivate' as const, membershipId: existingMembership.id, invite };
      } else {
        // First-time join — promote the pending invite row to the membership record.
        await tx.teamMember.update({
          where: { id: invite.id },
          data: { userId, status: 'accepted', acceptedAt: new Date() },
        });
        return { branch: 'new' as const, inviteId: invite.id, invite };
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (txResult.error === 'NOT_FOUND') {
      log.warn('[Invite] Token not found', { userId, token: token.slice(0, 8) });
      return errorResponse('Invite not found or expired', 404, { code: 'NOT_FOUND' });
    }

    if (txResult.error === 'INVALID_STATUS') {
      log.info('[Invite] Non-pending status, returning INVALID_STATUS', {
        userId,
        status: txResult.status,
        teamId: txResult.teamId,
      });
      return errorResponse(
        txResult.status === 'accepted'
          ? 'This invite has already been accepted'
          : 'This invite is no longer valid',
        400,
        { code: 'INVALID_STATUS', details: { status: txResult.status, teamId: txResult.teamId, teamName: txResult.teamName } },
      );
    }

    const { branch, invite } = txResult;
    log.info('[Invite] Invite found', {
      userId,
      inviteId: invite.id,
      status: invite.status,
      teamId: invite.teamId,
      teamName: invite.team?.name,
    });

    if (branch === 'reactivate') {
      log.info('[Invite] Reactivated existing membership', { userId, membershipId: (txResult as { membershipId: string }).membershipId });
    } else {
      log.info('[Invite] New membership created via invite row', { userId, inviteId: invite.id });
    }

    // A-008 (2026-06-15): default sub-account tier configurable, default 'pro'.
    // Was 'creator' previously, which gave invitees 5 scripts/month — Ryan's
    // testing surfaced that this is too low for friendly-cohort sub-accounts.
    // Env-overridable so we can tune without a code change after launch.
    //
    // Only applies when the user is currently on the free tier — preserves
    // any existing paid subscription. If the user has manually paid for
    // Studio/Enterprise we don't downgrade them by joining a team.
    const inviteDefaultTier = process.env.INVITE_DEFAULT_TIER || 'pro';
    await prisma.profile.updateMany({
      where: { id: userId, subscriptionTier: 'free' },
      data: { subscriptionTier: inviteDefaultTier },
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

    log.info('[Invite] Accept complete', { userId, teamId: team.id, teamName: team.name });

    return NextResponse.json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
      },
    });
  } catch (error) {
    log.error('[Invite] Error accepting', {
      userId,
      token: token.slice(0, 8),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 4).join(' | ') : undefined,
    });
    return errorResponse('Failed to accept invite', 500, {
      code: 'ACCEPT_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
