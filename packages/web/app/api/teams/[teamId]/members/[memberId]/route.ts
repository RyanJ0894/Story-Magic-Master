/**
 * PATCH /api/teams/[teamId]/members/[memberId]
 * Deactivate or reactivate a sub-account member. Master account only.
 *
 * Deactivated members retain their record for 90 days (deactivated_at is set).
 * Access is denied immediately: withProjectAuth excludes members where deactivatedAt != null.
 */

import { NextResponse } from 'next/server';
import { withAuth, parseBody, errorResponse } from '@/lib/api/middleware';
import { z } from 'zod';
import { log } from '@/lib/logger';
import {
  sendSubAccountDeactivationEmail,
  sendSubAccountReactivationEmail,
} from '@/lib/email/resend';

const PatchMemberSchema = z.object({
  action: z.enum(['deactivate', 'reactivate']),
});

export const PATCH = withAuth(async (request, { userId, prisma, params }) => {
  const { teamId, memberId } = params as { teamId: string; memberId: string };

  // Caller must be the team owner (master account)
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, ownerId: true },
  });

  if (!team) {
    return errorResponse('Team not found', 404, { code: 'NOT_FOUND' });
  }
  if (team.ownerId !== userId) {
    return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
  }

  const parsed = await parseBody(request, PatchMemberSchema);
  if ('error' in parsed) return parsed.error;
  const { action } = parsed.data;

  const member = await prisma.teamMember.findFirst({
    where: { id: memberId, teamId },
    include: {
      user: { select: { fullName: true, email: true } },
    },
  });

  if (!member) {
    return errorResponse('Member not found', 404, { code: 'NOT_FOUND' });
  }

  const callerProfile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { fullName: true, email: true },
  });

  if (action === 'deactivate') {
    if (member.deactivatedAt) {
      return errorResponse('Member is already deactivated', 400, { code: 'ALREADY_DEACTIVATED' });
    }

    await prisma.teamMember.update({
      where: { id: memberId },
      data: { deactivatedAt: new Date() },
    });

    // Fire-and-forget email — don't fail the request if email fails
    const recipientEmail = member.user?.email ?? member.invitedEmail;
    if (recipientEmail) {
      sendSubAccountDeactivationEmail({
        to: recipientEmail,
        recipientName: member.user?.fullName ?? '',
        teamName: team.name,
        masterAccountName: callerProfile?.fullName ?? callerProfile?.email ?? 'your team administrator',
      }).catch((err) => log.error('[TeamMember] deactivation email failed', err));
    }

    // Fire-and-forget in-app notification for the master account
    if (member.userId) {
      const { emitTeamMemberDeactivated } = await import('@/lib/notifications/producers');
      await emitTeamMemberDeactivated(prisma, {
        teamId,
        memberUserId: member.userId,
        memberName: member.user?.fullName ?? null,
      }).catch((err) => log.error('[TeamMember] deactivation notification failed', err));
    }

    log.info('[TeamMember] deactivated', { teamId, memberId, by: userId });
    return NextResponse.json({ memberId, status: 'deactivated' });
  }

  // action === 'reactivate'
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  if (!member.deactivatedAt) {
    return errorResponse('Member is not deactivated', 400, { code: 'NOT_DEACTIVATED' });
  }
  if (member.deactivatedAt < ninetyDaysAgo) {
    return errorResponse('Deactivation record has expired (> 90 days)', 410, { code: 'RECORD_EXPIRED' });
  }

  await prisma.teamMember.update({
    where: { id: memberId },
    data: { deactivatedAt: null },
  });

  const recipientEmail = member.user?.email ?? member.invitedEmail;
  if (recipientEmail) {
    sendSubAccountReactivationEmail({
      to: recipientEmail,
      recipientName: member.user?.fullName ?? '',
      teamName: team.name,
      masterAccountName: callerProfile?.fullName ?? callerProfile?.email ?? 'your team administrator',
    }).catch((err) => log.error('[TeamMember] reactivation email failed', err));
  }

  log.info('[TeamMember] reactivated', { teamId, memberId, by: userId });
  return NextResponse.json({ memberId, status: 'reactivated' });
});
