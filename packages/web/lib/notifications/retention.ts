/**
 * 90-day retention for the master-account notification feed (#174).
 *
 * Ryan-confirmed retention horizon: 90 days. Older feed-scoped alerts are
 * pruned so the table size + the unread query stay bounded.
 *
 * Exposed as a pure function so a cron (separate PR — production cleanup
 * lives in the orchestrator process which already runs nightly tasks) can
 * call it without a route. Tests cover the cutoff math + the
 * feed-only filter so the legacy /alerts data is never touched.
 */

import type { PrismaClient } from '@story-magic/shared';
import { FEED_ALERT_TYPES, FEED_RETENTION_DAYS } from './feed-types';

export interface CleanupResult {
  cutoff: Date;
  deleted: number;
}

/**
 * Delete feed alerts older than `FEED_RETENTION_DAYS`. Caller passes its
 * own PrismaClient so this can be invoked from either the web process or
 * a long-running orchestrator cron.
 *
 * Bounded by `alertType IN (FEED_ALERT_TYPES)` — never touches legacy
 * alerts like comment notifications or share invites.
 */
export async function pruneStaleFeedAlerts(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<CleanupResult> {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - FEED_RETENTION_DAYS);

  const result = await prisma.alert.deleteMany({
    where: {
      alertType: { in: [...FEED_ALERT_TYPES] },
      createdAt: { lt: cutoff },
    },
  });

  return { cutoff, deleted: result.count };
}
