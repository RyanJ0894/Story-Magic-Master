/**
 * Tests for pruneStaleFeedAlerts (#174 PR α).
 *
 * Pins:
 *   - cutoff is exactly 90 days before `now`
 *   - delete filter restricts to FEED_ALERT_TYPES (legacy alerts never touched)
 *   - createdAt comparison uses `lt`, not `lte` (boundary safety)
 *   - returns the prisma updateMany result count
 */

import { describe, it, expect, vi } from 'vitest';
import { pruneStaleFeedAlerts } from '@/lib/notifications/retention';
import { FEED_ALERT_TYPES } from '@/lib/notifications/feed-types';

function makeMockPrisma(deletedCount: number) {
  const deleteMany = vi.fn(async () => ({ count: deletedCount }));
  return {
    deleteMany,
    prisma: { alert: { deleteMany } } as unknown as Parameters<typeof pruneStaleFeedAlerts>[0],
  };
}

describe('pruneStaleFeedAlerts', () => {
  it('returns the delete count from Prisma', async () => {
    const { prisma } = makeMockPrisma(42);
    const r = await pruneStaleFeedAlerts(prisma);
    expect(r.deleted).toBe(42);
  });

  it('computes cutoff = now - 90 days', async () => {
    const { prisma, deleteMany } = makeMockPrisma(0);
    const now = new Date('2026-06-09T00:00:00Z');
    const r = await pruneStaleFeedAlerts(prisma, now);

    const expectedCutoff = new Date('2026-03-11T00:00:00Z');
    expect(r.cutoff.getTime()).toBe(expectedCutoff.getTime());
    // Filter passed to Prisma also uses the cutoff
    expect(deleteMany.mock.calls[0][0].where.createdAt.lt.getTime()).toBe(
      expectedCutoff.getTime(),
    );
  });

  it('only deletes feed-scoped alertTypes — never legacy ones', async () => {
    const { prisma, deleteMany } = makeMockPrisma(0);
    await pruneStaleFeedAlerts(prisma);
    const passedIn = deleteMany.mock.calls[0][0].where.alertType.in;
    expect(passedIn.sort()).toEqual([...FEED_ALERT_TYPES].sort());
    // Make sure a known legacy type is NOT in the delete filter
    expect(passedIn).not.toContain('team_invite');
    expect(passedIn).not.toContain('comment');
  });

  it('uses lt (strict less-than) for cutoff so rows at exactly the boundary survive', async () => {
    const { prisma, deleteMany } = makeMockPrisma(0);
    await pruneStaleFeedAlerts(prisma);
    const filter = deleteMany.mock.calls[0][0].where.createdAt;
    expect(filter).toHaveProperty('lt');
    expect(filter).not.toHaveProperty('lte');
  });
});
