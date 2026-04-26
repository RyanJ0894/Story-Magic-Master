/**
 * Team Members API Route
 *
 * GET /api/teams/[teamId]/members - List team members
 * POST /api/teams/[teamId]/members - Invite new member (sends email)
 * DELETE /api/teams/[teamId]/members - Remove member
 */

import { withAuth, parseBody, errorResponse } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { log } from '@/lib/logger';
import {
  listMembers,
  addMember,
  removeMember,
  TeamServiceError,
} from '@/lib/services/teams';

// =============================================================================
// Validation
// =============================================================================

const InviteMemberSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.string().min(1).optional(),
});

const RemoveMemberSchema = z.object({
  memberId: z.string().uuid('Valid member ID is required'),
});

// =============================================================================
// GET - List members
// =============================================================================

export const GET = withAuth(async (request, { userId, prisma, params }) => {
  const teamId = params.teamId;

  try {
    const result = await listMembers(prisma, teamId, userId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TeamServiceError) {
      return errorResponse(error.message, error.statusCode, { code: error.code });
    }
    log.error('[TeamMembers] Error listing', error);
    return errorResponse('Failed to list members', 500, { code: 'LIST_ERROR', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// =============================================================================
// POST - Invite member
// =============================================================================

export const POST = withAuth(async (request, { userId, prisma, params }) => {
  const teamId = params.teamId;

  const parsed = await parseBody(request, InviteMemberSchema);
  if ('error' in parsed) return parsed.error;

  const { email, role } = parsed.data;

  try {
    const result = await addMember(prisma, teamId, userId, { email, role });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof TeamServiceError) {
      return errorResponse(error.message, error.statusCode, { code: error.code });
    }
    log.error('[TeamMembers] Error inviting', error);
    return errorResponse('Failed to invite member', 500, { code: 'INVITE_ERROR', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// =============================================================================
// DELETE - Remove member
// =============================================================================

export const DELETE = withAuth(async (request, { userId, prisma, params }) => {
  const teamId = params.teamId;

  const parsed = await parseBody(request, RemoveMemberSchema);
  if ('error' in parsed) return parsed.error;

  const { memberId } = parsed.data;

  try {
    await removeMember(prisma, teamId, userId, memberId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TeamServiceError) {
      return errorResponse(error.message, error.statusCode, { code: error.code });
    }
    log.error('[TeamMembers] Error removing', error);
    return errorResponse('Failed to remove member', 500, { code: 'REMOVE_ERROR', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});
