/**
 * Team Detail API Route
 *
 * GET /api/teams/[teamId] - Get team details
 * PATCH /api/teams/[teamId] - Update team name/description
 * DELETE /api/teams/[teamId] - Delete team (owner only)
 */

import { withAuth, parseBody } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { log } from '@/lib/logger';

// =============================================================================
// Validation
// =============================================================================

const UpdateTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  defaultShareAccess: z.enum(['stream', 'download']).optional(),
  autoShareNewProjects: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' },
);

// =============================================================================
// GET - Get team details
// =============================================================================

export const GET = withAuth(async (request, { userId, prisma, params }) => {
  const teamId = params.teamId;

  try {
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
      return NextResponse.json(
        { error: 'Team not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    // Check if user is owner or accepted member
    const isOwner = team.ownerId === userId;
    if (!isOwner) {
      const membership = await prisma.teamMember.findFirst({
        where: { teamId, userId, status: 'accepted' },
        select: { id: true },
      });

      if (!membership) {
        return NextResponse.json(
          { error: 'Access denied', code: 'FORBIDDEN' },
          { status: 403 },
        );
      }
    }

    return NextResponse.json({ team, isOwner });
  } catch (error) {
    log.error('[Teams] Error getting team', error);
    return NextResponse.json(
      {
        error: 'Failed to get team',
        code: 'GET_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
});

// =============================================================================
// PATCH - Update team
// =============================================================================

export const PATCH = withAuth(async (request, { userId, prisma, params }) => {
  const teamId = params.teamId;

  // Only team owner can update
  const team = await prisma.team.findFirst({
    where: { id: teamId, ownerId: userId },
    select: { id: true },
  });

  if (!team) {
    return NextResponse.json(
      { error: 'Team not found or not authorized', code: 'NOT_FOUND' },
      { status: 404 },
    );
  }

  const parsed = await parseBody(request, UpdateTeamSchema);
  if ('error' in parsed) return parsed.error;

  const updates: Record<string, unknown> = {};
  const data = parsed.data;

  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.defaultShareAccess !== undefined) updates.defaultShareAccess = data.defaultShareAccess;
  if (data.autoShareNewProjects !== undefined) updates.autoShareNewProjects = data.autoShareNewProjects;

  try {
    const updated = await prisma.team.update({
      where: { id: teamId },
      data: updates,
    });

    return NextResponse.json({ team: updated });
  } catch (error) {
    log.error('[Teams] Error updating', error);
    return NextResponse.json(
      {
        error: 'Failed to update team',
        code: 'UPDATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
});

// =============================================================================
// DELETE - Delete team (owner only)
// =============================================================================

export const DELETE = withAuth(async (request, { userId, prisma, params }) => {
  const teamId = params.teamId;

  // Only team owner can delete
  const team = await prisma.team.findFirst({
    where: { id: teamId, ownerId: userId },
    select: { id: true, name: true },
  });

  if (!team) {
    return NextResponse.json(
      { error: 'Team not found or not authorized', code: 'NOT_FOUND' },
      { status: 404 },
    );
  }

  try {
    // Delete team members first (cascade should handle it, but be explicit)
    await prisma.teamMember.deleteMany({
      where: { teamId },
    });

    // Delete team shares
    await prisma.teamShare.deleteMany({
      where: { teamId },
    });

    // Delete the team
    await prisma.team.delete({
      where: { id: teamId },
    });

    return NextResponse.json({ success: true, deletedTeam: team.name });
  } catch (error) {
    log.error('[Teams] Error deleting', error);
    return NextResponse.json(
      {
        error: 'Failed to delete team',
        code: 'DELETE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
});
