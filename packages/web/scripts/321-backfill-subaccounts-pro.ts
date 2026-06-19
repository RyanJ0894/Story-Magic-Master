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
 * Two lookup paths are used:
 *   1. TeamMember rows where userId IS set → join directly to profiles.
 *   2. TeamMember rows where userId IS NULL but status='accepted' → look up
 *      profile by invitedEmail. These arise from historical data where an
 *      older version of the acceptance code set status='accepted' without
 *      writing userId. They are invisible to Prisma's teamMemberships relation
 *      (which joins on userId) and would be silently skipped without path 2.
 *
 * Behavior:
 *   - Default: DRY RUN. Lists what would change. Makes no writes.
 *   - With --apply: (1) repairs any TeamMember.userId=null rows by writing the
 *     resolved profile id back (restores team access for those users), then
 *     (2) runs provisionTier() for each eligible user. Atomic + serializable
 *     per user (DT-30-M-1 pattern), so profile.subscriptionTier and the
 *     latest subscriptions row stay in sync.
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
    // Path 1: TeamMember rows with userId set — Prisma relation resolves directly.
    const subAccountsViaUserId = await prisma.profile.findMany({
      where: {
        teamMemberships: {
          some: {
            status: 'accepted',
            deactivatedAt: null,
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

    // Path 2: accepted rows with no userId — look up profile by invitedEmail.
    // These are invisible to the teamMemberships relation and would be silently
    // missed without this second pass.
    const orphanMembers = await prisma.teamMember.findMany({
      where: {
        status: 'accepted',
        deactivatedAt: null,
        userId: null,
        invitedEmail: { not: null },
      },
      select: { invitedEmail: true },
    });

    const orphanEmails = [...new Set(orphanMembers.map((m) => m.invitedEmail!.toLowerCase()))];
    const subAccountsViaEmail = orphanEmails.length > 0
      ? await prisma.profile.findMany({
          where: { email: { in: orphanEmails } },
          select: {
            id: true,
            email: true,
            subscriptionTier: true,
            stripeSubscriptionId: true,
          },
        })
      : [];

    // Build a map from email → profile.id for the repair step below.
    const emailToProfileId = new Map<string, string>();
    for (const p of subAccountsViaEmail) {
      if (p.email) emailToProfileId.set(p.email.toLowerCase(), p.id);
    }

    if (orphanEmails.length > 0) {
      console.log(`Found ${orphanMembers.length} accepted TeamMember row(s) with userId=null (orphaned legacy rows).`);
      console.log(`Resolved ${subAccountsViaEmail.length} of those to profiles by invitedEmail.`);
      const unresolved = orphanEmails.filter(
        (e) => !subAccountsViaEmail.some((p) => p.email?.toLowerCase() === e)
      );
      if (unresolved.length > 0) {
        console.warn(`WARNING: ${unresolved.length} orphaned accepted member(s) have no matching profile:`);
        unresolved.forEach((e) => console.warn(`  - ${e}`));
        console.warn(`  These users may be locked out of team access (access checks join via userId).`);
      }
      console.log('');
    }

    // Merge both sets, deduplicate by profile id.
    const seenIds = new Set<string>();
    const subAccounts = [...subAccountsViaUserId, ...subAccountsViaEmail].filter((p) => {
      if (seenIds.has(p.id)) return false;
      seenIds.add(p.id);
      return true;
    });

    console.log(`Found ${subAccounts.length} accepted, non-deactivated sub-accounts (${subAccountsViaUserId.length} via userId, ${subAccountsViaEmail.length} via email fallback).`);
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

    // Repair userId=null rows before provisioning — access checks in teams.ts
    // query by (teamId, userId), so these users are locked out of team features
    // until their userId is backfilled.
    if (subAccountsViaEmail.length > 0) {
      console.log(`Repairing ${subAccountsViaEmail.length} TeamMember row(s) with userId=null…`);
      for (const p of subAccountsViaEmail) {
        if (!p.email) continue;
        const email = p.email.toLowerCase();
        await prisma.teamMember.updateMany({
          where: { invitedEmail: email, status: 'accepted', userId: null },
          data: { userId: p.id },
        });
        console.log(`  ✓ repaired userId on TeamMember rows for ${email}`);
      }
      console.log('');
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
