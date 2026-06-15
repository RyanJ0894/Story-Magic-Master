/**
 * Tier provisioning — DT-30-M-1 (2026-06-14 code review)
 *
 * The pre-existing pattern at admin/tier, referral/upgrade was a find-then-
 * decide-then-update across two awaits:
 *
 *   const existing = await prisma.subscription.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
 *   await prisma.$transaction([
 *     prisma.profile.update(...),
 *     existing ? prisma.subscription.update(...) : prisma.subscription.create(...),
 *   ]);
 *
 * The bug is subtle: the findFirst is OUTSIDE the transaction. Two concurrent
 * admin actions on the same user can both observe `existing = null` and both
 * race into `subscription.create`, producing two `active` subscription rows
 * for the same user. The Subscription model intentionally allows multiple
 * historical rows per user (no UNIQUE on userId), so the DB cannot reject
 * the duplicate.
 *
 * With #196's llm_call_log cost-attribution now joining through subscriptions,
 * a duplicate-active-row state would double-count costs for affected users in
 * tier-based usage rollups.
 *
 * Fix: move the find INTO the transaction, and (where Prisma supports it on
 * postgres) wrap the whole flow with `isolationLevel: 'Serializable'` so the
 * read-then-write becomes atomic. The cost is a serialization failure on
 * concurrent calls — but those retries are exactly what we want, not silent
 * duplicate-row creation.
 */

import type { PrismaClient } from '@story-magic/shared';
import { Prisma } from '@story-magic/shared';

export const TIER_LIMITS: Record<string, { generations: number; downloads: number }> = {
  creator:    { generations: 5,    downloads: 1 },
  pro:        { generations: 20,   downloads: 5 },
  studio:     { generations: 100,  downloads: 50 },
  enterprise: { generations: 1000, downloads: 500 },
};

export interface ProvisionTierInput {
  userId: string;
  tier: string;
  /**
   * Optional — set `subscriptionStatus` on the profile when the call has
   * a status to propagate (referral/upgrade does; admin/tier does not).
   */
  setProfileStatus?: boolean;
}

export interface ProvisionTierResult {
  /** id of the subscription row that was created or updated */
  subscriptionId: string;
  /** true if a new row was created; false if an existing row was updated */
  created: boolean;
}

/**
 * Atomically set a user's tier on both `profile.subscriptionTier` and the
 * latest `subscriptions` row, creating a fresh subscription row if none
 * exists.
 *
 * Safe under concurrent calls — the find runs inside the same Serializable
 * transaction as the write, so two callers cannot both observe "no
 * subscription row" and both insert.
 */
export async function provisionTier(
  prisma: PrismaClient,
  input: ProvisionTierInput,
): Promise<ProvisionTierResult> {
  const { userId, tier, setProfileStatus } = input;
  const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.creator;

  return prisma.$transaction(
    async (tx) => {
      await tx.profile.update({
        where: { id: userId },
        data: {
          subscriptionTier: tier,
          ...(setProfileStatus && { subscriptionStatus: 'active' }),
        },
      });

      const existing = await tx.subscription.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      if (existing) {
        const updated = await tx.subscription.update({
          where: { id: existing.id },
          data: {
            plan: tier,
            status: 'active',
            generationsLimit: limits.generations,
            downloadsLimit: limits.downloads,
          },
          select: { id: true },
        });
        return { subscriptionId: updated.id, created: false };
      }

      const created = await tx.subscription.create({
        data: {
          userId,
          plan: tier,
          status: 'active',
          generationsLimit: limits.generations,
          downloadsLimit: limits.downloads,
        },
        select: { id: true },
      });
      return { subscriptionId: created.id, created: true };
    },
    {
      // Serializable so a concurrent caller observing "no subscription" and
      // racing to create cannot succeed; one will see a SerializationFailure
      // and is expected to retry at the route layer (a single retry is fine —
      // a second pass will observe the row the winner inserted).
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}
