import { prisma } from '@/lib/db';
import { log } from '@/lib/logger';
import { sendCommentNotificationEmail } from '@/lib/email/resend';

interface CommentShape {
  id: string;
  body: string;
  sceneIndex?: number | null;
  audioTimestampMs?: number | null;
  author: { fullName?: string | null; email?: string | null };
}

export async function notifyNewComment({
  projectId,
  projectName,
  comment,
  ownerId,
}: {
  projectId: string;
  projectName: string;
  comment: CommentShape;
  ownerId: string;
}): Promise<void> {
  const owner = await prisma.profile.findUnique({
    where: { id: ownerId },
    select: { email: true, fullName: true },
  });
  if (!owner?.email) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.storymagicapp.net';
  const projectUrl = `${appUrl}/projects/${projectId}`;

  const result = await sendCommentNotificationEmail({
    to: owner.email,
    ownerName: owner.fullName ?? 'Creator',
    commenterName: comment.author.fullName ?? comment.author.email ?? 'A collaborator',
    projectName,
    commentBody: comment.body,
    projectUrl,
  });

  log.info('[Comments] owner notified', { projectId, emailSent: result.success });
}
