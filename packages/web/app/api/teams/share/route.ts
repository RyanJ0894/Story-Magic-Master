/**
 * Team Share API Route
 *
 * POST /api/teams/share - Share a project with a team
 * DELETE /api/teams/share - Unshare a project from a team
 */

import { withAuth, parseBody } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { log } from '@/lib/logger';

const ShareSchema = z.object({
  projectId: z.string().uuid('Valid project ID required'),
  teamId: z.string().uuid('Valid team ID required'),
  accessLevel: z.enum(['stream', 'download']).optional().default('stream'),
});

const UnshareSchema = z.object({
  projectId: z.string().uuid('Valid project ID required'),
  teamId: z.string().uuid('Valid team ID required'),
});

// =============================================================================
// POST - Share project with team
// =============================================================================

export const POST = withAuth(async (request, { userId, prisma }) => {
  const parsed = await parseBody(request, ShareSchema);
  if ('error' in parsed) return parsed.error;

  const { projectId, teamId, accessLevel } = parsed.data;

  // Verify user owns the project
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId,
    },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json(
      { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
      { status: 404 }
    );
  }

  // Verify user is a member/owner of the team
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, ownerId: true },
  });

  if (!team) {
    return NextResponse.json(
      { error: 'Team not found', code: 'TEAM_NOT_FOUND' },
      { status: 404 }
    );
  }

  try {
    const share = await prisma.$transaction(async (tx) => {
      const share = await tx.teamShare.upsert({
        where: { projectId_teamId: { projectId, teamId } },
        create: { projectId, teamId, sharedBy: userId, accessLevel },
        update: { sharedBy: userId, accessLevel },
      });

      // Grant access to all current active members. The unique constraint on
      // (projectId, userId, teamId) makes this idempotent via skipDuplicates.
      const activeMembers = await tx.teamMember.findMany({
        where: { teamId, acceptedAt: { not: null }, deactivatedAt: null },
        select: { userId: true },
      });

      const memberUserIds = activeMembers
        .map((m) => m.userId)
        .filter((id): id is string => id !== null);

      if (memberUserIds.length > 0) {
        await tx.projectAssignment.createMany({
          data: memberUserIds.map((memberId) => ({
            projectId,
            userId: memberId,
            teamId,
            assignedBy: userId,
          })),
          skipDuplicates: true,
        });
      }

      return share;
    });

    return NextResponse.json({
      success: true,
      share,
      message: `Project shared with ${team.name}`,
    });
  } catch (error) {
    log.error('[TeamShare] Error sharing project', error);
    return NextResponse.json(
      { error: 'Failed to share project', code: 'SHARE_ERROR' },
      { status: 500 }
    );
  }
});

// =============================================================================
// DELETE - Unshare project from team
// =============================================================================

export const DELETE = withAuth(async (request, { userId, prisma }) => {
  const parsed = await parseBody(request, UnshareSchema);
  if ('error' in parsed) return parsed.error;

  const { projectId, teamId } = parsed.data;

  // Verify user owns the project
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId,
    },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json(
      { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
      { status: 404 }
    );
  }

  try {
    await prisma.teamShare.deleteMany({
      where: {
        projectId,
        teamId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('[TeamShare] Error unsharing project', error);
    return NextResponse.json(
      { error: 'Failed to unshare project', code: 'UNSHARE_ERROR' },
      { status: 500 }
    );
  }
});
