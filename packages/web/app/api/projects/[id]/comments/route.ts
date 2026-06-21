/**
 * GET  /api/projects/[id]/comments — list all comments + reactions
 * POST /api/projects/[id]/comments — create a comment or upsert a reaction
 *
 * Access: project owner OR active TeamShare member OR ScriptShare recipient.
 *
 * POST body:
 *   { text?: string, sceneIndex?: number, audioTimestampMs?: number }  — text note
 *   { reactionType: 'like'|'dislike'|'undecided', sceneIndex: number } — reaction upsert
 *   (one field required: text or reactionType)
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { errorResponse } from '@/lib/api/error-response';
import { log } from '@/lib/logger';
import { notifyNewComment } from '@/lib/comments/notify';
import { ensureProfile } from '@/lib/ensure-profile';
import { activeMemberWhere } from '@/lib/services/projects';

type RouteParams = { params: Promise<{ id: string }> };

const REACTION_TYPES = ['like', 'dislike', 'undecided'] as const;

const CreateCommentSchema = z
  .object({
    text: z.string().min(1).max(2000).optional(),
    body: z.string().min(1).max(2000).optional(), // backward compat alias for text
    sceneIndex: z.number().int().nonnegative().optional(),
    audioTimestampMs: z.number().int().nonnegative().nullish(),
    reactionType: z.enum(REACTION_TYPES).optional(),
  })
  .refine((d) => d.text ?? d.body ?? d.reactionType, {
    message: 'At least one of text or reactionType is required',
  });

async function getAccessibleProject(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: { id: true, userId: true, name: true },
  });
  if (!project) return null;
  if (project.userId === userId) return project;

  // Use the canonical helper so the deactivation filter never drifts again
  // (regression caught by automated security review 2026-06-10).
  // 2026-06-19: also require a matching ProjectAssignment for non-owners,
  // mirroring withProjectAuth in lib/api/middleware.ts. Without this check
  // sub-accounts who are TeamMembers but not assigned to a specific project
  // could still post comments (BUG B: "Failed to save" — actually surfaced
  // as 404/silent fail). And master accounts viewing a shared project
  // wouldn't see sub-account notes because the sub-accounts never saved.
  const teamShare = await prisma.teamShare.findFirst({
    where: { projectId, team: { members: { some: activeMemberWhere(userId) } } },
    select: { id: true },
  });
  if (teamShare) {
    const assignment = await prisma.projectAssignment.findFirst({
      where: { projectId, userId },
      select: { id: true },
    });
    if (assignment) return project;
  }

  const scriptShare = await prisma.scriptShare.findFirst({
    where: { projectId, sharedWith: userId },
    select: { id: true },
  });
  if (scriptShare) return project;

  return null;
}

const COMMENT_SELECT = {
  id: true,
  body: true,
  reactionType: true,
  sceneIndex: true,
  audioTimestampMs: true,
  createdAt: true,
  userId: true,
  author: { select: { fullName: true, email: true } },
} as const;

function shapeComment(c: {
  id: string;
  body: string | null;
  reactionType: string | null;
  sceneIndex: number | null;
  audioTimestampMs: number | null;
  createdAt: Date;
  userId: string;
  author: { fullName: string | null; email: string | null };
}) {
  return {
    id: c.id,
    text: c.body,
    reactionType: c.reactionType,
    sceneIndex: c.sceneIndex,
    audioTimestampMs: c.audioTimestampMs,
    createdAt: c.createdAt,
    userId: c.userId,
    user: { name: c.author.fullName ?? c.author.email ?? 'Unknown' },
  };
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
    select: COMMENT_SELECT,
  });

  return NextResponse.json({ comments: comments.map(shapeComment) });
}

export async function POST(request: Request, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) return errorResponse('Unauthorized', 401);

  const { id: projectId } = await params;

  const project = await getAccessibleProject(projectId, userId);
  if (!project) return errorResponse('Project not found', 404);

  let rawBody: unknown;
  try { rawBody = await request.json(); } catch { return errorResponse('Invalid JSON', 400); }

  const parsed = CreateCommentSchema.safeParse(rawBody);
  if (!parsed.success) return errorResponse(parsed.error.errors[0]?.message ?? 'Invalid input', 400);

  const { text, body: bodyAlias, sceneIndex, audioTimestampMs, reactionType } = parsed.data;
  const noteText = text ?? bodyAlias ?? null;

  // Ensure profile exists before FK-constrained INSERT (Clerk webhook may not have fired yet)
  try {
    await ensureProfile(userId);
  } catch (err) {
    log.error('[Comments] ensureProfile failed', { userId, error: err });
    return errorResponse('Profile not ready — please refresh and try again', 503);
  }

  // Reaction upsert: atomic delete-then-insert to prevent duplicate rows under concurrent requests
  // 2026-06-19: wrapped in try/catch so a Prisma FK / constraint / connection
  // error surfaces as a 500 with a logged reason instead of falling through
  // to Next.js as an unhandled rejection. Ryan's "Failed to save" toast was
  // a sub-account hitting the transaction without a matching profile FK or
  // a stale Clerk session — without this catch the client just sees a
  // generic 500 and the log loses the original Prisma error.
  let comment;
  try {
    comment = await prisma.$transaction(async (tx) => {
      if (reactionType && sceneIndex != null) {
        await tx.projectComment.deleteMany({
          where: { projectId, userId, sceneIndex, reactionType: { not: null } },
        });
      } else if (reactionType && sceneIndex == null) {
        // 2026-06-21 — Ryan 6/21 item n: project-level reaction
        // (Like / Dislike / Undecided about the script as a whole).
        // Mirror the scene-level upsert: delete the user's existing
        // project-level reaction so only the latest stands.
        await tx.projectComment.deleteMany({
          where: { projectId, userId, sceneIndex: null, reactionType: { not: null } },
        });
      }
      return tx.projectComment.create({
        data: {
          projectId,
          userId,
          body: noteText,
          reactionType: reactionType ?? null,
          sceneIndex: sceneIndex ?? null,
          audioTimestampMs: audioTimestampMs ?? null,
        },
        select: COMMENT_SELECT,
      });
    });
  } catch (err) {
    log.error('[Comments] save failed', {
      projectId,
      userId,
      hasReaction: !!reactionType,
      hasNote: !!noteText,
      error: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to save note. Please refresh and try again.', 500);
  }

  if (noteText && project.userId !== userId) {
    notifyNewComment({ projectId, projectName: project.name, comment: { ...comment, body: noteText }, ownerId: project.userId })
      .catch(() => {});
  }

  // #331 (2026-06-17): emit master-notification when a sub-account marks
  // a like / pass / undecided reaction. resolveProjectMaster in the producer
  // already skips emission when the actor IS the project owner.
  if (reactionType) {
    try {
      const { emitDecisionMade } = await import('@/lib/notifications/producers');
      await emitDecisionMade(prisma, {
        projectId,
        actorUserId: userId,
        decision: reactionType,
        sceneIndex: sceneIndex ?? null,
      });
    } catch (err) {
      log.warn('[Comments] emitDecisionMade failed', { err: err instanceof Error ? err.message : String(err) });
    }
  }

  // Log to every team's activity feed that has this project shared.
  // Fire-and-forget — don't block or fail the response if this write fails.
  const activityEventType = reactionType
    ? ({ like: 'liked', dislike: 'passed', undecided: 'undecided' } as const)[reactionType]
    : 'note_added';
  const activityMetadata = noteText ? { noteSnippet: noteText.slice(0, 100) } : {};
  prisma.teamShare.findMany({ where: { projectId }, select: { teamId: true } })
    .then((shares) =>
      Promise.all(
        shares.map(({ teamId }) =>
          prisma.activityLog.create({
            data: { teamId, userId, projectId, eventType: activityEventType, metadata: activityMetadata },
          })
        )
      )
    )
    .catch(() => {});

  log.info('[Comments] created', { projectId, userId, hasReaction: !!reactionType });
  return NextResponse.json({ comment: shapeComment(comment) }, { status: 201 });
}
