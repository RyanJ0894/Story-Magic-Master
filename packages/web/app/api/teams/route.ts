/**
 * Teams API Route
 *
 * GET /api/teams - List user's teams (owned and member of)
 * POST /api/teams - Create a new team
 */

import { withAuth, parseBody } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { log } from '@/lib/logger';

// =============================================================================
// Validation
// =============================================================================

const CreateTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100),
  description: z.string().max(500).optional(),
  defaultShareAccess: z.enum(['stream', 'download']).optional(),
  autoShareNewProjects: z.boolean().optional(),
});

// =============================================================================
// GET - List teams
// =============================================================================

export const GET = withAuth(async (request, { userId, prisma }) => {
  try {
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

    // Include combined `teams` array for client compatibility
    const allTeams = [
      ...ownedTeams.map(t => ({ ...t, role: 'owner' as const })),
      ...memberTeams,
    ];

    return NextResponse.json({
      owned: ownedTeams,
      member: memberTeams,
      teams: allTeams,
    });
  } catch (error) {
    log.error('[Teams] Error listing', error);
    return NextResponse.json(
      {
        error: 'Failed to list teams',
        code: 'LIST_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});

// =============================================================================
// POST - Create team
// =============================================================================

export const POST = withAuth(async (request, { userId, prisma }) => {
  const parsed = await parseBody(request, CreateTeamSchema);
  if ('error' in parsed) return parsed.error;

  const { name, description, defaultShareAccess, autoShareNewProjects } = parsed.data;

  try {
    const team = await prisma.team.create({
      data: {
        ownerId: userId,
        name,
        description: description || null,
        defaultShareAccess: defaultShareAccess || 'stream',
        autoShareNewProjects: autoShareNewProjects || false,
      },
    });

    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    log.error('[Teams] Error creating', error);
    return NextResponse.json(
      {
        error: 'Failed to create team',
        code: 'CREATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});
