/**
 * GET /api/admin/review-queue — list pending human reviews
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { userType: true },
  });
  return profile?.userType === 'admin' ? userId : null;
}

export async function GET() {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const reviews = await prisma.humanReview.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      status: true,
      createdAt: true,
      notifiedReviewerAt: true,
      amountCents: true,
      projectId: true,
      jobId: true,
      userId: true,
      project: {
        select: {
          name: true,
        },
      },
    },
  });

  // Fetch audio URLs from the most recent job output for each review
  const enriched = await Promise.all(
    reviews.map(async (review) => {
      const audioOutput = await prisma.audioOutput.findFirst({
        where: { jobId: review.jobId },
        orderBy: { createdAt: 'desc' },
        select: { filePath: true },
      });

      const profile = await prisma.profile.findUnique({
        where: { id: review.userId },
        select: { fullName: true, email: true },
      });

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const audioUrl = audioOutput?.filePath && supabaseUrl
        ? `${supabaseUrl}/storage/v1/object/public/${audioOutput.filePath}`
        : null;

      return {
        ...review,
        audioUrl,
        customerName: profile?.fullName ?? null,
        customerEmail: profile?.email ?? null,
      };
    }),
  );

  return NextResponse.json({ reviews: enriched });
}
