/**
 * Team Activity Log API
 *
 * GET  /api/teams/[teamId]/activity          - List team activity (master account only)
 * POST /api/teams/[teamId]/activity          - Log an activity event (sub-users)
 */

import { withAuth, parseBody, errorResponse } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { log } from '@/lib/logger';

const EVENT_TYPES = [
  'listen_start',
  'listen_progress',
  'listen_complete',
  'note_added',
  'liked',
  'passed',
  'undecided',
] as const;

const LogActivitySchema = z.object({
  projectId: z.string().uuid(),
  eventType: z.enum(EVENT_TYPES),
  metadata: z.record(z.unknown()).optional(),
});

// GET - list activity (owner sees all; members see their own)
export const GET = withAuth(async (request, { userId, prisma, params }) => {
  const teamId = params.teamId;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
  const memberId = searchParams.get('memberId');
  const projectId = searchParams.get('projectId');

  try {
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { ownerId: true } });
    if (!team) return errorResponse('Team not found', 404);

    const isOwner = team.ownerId === userId;
    // Members can only see their own activity; owners see all
    const userFilter = isOwner ? (memberId ? { userId: memberId } : {}) : { userId };

    const activities = await prisma.activityLog.findMany({
      where: { teamId, ...userFilter, ...(projectId ? { projectId } : {}) },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ activities });
  } catch (error) {
    log.error('[Activity] GET error', error instanceof Error ? error : undefined);
    return errorResponse('Failed to fetch activity', 500);
  }
});

// POST - log an event
export const POST = withAuth(async (request, { userId, prisma, params }) => {
  const teamId = params.teamId;

  const parsed = await parseBody(request, LogActivitySchema);
  if ('error' in parsed) return parsed.error;

  const { projectId, eventType, metadata = {} } = parsed.data;

  try {
    // Verify membership
    const member = await prisma.teamMember.findFirst({
      where: { teamId, userId, status: 'accepted' },
    });
    const isOwner = (await prisma.team.findUnique({ where: { id: teamId }, select: { ownerId: true } }))?.ownerId === userId;

    if (!member && !isOwner) return errorResponse('Not a team member', 403);

    const activity = await prisma.activityLog.create({
      data: { teamId, userId, projectId, eventType, metadata: metadata as object },
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    log.error('[Activity] POST error', error instanceof Error ? error : undefined);
    return errorResponse('Failed to log activity', 500);
  }
});
