/**
 * Tests for provisionTier — DT-30-M-1 (2026-06-14 code review).
 *
 * What we're locking in:
 *   1. Every call updates profile.subscriptionTier AND writes a subscription
 *      row. The /api/upgrade dev route previously wrote ONLY the profile,
 *      leaving llm_call_log cost rollups blind to those users.
 *   2. The find-existing-or-create logic runs INSIDE the transaction, not
 *      before it — preventing the duplicate-active-row race.
 *   3. setProfileStatus only flips subscriptionStatus when explicitly opted
 *      in (referral/upgrade does; admin/tier does not).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provisionTier, TIER_LIMITS } from '@/lib/services/tier-provision';

type Prisma = Parameters<typeof provisionTier>[0];

function makeTx(opts: {
  existing?: { id: string } | null;
  createdId?: string;
} = {}) {
  const profileUpdate = vi.fn().mockResolvedValue({ id: 'u-1' });
  const subFindFirst = vi.fn().mockResolvedValue(opts.existing ?? null);
  const subUpdate = vi.fn().mockResolvedValue({ id: opts.existing?.id ?? 'sub-existing' });
  const subCreate = vi.fn().mockResolvedValue({ id: opts.createdId ?? 'sub-new' });

  return {
    profile: { update: profileUpdate },
    subscription: { findFirst: subFindFirst, update: subUpdate, create: subCreate },
  };
}

function makePrisma(tx: ReturnType<typeof makeTx>) {
  // Interactive transaction form: $transaction(async (tx) => …, { isolationLevel })
  const $transaction = vi.fn().mockImplementation(
    async (callback: (txArg: typeof tx) => Promise<unknown>) => callback(tx),
  );
  return { $transaction } as unknown as Prisma;
}

describe('provisionTier', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes both profile AND subscription in the same transaction (no profile-only path)', async () => {
    const tx = makeTx({ existing: { id: 'sub-1' } });
    const prisma = makePrisma(tx);

    await provisionTier(prisma, { userId: 'u-1', tier: 'pro' });

    expect(tx.profile.update).toHaveBeenCalledOnce();
    expect(tx.subscription.update).toHaveBeenCalledOnce();
    expect(tx.subscription.create).not.toHaveBeenCalled();
  });

  it('creates a subscription row when none exists', async () => {
    const tx = makeTx({ existing: null });
    const prisma = makePrisma(tx);

    const result = await provisionTier(prisma, { userId: 'u-1', tier: 'studio' });

    expect(tx.subscription.create).toHaveBeenCalledOnce();
    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(result.created).toBe(true);
  });

  it('updates the latest existing subscription row instead of creating a duplicate', async () => {
    const tx = makeTx({ existing: { id: 'sub-existing' } });
    const prisma = makePrisma(tx);

    const result = await provisionTier(prisma, { userId: 'u-1', tier: 'enterprise' });

    expect(result.created).toBe(false);
    expect(tx.subscription.update).toHaveBeenCalledOnce();
    expect(tx.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-existing' },
        data: expect.objectContaining({ plan: 'enterprise', status: 'active' }),
      }),
    );
  });

  it('applies the correct TIER_LIMITS to the created subscription row', async () => {
    const tx = makeTx({ existing: null });
    const prisma = makePrisma(tx);

    await provisionTier(prisma, { userId: 'u-1', tier: 'enterprise' });

    expect(tx.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          plan: 'enterprise',
          generationsLimit: TIER_LIMITS.enterprise.generations,
          downloadsLimit: TIER_LIMITS.enterprise.downloads,
        }),
      }),
    );
  });

  it('setProfileStatus=true also writes subscriptionStatus on the profile', async () => {
    const tx = makeTx({ existing: { id: 'sub-1' } });
    const prisma = makePrisma(tx);

    await provisionTier(prisma, { userId: 'u-1', tier: 'pro', setProfileStatus: true });

    expect(tx.profile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subscriptionTier: 'pro',
          subscriptionStatus: 'active',
        }),
      }),
    );
  });

  it('default (admin/tier) does NOT touch subscriptionStatus', async () => {
    const tx = makeTx({ existing: { id: 'sub-1' } });
    const prisma = makePrisma(tx);

    await provisionTier(prisma, { userId: 'u-1', tier: 'pro' });

    const args = tx.profile.update.mock.calls[0][0];
    expect(args.data.subscriptionTier).toBe('pro');
    expect(args.data).not.toHaveProperty('subscriptionStatus');
  });

  it('falls back to creator limits for an unknown tier', async () => {
    const tx = makeTx({ existing: null });
    const prisma = makePrisma(tx);

    await provisionTier(prisma, { userId: 'u-1', tier: 'university' });

    // 'university' is valid in the upgrade route's VALID_TIERS but absent from
    // TIER_LIMITS — we fall back to creator-tier limits rather than throwing,
    // matching the original behavior of admin/tier and referral/upgrade.
    expect(tx.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          plan: 'university',
          generationsLimit: TIER_LIMITS.creator.generations,
          downloadsLimit: TIER_LIMITS.creator.downloads,
        }),
      }),
    );
  });

  it('runs subscription.findFirst INSIDE the transaction (the bug fix)', async () => {
    // The whole point of DT-30-M-1: the existing-subscription check must
    // happen on the same connection as the write so concurrent callers
    // observing "no row" cannot both race into create. We verify this by
    // checking findFirst is called on the tx object, not on prisma itself.
    const tx = makeTx({ existing: null });
    const prisma = makePrisma(tx);

    await provisionTier(prisma, { userId: 'u-1', tier: 'pro' });

    expect(tx.subscription.findFirst).toHaveBeenCalledOnce();
  });

  it('calls $transaction with Serializable isolation', async () => {
    const tx = makeTx({ existing: null });
    const prisma = makePrisma(tx);
    const txSpy = vi.spyOn(prisma, '$transaction');

    await provisionTier(prisma, { userId: 'u-1', tier: 'pro' });

    // The second arg to $transaction is the options object — confirm
    // isolationLevel is passed.
    const callArgs = txSpy.mock.calls[0];
    expect(callArgs[1]).toMatchObject({ isolationLevel: 'Serializable' });
  });
});
