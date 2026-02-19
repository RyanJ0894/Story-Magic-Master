/**
 * Teams Service
 *
 * Pure business logic for team CRUD and membership operations.
 * No HTTP request/response handling — routes call these functions
 * and translate results into HTTP responses.
 */

import type { PrismaClient } from '@prisma/client';
import { sendTeamInviteEmail } from '@/lib/email';
import { log } from '@/lib/logger';

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
  role?: 'admin' | 'member' | 'viewer';
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
    },
    orderBy: { createdAt: 'desc' },
  });

  // Get teams user is a member of
  const memberships = await prisma.teamMember.findMany({
    where: {
      userId,
      status: 'accepted',
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

  const memberTeams = memberships.map((m) => ({
    ...m.team,
    membership: {
      id: m.id,
      role: m.role,
      status: m.status,
    },
  }));

  const allTeams = [
    ...ownedTeams.map((t) => ({ ...t, role: 'owner' as const })),
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
      where: { teamId, userId, status: 'accepted' },
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
      where: { teamId, userId, status: 'accepted' },
      select: { id: true },
    });

    if (!membership) {
      throw new TeamServiceError('Access denied', 'FORBIDDEN', 403);
    }
  }

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

  // Check if already invited
  const existing = await prisma.teamMember.findFirst({
    where: { teamId, invitedEmail: email },
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

  // Check if user exists
  const existingUser = await prisma.profile.findFirst({
    where: { email },
    select: { id: true, fullName: true },
  });

  // Get inviter's name
  const inviterProfile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { fullName: true },
  });

  // Create the invite
  const member = await prisma.teamMember.create({
    data: {
      teamId,
      userId: existingUser?.id || null,
      invitedEmail: email,
      role: input.role || 'member',
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

  await prisma.teamMember.updateMany({
    where: { id: memberId, teamId },
    data: { status: 'removed' },
  });
}
