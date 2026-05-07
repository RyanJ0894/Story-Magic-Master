/**
 * PATCH /api/admin/review-queue/[id] — approve or reject a human review
 * Body: { decision: 'approved' | 'rejected', reviewerNotes?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { sendHumanReviewDecisionEmail } from '@/lib/email/resend';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.storymagicapp.net';

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { userType: true },
  });
  return profile?.userType === 'admin' ? userId : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await request.json() as { decision?: string; reviewerNotes?: string };
  const { decision, reviewerNotes } = body;

  if (decision !== 'approved' && decision !== 'rejected') {
    return NextResponse.json(
      { error: 'decision must be "approved" or "rejected"' },
      { status: 400 },
    );
  }

  const review = await prisma.humanReview.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      userId: true,
      projectId: true,
      jobId: true,
    },
  });

  if (!review) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 });
  }

  if (review.status !== 'pending') {
    return NextResponse.json({ error: 'Review already resolved' }, { status: 409 });
  }

  const now = new Date();

  await prisma.humanReview.update({
    where: { id },
    data: {
      status: decision,
      reviewerNotes: reviewerNotes ?? null,
      reviewedAt: now,
      reviewedBy: adminId,
    },
  });

  // Notify the customer
  const [profile, project, audioOutput] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: review.userId },
      select: { email: true, fullName: true },
    }),
    prisma.project.findUnique({
      where: { id: review.projectId },
      select: { name: true },
    }),
    prisma.audioOutput.findFirst({
      where: { jobId: review.jobId },
      orderBy: { createdAt: 'desc' },
      select: { filePath: true },
    }),
  ]);

  if (profile?.email) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const audioUrl = audioOutput?.filePath && supabaseUrl
      ? `${supabaseUrl}/storage/v1/object/public/${audioOutput.filePath}`
      : undefined;

    const notified = await sendHumanReviewDecisionEmail({
      to: profile.email,
      customerName: profile.fullName ?? 'Creator',
      projectName: project?.name ?? 'Your project',
      decision,
      reviewerNotes,
      projectUrl: `${APP_URL}/projects/${review.projectId}`,
      audioUrl,
    });

    if (notified.success) {
      await prisma.humanReview.update({
        where: { id },
        data: { notifiedCustomerAt: new Date() },
      });
    }
  }

  return NextResponse.json({ success: true, decision });
}
