import { prisma } from '@/lib/db';
import { log } from '@/lib/logger';
import { sendHumanReviewRequestEmail } from '@/lib/email/resend';

const REVIEWER_EMAIL = process.env.HUMAN_REVIEW_EMAIL || 'reviews@storymagicapp.net';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.storymagicapp.net';

export async function triggerHumanReviewIfPurchased(
  userId: string,
  projectId: string,
  jobId: string,
  orchestratorResult: unknown
): Promise<void> {
  const purchase = await prisma.purchase.findFirst({
    where: { userId, projectId, purchaseType: 'human_review', status: 'completed' },
    select: { id: true },
  });

  if (!purchase) return;

  // Idempotent — don't create a second review for the same job
  const existing = await prisma.humanReview.findUnique({ where: { jobId } });
  if (existing) return;

  const audioUrl = resolveAudioUrl(orchestratorResult);

  const [project, profile] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
    prisma.profile.findUnique({ where: { id: userId }, select: { fullName: true, email: true } }),
  ]);

  const review = await prisma.humanReview.create({
    data: { projectId, jobId, userId },
    select: { id: true },
  });

  const reviewQueueUrl = `${APP_URL}/admin/review-queue`;

  const emailResult = await sendHumanReviewRequestEmail({
    to: REVIEWER_EMAIL,
    projectName: project?.name ?? 'Untitled',
    customerName: profile?.fullName ?? 'A customer',
    reviewQueueUrl,
    audioUrl,
  });

  const notifiedAt = emailResult.success ? new Date() : null;

  if (notifiedAt) {
    await prisma.humanReview.update({
      where: { id: review.id },
      data: { notifiedReviewerAt: notifiedAt },
    });
  }

  log.info('[HumanReview] Review queued', { reviewId: review.id, projectId, emailSent: emailResult.success });
}

function resolveAudioUrl(result: unknown): string | undefined {
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if (typeof r.audioUrl === 'string') return r.audioUrl;
    if (typeof r.audio_url === 'string') return r.audio_url;
  }
  return undefined;
}
