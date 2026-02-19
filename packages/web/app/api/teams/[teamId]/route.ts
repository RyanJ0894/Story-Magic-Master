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
import {
  getTeam,
  updateTeam,
  deleteTeam,
  TeamServiceError,
} from '@/lib/services/teams';

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
    const result = await getTeam(prisma, teamId, userId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TeamServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
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

  const parsed = await parseBody(request, UpdateTeamSchema);
  if ('error' in parsed) return parsed.error;

  const data = parsed.data;

  try {
    const updated = await updateTeam(prisma, teamId, userId, {
      name: data.name,
      description: data.description,
      defaultShareAccess: data.defaultShareAccess,
      autoShareNewProjects: data.autoShareNewProjects,
    });

    return NextResponse.json({ team: updated });
  } catch (error) {
    if (error instanceof TeamServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
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

  try {
    const result = await deleteTeam(prisma, teamId, userId);
    return NextResponse.json({ success: true, deletedTeam: result.teamName });
  } catch (error) {
    if (error instanceof TeamServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
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
