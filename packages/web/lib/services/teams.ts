/**
 * Teams Service
 *
 * Pure business logic for team CRUD and membership operations.
 * No HTTP request/response handling — routes call these functions
 * and translate results into HTTP responses.
 */

import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@story-magic/shared';
import { sendTeamInviteEmail } from '@/lib/email';
import { log } from '@/lib/logger';

/**
 * Mint an invite token matching the DB trigger's format
 * (LOWER(ENCODE(gen_random_bytes(16), 'hex')) = 32 lowercase hex chars).
 * Needed because the token trigger only fires BEFORE INSERT, not on UPDATE —
 * so reactivating a removed member must generate a fresh token in app code.
 */
function generateInviteToken(): string {
  return randomBytes(16).toString('hex');
}

// =============================================================================
// Types
// =============================================================================

export interface CreateTeamInput {
  name: string;
  description?: string | null;
  defaultShareAccess?: 'stream' | 'download';
  autoShareNewProjects?: boolean;
}

export interface UpdateTeamInput {
  name?: string;
  description?: string | null;
  defaultShareAccess?: 'stream' | 'download';
  autoShareNewProjects?: boolean;
}

export interface InviteMemberInput {
  email: string;
  name?: string;
  role?: 'admin' | 'member' | 'viewer';
  memberType?: 'talent_actor' | 'staff' | 'representation';
}

export class TeamServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'TeamServiceError';
  }
}

// =============================================================================
// List teams
// =============================================================================

export async function listTeams(prisma: PrismaClient, userId: string) {
  // Get teams user owns
  const ownedTeams = await prisma.team.findMany({
    where: { ownerId: userId },
    include: {
      members: {
        where: { status: { not: 'removed' } },
        select: {
          id: true,
          userId: true,
          invitedEmail: true,
          role: true,
          memberType: true,
          status: true,
          deactivatedAt: true,
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Get teams user is a member of. Deactivated sub-accounts must not see
  // the teams they were removed from (DT-32-C-1).
  const memberships = await prisma.teamMember.findMany({
    where: {
      userId,
      status: 'accepted',
      deactivatedAt: null,
    },
    select: {
      id: true,
      role: true,
      status: true,
      team: {
        include: {
          owner: {
            select: {
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });

  const memberTeams = memberships.map((m: typeof memberships[number]) => ({
    ...m.team,
    membership: {
      id: m.id,
      role: m.role,
      status: m.status,
    },
  }));

  const allTeams = [
    ...ownedTeams.map((t: typeof ownedTeams[number]) => ({ ...t, role: 'owner' as const })),
    ...memberTeams,
  ];

  return { owned: ownedTeams, member: memberTeams, teams: allTeams };
}

// =============================================================================
// Create team
// =============================================================================

export async function createTeam(
  prisma: PrismaClient,
  userId: string,
  input: CreateTeamInput,
) {
  return prisma.team.create({
    data: {
      ownerId: userId,
      name: input.name,
      description: input.description || null,
      defaultShareAccess: input.defaultShareAccess || 'stream',
      autoShareNewProjects: input.autoShareNewProjects || false,
    },
  });
}

// =============================================================================
// Get team (with access check)
// =============================================================================

export async function getTeam(
  prisma: PrismaClient,
  teamId: string,
  userId: string,
) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        where: { status: { not: 'removed' } },
        select: {
          id: true,
          userId: true,
          invitedEmail: true,
          role: true,
          status: true,
          user: {
            select: {
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      },
      owner: {
        select: {
          fullName: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (!team) {
    throw new TeamServiceError('Team not found', 'NOT_FOUND', 404);
  }

  const isOwner = team.ownerId === userId;
  if (!isOwner) {
    const membership = await prisma.teamMember.findFirst({
      // Reject deactivated sub-accounts (DT-32-C-1).
      where: { teamId, userId, status: 'accepted', deactivatedAt: null },
      select: { id: true },
    });

    if (!membership) {
      throw new TeamServiceError('Access denied', 'FORBIDDEN', 403);
    }
  }

  return { team, isOwner };
}

// =============================================================================
// Update team (owner only)
// =============================================================================

export async function updateTeam(
  prisma: PrismaClient,
  teamId: string,
  userId: string,
  input: UpdateTeamInput,
) {
  // Verify ownership
  const team = await prisma.team.findFirst({
    where: { id: teamId, ownerId: userId },
    select: { id: true },
  });

  if (!team) {
    throw new TeamServiceError('Team not found or not authorized', 'NOT_FOUND', 404);
  }

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.defaultShareAccess !== undefined) updates.defaultShareAccess = input.defaultShareAccess;
  if (input.autoShareNewProjects !== undefined) updates.autoShareNewProjects = input.autoShareNewProjects;

  return prisma.team.update({
    where: { id: teamId },
    data: updates,
  });
}

// =============================================================================
// Delete team (owner only)
// =============================================================================

export async function deleteTeam(
  prisma: PrismaClient,
  teamId: string,
  userId: string,
) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, ownerId: userId },
    select: { id: true, name: true },
  });

  if (!team) {
    throw new TeamServiceError('Team not found or not authorized', 'NOT_FOUND', 404);
  }

  // Delete team members first
  await prisma.teamMember.deleteMany({ where: { teamId } });

  // Delete team shares
  await prisma.teamShare.deleteMany({ where: { teamId } });

  // Delete the team
  await prisma.team.delete({ where: { id: teamId } });

  return { teamName: team.name };
}

// =============================================================================
// List members
// =============================================================================

export async function listMembers(
  prisma: PrismaClient,
  teamId: string,
  userId: string,
) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, ownerId: true },
  });

  if (!team) {
    throw new TeamServiceError('Team not found', 'NOT_FOUND', 404);
  }

  const isOwner = team.ownerId === userId;
  if (!isOwner) {
    const membership = await prisma.teamMember.findFirst({
      // Reject deactivated sub-accounts (DT-32-C-1).
      where: { teamId, userId, status: 'accepted', deactivatedAt: null },
      select: { id: true },
    });

    if (!membership) {
      throw new TeamServiceError('Access denied', 'FORBIDDEN', 403);
    }
  }

  const members = await prisma.teamMember.findMany({
    where: { teamId, status: { not: 'removed' } },
    select: {
      id: true,
      userId: true,
      invitedEmail: true,
      role: true,
      memberType: true,
      status: true,
      invitedAt: true,
      acceptedAt: true,
      deactivatedAt: true,
      user: {
        select: {
          fullName: true,
          avatarUrl: true,
          id: true,
          email: true,
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

  return { members, isOwner };
}

// =============================================================================
// Invite member (owner only)
// =============================================================================

export async function addMember(
  prisma: PrismaClient,
  teamId: string,
  userId: string,
  input: InviteMemberInput,
) {
  // Only team owner can invite
  const team = await prisma.team.findFirst({
    where: { id: teamId, ownerId: userId },
    select: { id: true, name: true, ownerId: true },
  });

  if (!team) {
    throw new TeamServiceError('Team not found or not authorized', 'NOT_FOUND', 404);
  }

  const email = input.email.toLowerCase();

  // Resolve the invitee's account (if any) up front — needed both to detect a
  // prior membership row keyed by userId and to relink it on reactivation.
  const existingUser = await prisma.profile.findFirst({
    where: { email },
    select: { id: true, fullName: true },
  });

  // Find any prior membership row for this person, by invited email OR by their
  // account id. Matching both is what prevents the unique-constraint 500: a row
  // left behind by removeMember keeps its userId, so re-inviting a previously
  // removed registered user would otherwise collide on (teamId, userId).
  const existing = await prisma.teamMember.findFirst({
    where: {
      teamId,
      OR: [
        { invitedEmail: email },
        ...(existingUser ? [{ userId: existingUser.id }] : []),
      ],
    },
    select: { id: true, status: true },
  });

  if (existing) {
    if (existing.status === 'accepted') {
      throw new TeamServiceError('This person is already a team member', 'ALREADY_MEMBER', 400);
    }
    if (existing.status === 'pending') {
      throw new TeamServiceError('An invitation is already pending for this email', 'INVITE_PENDING', 400);
    }
  }

  // Get inviter's name
  const inviterProfile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { fullName: true },
  });

  // Reactivate a prior (removed) row in place, or create a fresh invite.
  // Reactivation updates the existing (teamId, userId) row rather than inserting
  // a duplicate; the INSERT-only token trigger won't fire on UPDATE, so we mint
  // a fresh token here.
  const member = existing
    ? await prisma.teamMember.update({
        where: { id: existing.id },
        data: {
          userId: existingUser?.id || null,
          invitedEmail: email,
          role: input.role || 'member',
          memberType: input.memberType || null,
          status: 'pending',
          invitedBy: userId,
          inviteToken: generateInviteToken(),
          invitedAt: new Date(),
          acceptedAt: null,
        },
      })
    : await prisma.teamMember.create({
        data: {
          teamId,
          userId: existingUser?.id || null,
          invitedEmail: email,
          role: input.role || 'member',
          memberType: input.memberType || null,
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
    log.error('[TeamMembers] Email send failed', undefined, { error: emailResult.error });
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

  return { member, emailSent: emailResult.success };
}

// =============================================================================
// Remove member (owner only)
// =============================================================================

export async function removeMember(
  prisma: PrismaClient,
  teamId: string,
  userId: string,
  memberId: string,
) {
  // Only team owner can remove members
  const team = await prisma.team.findFirst({
    where: { id: teamId, ownerId: userId },
    select: { id: true, ownerId: true },
  });

  if (!team) {
    throw new TeamServiceError('Team not found or not authorized', 'NOT_FOUND', 404);
  }

  // Capture member identity BEFORE marking removed so the notification
  // can show the right name even if the row's other columns shift.
  const member = await prisma.teamMember.findFirst({
    where: { id: memberId, teamId },
    select: { userId: true, user: { select: { fullName: true } } },
  });

  await prisma.teamMember.updateMany({
    where: { id: memberId, teamId },
    data: { status: 'removed' },
  });

  // #174 PR β: emit team_member_left to the master account. Producer
  // swallows DB errors so a logging hiccup never blocks the removal.
  if (member?.userId) {
    const { emitTeamMemberLeft } = await import('@/lib/notifications/producers');
    await emitTeamMemberLeft(prisma, {
      teamId,
      memberUserId: member.userId,
      memberName: member.user?.fullName ?? null,
    });
  }
}
