import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { log } from '@/lib/logger';

export const maxDuration = 60;

/**
 * POST /api/cron/cleanup-logs
 *
 * Nightly job — deletes content_access_log rows older than 90 days.
 * Keeps the table bounded; retention window is sufficient for analytics.
 *
 * Protected by CRON_SECRET header.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const { count } = await prisma.contentAccessLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  log.info('[CleanupLogs] Deleted stale content_access_log rows', { count, cutoffDate: cutoff.toISOString() });

  return NextResponse.json({ deleted: count, cutoffDate: cutoff.toISOString() });
}
