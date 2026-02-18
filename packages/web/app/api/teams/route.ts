/**
 * Teams API Route
 *
 * GET /api/teams - List user's teams (owned and member of)
 * POST /api/teams - Create a new team
 */

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCsrf } from '@/lib/csrf';
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

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

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
}

// =============================================================================
// POST - Create team
// =============================================================================

export async function POST(request: Request) {
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'PARSE_ERROR' }, { status: 400 });
  }

  const parseResult = CreateTeamSchema.safeParse(body);
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

  const { name, description, defaultShareAccess, autoShareNewProjects } = parseResult.data;

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
}
