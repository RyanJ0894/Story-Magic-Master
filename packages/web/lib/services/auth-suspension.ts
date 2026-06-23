/**
 * Sub-account auth suspension helper (#346).
 *
 * Before this, "removing" or "deactivating" a sub-account only touched the
 * `TeamMember` row — the underlying Clerk user kept their sessions valid
 * and could continue to log in independently. Ryan reported this 2026-06-18
 * after removing ryan@servicevision.net and ryan@collabworld.net but
 * finding both could still sign in.
 *
 * Per the Phase-1 plan in issue #346, the low-risk fix is:
 *   1. Set `Profile.suspended = true` so app-level reads can short-circuit
 *      access checks for that user.
 *   2. Revoke every active Clerk session so existing JWTs stop working —
 *      session-token validation on subsequent requests will fail.
 *
 * Hard-deletion of the Clerk user is intentionally NOT done here because a
 * sub-account on team A may also be the master of their OWN team B; hard-
 * deleting would orphan their projects. A future admin "hard delete" action
 * (Phase 2, separate issue) handles that case with explicit confirmation.
 *
 * Failures inside this helper are swallowed (logged at warn level) so a
 * Clerk hiccup never blocks the underlying team-membership change. The
 * worst-case degraded outcome is "membership is gone, but Clerk session
 * survives until its natural exp" — much better than "remove call fails
 * entirely and the master can't manage their team."
 */

import { clerkClient } from '@clerk/nextjs/server';
import type { PrismaClient } from '@story-magic/shared';
import { log } from '@/lib/logger';

export interface RevokeAndSuspendResult {
  profileUpdated: boolean;
  sessionsRevoked: number;
  /** Non-fatal warnings emitted while running — surfaced for test assertions. */
  warnings: string[];
}

/**
 * Mark the user as suspended and revoke every active Clerk session.
 *
 * Both sub-steps are best-effort: if the Profile row doesn't exist (e.g.
 * a member who never accepted the invite) we still try to revoke any
 * Clerk sessions. If Clerk is unavailable we still set the suspended flag.
 * Either way the caller's mutation proceeds.
 */
export async function revokeAndSuspendUser(
  prisma: PrismaClient,
  userId: string,
): Promise<RevokeAndSuspendResult> {
  const result: RevokeAndSuspendResult = {
    profileUpdated: false,
    sessionsRevoked: 0,
    warnings: [],
  };

  // 1. Suspend at the application layer. updateMany skips silently when
  // there's no matching row (sub-account who never accepted the invite
  // and therefore never had a Profile created via the Clerk webhook).
  try {
    const { count } = await prisma.profile.updateMany({
      where: { id: userId },
      data: { suspended: true },
    });
    result.profileUpdated = count > 0;
    if (count === 0) {
      result.warnings.push('profile-not-found');
      log.warn('[auth-suspension] Profile not found — sub-account never logged in?', { userId });
    }
  } catch (err) {
    result.warnings.push(`profile-update-failed: ${(err as Error).message}`);
    log.error('[auth-suspension] Profile.suspended update failed (continuing)', err as Error);
  }

  // 2. Revoke every active Clerk session for the user. Existing JWTs stop
  // validating on the next request. A revoked session can't be reactivated;
  // a future "reactivate" path just clears the suspended flag and the user
  // signs back in normally with a fresh session.
  try {
    const cc = await clerkClient();
    const list = await cc.sessions.getSessionList({ userId, status: 'active' });
    const sessions = Array.isArray(list) ? list : list.data ?? [];
    for (const session of sessions) {
      try {
        await cc.sessions.revokeSession(session.id);
        result.sessionsRevoked += 1;
      } catch (revokeErr) {
        // One bad session shouldn't abort the others.
        result.warnings.push(`session-revoke-failed: ${session.id}`);
        log.warn('[auth-suspension] revokeSession failed (continuing)', {
          sessionId: session.id,
          err: (revokeErr as Error).message,
        });
      }
    }
    log.info('[auth-suspension] revoked Clerk sessions', { userId, count: result.sessionsRevoked });
  } catch (err) {
    result.warnings.push(`clerk-list-failed: ${(err as Error).message}`);
    log.error('[auth-suspension] Clerk session list/revoke failed (continuing)', err as Error);
  }

  return result;
}

/**
 * Reverse of `revokeAndSuspendUser` — clears the suspended flag so the user
 * can log in again. No Clerk action needed (their sessions are already
 * gone; next sign-in mints a fresh one).
 *
 * Returns false when no Profile row was matched (a never-logged-in user
 * being "reactivated" is a no-op at the Profile layer but the TeamMember
 * row update should still proceed).
 */
export async function unsuspendUser(
  prisma: PrismaClient,
  userId: string,
): Promise<boolean> {
  try {
    const { count } = await prisma.profile.updateMany({
      where: { id: userId },
      data: { suspended: false },
    });
    return count > 0;
  } catch (err) {
    log.error('[auth-suspension] unsuspend failed (continuing)', err as Error);
    return false;
  }
}
