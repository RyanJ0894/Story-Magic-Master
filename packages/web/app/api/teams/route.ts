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
import { listTeams, createTeam } from '@/lib/services/teams';

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
    const result = await listTeams(prisma, userId);
    return NextResponse.json(result);
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
    const team = await createTeam(prisma, userId, {
      name,
      description,
      defaultShareAccess,
      autoShareNewProjects,
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
