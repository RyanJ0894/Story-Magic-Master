/**
 * Script Reviews
 *
 * GET  /api/projects/[id]/reviews — fetch public reviews for a listed script
 * POST /api/projects/[id]/reviews — submit a review (authenticated reviewer)
 */

import { withAuth, parseBody } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const VERDICTS = ['pass', 'consider', 'recommend', 'strong_recommend'] as const;

const ReviewSchema = z.object({
  verdict: z.enum(VERDICTS),
  numeric_rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(4000).optional(),
  is_anonymous: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// GET — public reviews for a listed project
// ---------------------------------------------------------------------------
export const GET = withAuth(
  async (_request, { prisma, params }) => {
    const projectId = params.id;

    // Ensure the project is publicly listed
    const project = await prisma.project.findFirst({
      where: { id: projectId, exchangeIsPublic: true },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const reviews = await prisma.scriptReview.findMany({
      where: { projectId, isPublic: true },
      orderBy: { createdAt: 'desc' },
      include: {
        reviewer: { select: { fullName: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({
      reviews: reviews.map((r) => ({
        id: r.id,
        verdict: r.verdict,
        numericRating: r.numericRating,
        comment: r.comment,
        createdAt: r.createdAt,
        reviewer: r.isAnonymous
          ? { id: null, fullName: 'Anonymous', avatarUrl: null }
          : {
              id: r.reviewerId,
              fullName: r.reviewer.fullName ?? r.reviewerName,
              avatarUrl: r.reviewer.avatarUrl,
            },
      })),
    });
  },
  { rateLimit: 'normal' }
);

// ---------------------------------------------------------------------------
// POST — submit a review
// ---------------------------------------------------------------------------
export const POST = withAuth(
  async (request, { userId, prisma, params }) => {
    const projectId = params.id;

    // Cannot review your own script
    const project = await prisma.project.findFirst({
      where: { id: projectId, exchangeIsPublic: true },
      select: { id: true, userId: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Script not found or not public' }, { status: 404 });
    }
    if (project.userId === userId) {
      return NextResponse.json({ error: 'Cannot review your own script' }, { status: 400 });
    }

    const parsed = await parseBody(request, ReviewSchema);
    if ('error' in parsed) return parsed.error;

    const { verdict, numeric_rating, comment, is_anonymous } = parsed.data;

    // Fetch reviewer name for denormalized storage
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });

    // Upsert (one review per reviewer per project)
    const review = await prisma.scriptReview.upsert({
      where: { projectId_reviewerId: { projectId, reviewerId: userId } },
      create: {
        projectId,
        reviewerId: userId,
        reviewerName: profile?.fullName ?? null,
        verdict,
        numericRating: numeric_rating ?? null,
        comment: comment ?? null,
        isAnonymous: is_anonymous,
        isPublic: true,
      },
      update: {
        verdict,
        numericRating: numeric_rating ?? null,
        comment: comment ?? null,
        isAnonymous: is_anonymous,
        reviewerName: profile?.fullName ?? null,
      },
    });

    return NextResponse.json({ review }, { status: 201 });
  },
  { rateLimit: 'normal' }
);
