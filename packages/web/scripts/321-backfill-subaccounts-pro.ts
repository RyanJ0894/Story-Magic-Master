#!/usr/bin/env -S npx tsx
/**
 * #321 — Backfill any pre-existing sub-accounts to Pro plan.
 *
 * Ryan's 2026-06-17 testing batch hit "Insufficient scene credits" on
 * sub-accounts. Two bugs contributed:
 *   1. `PAID_TIERS` at generate/route.ts:106 omitted enterprise — fixed
 *      in the same PR.
 *   2. Sub-accounts that joined BEFORE PR #302 deployed (which added
 *      `INVITE_DEFAULT_TIER=pro`) may still be on Creator (5/mo). This
 *      script handles those legacy rows.
 *
 * Eligibility: a Profile is a "sub-account" if it appears as a non-owner,
 * accepted, NOT deactivated TeamMember of any team.
 *
 * Behavior:
 *   - Default: DRY RUN. Lists what would change. Makes no writes.
 *   - With --apply: runs provisionTier() for each eligible user. Atomic +
 *     serializable per user (DT-30-M-1 pattern), so profile.subscriptionTier
 *     and the latest subscriptions row stay in sync.
 *   - Skips users already on pro / studio / enterprise (don't downgrade).
 *   - Skips users whose CURRENT subscription is Stripe-managed.
 *
 * Usage (prod, from local with Doppler):
 *   EXTERNAL_URL=$(doppler secrets get DIRECT_DATABASE_URL \
 *     --project story-magic --config prd --plain)
 *   DATABASE_URL="$EXTERNAL_URL" \
 *     pnpm --filter @story-magic/web exec tsx \
 *     scripts/321-backfill-subaccounts-pro.ts
 *
 * Verified 2026-06-17 against prod: 1 sub-account in DB, already on
 * enterprise, nothing to migrate. Kept for future use if new legacy
 * sub-accounts appear.
 */

import { PrismaClient } from '@story-magic/shared';
import { provisionTier } from '@/lib/services/tier-provision';

const TARGET_TIER = 'pro';
const APPLY = process.argv.includes('--apply');

async function main() {
  const prisma = new PrismaClient();

  try {
    const subAccounts = await prisma.profile.findMany({
      where: {
        teamMemberships: {
          some: {
            status: 'accepted',
            deactivatedAt: null,
            userId: { not: null },
          },
        },
      },
      select: {
        id: true,
        email: true,
        subscriptionTier: true,
        stripeSubscriptionId: true,
      },
    });

    console.log(`Found ${subAccounts.length} accepted, non-deactivated sub-accounts.`);
    console.log('');

    const eligible: typeof subAccounts = [];
    const skipped: { profile: typeof subAccounts[number]; reason: string }[] = [];

    for (const profile of subAccounts) {
      if (['pro', 'studio', 'enterprise'].includes(profile.subscriptionTier ?? '')) {
        skipped.push({ profile, reason: `already on ${profile.subscriptionTier}` });
        continue;
      }
      if (profile.stripeSubscriptionId) {
        skipped.push({ profile, reason: 'has stripeSubscriptionId — Stripe-managed' });
        continue;
      }
      eligible.push(profile);
    }

    console.log(`Eligible: ${eligible.length}`);
    for (const p of eligible) {
      const email = (p.email ?? '(no email)').padEnd(40);
      console.log(`  - ${email}  ${p.id}  tier=${p.subscriptionTier}`);
    }
    console.log('');
    console.log(`Skipped: ${skipped.length}`);
    for (const { profile, reason } of skipped) {
      const email = (profile.email ?? '(no email)').padEnd(40);
      console.log(`  - ${email}  ${profile.id}  reason=${reason}`);
    }
    console.log('');

    if (!APPLY) {
      console.log('DRY RUN. Re-run with --apply to write changes.');
      return;
    }

    console.log(`Applying provisionTier(${TARGET_TIER}) to ${eligible.length} accounts…`);
    let ok = 0;
    let failed = 0;
    for (const p of eligible) {
      try {
        const result = await provisionTier(prisma, {
          userId: p.id,
          tier: TARGET_TIER,
          setProfileStatus: false,
        });
        console.log(`  ✓ ${p.email ?? p.id}  (subscription ${result.created ? 'created' : 'updated'})`);
        ok++;
      } catch (err) {
        console.error(`  ✗ ${p.email ?? p.id}: ${(err as Error).message}`);
        failed++;
      }
    }

    console.log('');
    console.log(`Done. ${ok} succeeded, ${failed} failed.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
