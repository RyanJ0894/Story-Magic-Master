/**
 * Ensures a profile exists for the given Clerk user ID.
 * Creates one on-demand if missing (covers the case where the Clerk webhook
 * hasn't fired yet, or CLERK_WEBHOOK_SECRET isn't configured).
 */

import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import type { Profile } from '@prisma/client';

export async function ensureProfile(userId: string): Promise<Profile> {
  const clerkUser = await currentUser();

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
