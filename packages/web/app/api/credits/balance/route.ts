/**
 * GET /api/credits/balance
 *
 * Returns the authenticated user's scene-credit balance and last 10 transactions.
 * Free-tier users see this before generation; paid-tier users are not gated.
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { errorResponse } from '@/lib/api/error-response';

export const GET = withAuth(async (_request, { userId, prisma }) => {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true, credits: true },
  });

  if (!profile) {
    return errorResponse('Profile not found', 404, { code: 'NOT_FOUND' });
  }

  const transactions = await prisma.creditTransaction.findMany({
    where: { profileId: userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      amount: true,
      reason: true,
      jobId: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ credits: profile.credits, transactions });
});
