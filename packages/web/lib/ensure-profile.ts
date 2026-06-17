/**
 * Ensures a profile exists for the given Clerk user ID.
 * Creates one on-demand if missing (covers the case where the Clerk webhook
 * hasn't fired yet, or CLERK_WEBHOOK_SECRET isn't configured).
 *
 * #322 (2026-06-17): hardened against a transient `currentUser()` failure.
 * Ryan's "login → blank error page → refresh fixes it" report was traced to
 * a race where the Clerk session cookie is set client-side immediately
 * after sign-in but Clerk's backend session lookup occasionally fails on
 * the very next server request. The dashboard's Promise.all([listProjects,
 * ensureProfile]) would throw, bubbling to error.tsx which renders
 * "Something went wrong" — exactly matching the screenshot Ryan posted.
 * On refresh, the cookie is stable and the lookup succeeds.
 *
 * Mitigation: retry `currentUser()` once with a short delay. If still
 * fails, proceed with the upsert anyway — `userId` (from JWT) is enough
 * to seed the row; email/fullName backfill on the next visit.
 */

import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { log } from '@/lib/logger';
import type { Profile } from '@story-magic/shared';

async function fetchCurrentUserWithRetry() {
  try {
    return await currentUser();
  } catch (err) {
    log.warn('[ensureProfile] currentUser() failed on first attempt; retrying once', {
      err: err instanceof Error ? err.message : String(err),
    });
    await new Promise((r) => setTimeout(r, 400));
    try {
      return await currentUser();
    } catch (err2) {
      // Don't fail the whole dashboard render — proceed with what we know
      // (just the userId from the JWT). Email/fullName get backfilled on
      // the next page load when Clerk's session lookup succeeds.
      log.warn('[ensureProfile] currentUser() failed on retry; proceeding with userId only', {
        err: err2 instanceof Error ? err2.message : String(err2),
      });
      return null;
    }
  }
}

export async function ensureProfile(userId: string): Promise<Profile> {
  const clerkUser = await fetchCurrentUserWithRetry();

  const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? null;
  const fullName =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ') ||
    email;

  return prisma.profile.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email,
      fullName: fullName ?? null,
      avatarUrl: clerkUser?.imageUrl ?? null,
    },
    update: {
      // Backfill fields that may have been null on first upsert (e.g. brand-new
      // Clerk users whose webhook hasn't fired yet). Only overwrite when the
      // Clerk value is non-empty so we don't clobber user-edited profile data.
      ...(email ? { email } : {}),
      ...(fullName ? { fullName } : {}),
      ...(clerkUser?.imageUrl ? { avatarUrl: clerkUser.imageUrl } : {}),
    },
  });
}
