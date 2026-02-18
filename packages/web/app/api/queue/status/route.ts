/**
 * Queue Status API Route
 *
 * GET /api/queue/status - Get queue statistics
 */

import { withAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { getQueueStats } from '@/lib/queue/service';
import { log } from '@/lib/logger';

export const GET = withAuth(async () => {
  try {
    const stats = await getQueueStats();

    return NextResponse.json({
      queue: {
        queued: stats.totalQueued,
        processing: stats.totalProcessing,
        completed24h: stats.totalCompleted24h,
        failed24h: stats.totalFailed24h,
        avgWaitTimeSeconds: stats.avgWaitTimeSeconds,
      },
      byType: stats.statsByType,
    });
  } catch (error) {
    log.error('[Queue] Status error', error);
    return NextResponse.json(
      { error: 'Failed to get queue status', code: 'QUEUE_ERROR' },
      { status: 500 }
    );
  }
});
