/**
 * Queue Status API Route
 *
 * GET /api/queue/status - Get queue statistics
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getQueueStats } from '@/lib/queue/service';

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

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
    console.error('[Queue] Status error:', error);
    return NextResponse.json(
      { error: 'Failed to get queue status', code: 'QUEUE_ERROR' },
      { status: 500 }
    );
  }
}
