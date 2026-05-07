/**
 * DELETE /api/projects/[id]/comments/[commentId] — delete own comment
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { errorResponse } from '@/lib/api/error-response';

type RouteParams = { params: Promise<{ id: string; commentId: string }> };

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) return errorResponse('Unauthorized', 401);

  const { commentId } = await params;

  const comment = await prisma.projectComment.findUnique({
    where: { id: commentId },
    select: { userId: true },
  });
  if (!comment) return errorResponse('Comment not found', 404);
  if (comment.userId !== userId) return errorResponse('Forbidden', 403);

  await prisma.projectComment.delete({ where: { id: commentId } });
  return NextResponse.json({ success: true });
}
