/**
 * GET  /api/projects/[id]/comments — list all shared comments
 * POST /api/projects/[id]/comments — add a comment
 *
 * Access: project owner OR active TeamShare member OR ScriptShare recipient.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { errorResponse } from '@/lib/api/error-response';
import { log } from '@/lib/logger';
import { notifyNewComment } from '@/lib/comments/notify';

type RouteParams = { params: Promise<{ id: string }> };

const CreateCommentSchema = z.object({
  body: z.string().min(1).max(2000),
  sceneIndex: z.number().int().nonnegative().optional(),
  audioTimestampMs: z.number().int().nonnegative().optional(),
});

// Returns the project if caller has access, null otherwise.
async function getAccessibleProject(projectId: string, userId: string) {
  // Owner check
  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: { id: true, userId: true, name: true },
  });
  if (!project) return null;
  if (project.userId === userId) return project;

  // TeamShare: caller is an accepted member of a team that has this project shared
  const teamShare = await prisma.teamShare.findFirst({
    where: {
      projectId,
      team: {
        members: { some: { userId, status: 'accepted' } },
      },
    },
    select: { id: true },
  });
  if (teamShare) return project;

  // ScriptShare: caller has been shared this project individually
  const scriptShare = await prisma.scriptShare.findFirst({
    where: { projectId, sharedWithId: userId },
    select: { id: true },
  });
  if (scriptShare) return project;

  return null;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) return errorResponse('Unauthorized', 401);

  const { id: projectId } = await params;

  const project = await getAccessibleProject(projectId, userId);
  if (!project) return errorResponse('Project not found', 404);

  const comments = await prisma.projectComment.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      body: true,
      sceneIndex: true,
      audioTimestampMs: true,
      createdAt: true,
      userId: true,
      author: { select: { fullName: true, email: true } },
    },
  });

  return NextResponse.json({ comments });
}

export async function POST(request: Request, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) return errorResponse('Unauthorized', 401);

  const { id: projectId } = await params;

  const project = await getAccessibleProject(projectId, userId);
  if (!project) return errorResponse('Project not found', 404);

  let body: unknown;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON', 400); }

  const parsed = CreateCommentSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.errors[0]?.message ?? 'Invalid input', 400);

  const comment = await prisma.projectComment.create({
    data: {
      projectId,
      userId,
      body: parsed.data.body,
      sceneIndex: parsed.data.sceneIndex ?? null,
      audioTimestampMs: parsed.data.audioTimestampMs ?? null,
    },
    select: {
      id: true,
      body: true,
      sceneIndex: true,
      audioTimestampMs: true,
      createdAt: true,
      userId: true,
      author: { select: { fullName: true, email: true } },
    },
  });

  // Fire-and-forget: notify project owner if commenter is not the owner
  if (project.userId !== userId) {
    notifyNewComment({ projectId, projectName: project.name, comment, ownerId: project.userId })
      .catch(() => {});
  }

  log.info('[Comments] created', { projectId, userId });
  return NextResponse.json(comment, { status: 201 });
}
