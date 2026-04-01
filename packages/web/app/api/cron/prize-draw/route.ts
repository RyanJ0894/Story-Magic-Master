import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendPrizeDrawWinnerEmail } from '@/lib/email/impact';
import { log } from '@/lib/logger';

export const maxDuration = 60;

/**
 * POST /api/cron/prize-draw
 *
 * Runs on the last day of each month (via Render cron).
 * Selects one random prize-eligible story from the current month, marks it as the winner,
 * notifies the winner and admin via email.
 *
 * Protected by CRON_SECRET header.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const drawMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Idempotency check: don't run twice in same month
  const existing = await prisma.impactPrizeDraw.findFirst({
    where: { drawMonth, isWinner: true },
  });
  if (existing) {
    log.info('[PrizeDraw] Draw already completed for this month', { drawMonth });
    return NextResponse.json({ skipped: true, drawMonth, reason: 'already_run' });
  }

  // Find all prize-eligible, public, approved, complete stories created this month
  // that haven't won before
  const monthStart = new Date(`${drawMonth}-01T00:00:00.000Z`);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1); // first of next month

  const eligible = await prisma.impactStory.findMany({
    where: {
      prizeEligible: true,
      isPublic: true,
      isApproved: true,
      status: 'complete',
      createdAt: { gte: monthStart, lt: monthEnd },
      prizeEntries: {
        none: { isWinner: true }, // never won before
      },
    },
    select: {
      id: true,
      title: true,
      userId: true,
    },
  });

  if (eligible.length === 0) {
    log.info('[PrizeDraw] No eligible stories this month', { drawMonth });
    return NextResponse.json({ skipped: true, drawMonth, reason: 'no_eligible_stories' });
  }

  // Pick one at random
  const winner = eligible[Math.floor(Math.random() * eligible.length)];

  // Record the draw entry as winner
  await prisma.impactPrizeDraw.create({
    data: {
      storyId: winner.id,
      drawMonth,
      isWinner: true,
      notifiedAt: new Date(),
    },
  });

  // Get winner email
  let winnerEmail: string | null = null;
  if (winner.userId) {
    const profile = await prisma.profile.findUnique({
      where: { id: winner.userId },
      select: { email: true },
    });
    winnerEmail = profile?.email ?? null;
  }

  log.info('[PrizeDraw] Winner selected', { drawMonth, storyId: winner.id, winnerEmail });

  if (winnerEmail) {
    await sendPrizeDrawWinnerEmail({
      winnerEmail,
      storyTitle: winner.title,
      drawMonth,
      storyId: winner.id,
    });
  } else {
    log.warn('[PrizeDraw] Winner has no email — admin notified only', { storyId: winner.id });
    // Still send admin alert via the winner email function (it always sends admin copy)
    await sendPrizeDrawWinnerEmail({
      winnerEmail: 'unknown@storymagicapp.net',
      storyTitle: winner.title,
      drawMonth,
      storyId: winner.id,
    });
  }

  return NextResponse.json({
    success: true,
    drawMonth,
    winnerId: winner.id,
    winnerTitle: winner.title,
    notified: !!winnerEmail,
  });
}
