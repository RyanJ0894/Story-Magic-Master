/**
 * Tests for the sub-account auth-suspension helper (#346).
 *
 * Pins:
 *   1. revokeAndSuspendUser sets Profile.suspended=true AND revokes every
 *      active Clerk session.
 *   2. If the Profile row doesn't exist (sub-account never logged in),
 *      we DO NOT throw — we still attempt the Clerk revoke step.
 *   3. If Clerk is unavailable, we DO NOT throw — Profile.suspended still
 *      gets set so the team mutation can complete.
 *   4. unsuspendUser flips Profile.suspended back to false without
 *      touching Clerk (sessions are already gone).
 *
 * If any test goes red, the sub-account-deletion bug Ryan reported
 * 2026-06-18 is back in some form.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUpdateMany = vi.fn();
const mockGetSessionList = vi.fn();
const mockRevokeSession = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: vi.fn(async () => ({
    sessions: {
      getSessionList: mockGetSessionList,
      revokeSession: mockRevokeSession,
    },
  })),
}));

vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { revokeAndSuspendUser, unsuspendUser } from '@/lib/services/auth-suspension';
import type { PrismaClient } from '@story-magic/shared';

function makePrisma(profileMatchCount = 1) {
  return {
    profile: {
      updateMany: mockUpdateMany.mockResolvedValue({ count: profileMatchCount }),
    },
  } as unknown as PrismaClient;
}

describe('revokeAndSuspendUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets Profile.suspended=true AND revokes every active Clerk session', async () => {
    mockGetSessionList.mockResolvedValueOnce({
      data: [{ id: 'sess_a' }, { id: 'sess_b' }, { id: 'sess_c' }],
    });
    mockRevokeSession.mockResolvedValue({});

    const prisma = makePrisma(1);
    const result = await revokeAndSuspendUser(prisma, 'user_42');

    // 1. Profile.suspended flipped
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 'user_42' },
      data: { suspended: true },
    });
    expect(result.profileUpdated).toBe(true);

    // 2. Every session revoked
    expect(mockRevokeSession).toHaveBeenCalledTimes(3);
    expect(mockRevokeSession).toHaveBeenCalledWith('sess_a');
    expect(mockRevokeSession).toHaveBeenCalledWith('sess_b');
    expect(mockRevokeSession).toHaveBeenCalledWith('sess_c');
    expect(result.sessionsRevoked).toBe(3);
    expect(result.warnings).toEqual([]);
  });

  it('handles array-shaped session list (older clerk SDKs)', async () => {
    mockGetSessionList.mockResolvedValueOnce([{ id: 'sess_1' }, { id: 'sess_2' }]);
    mockRevokeSession.mockResolvedValue({});

    const prisma = makePrisma(1);
    const result = await revokeAndSuspendUser(prisma, 'user_x');

    expect(mockRevokeSession).toHaveBeenCalledTimes(2);
    expect(result.sessionsRevoked).toBe(2);
  });

  it('warns but does NOT throw when Profile row does not exist', async () => {
    mockGetSessionList.mockResolvedValueOnce({ data: [] });

    // updateMany returns count=0 — never-logged-in sub-account.
    const prisma = makePrisma(0);
    const result = await revokeAndSuspendUser(prisma, 'user_never_logged_in');

    expect(result.profileUpdated).toBe(false);
    expect(result.warnings).toContain('profile-not-found');
    // Critical: we still tried Clerk — a sub-account who never accepted
    // could in theory have a Clerk user with sessions if they bounced
    // around the sign-up flow. Don't skip the revoke step.
    expect(mockGetSessionList).toHaveBeenCalled();
  });

  it('returns warnings but does NOT throw when Clerk session list fails', async () => {
    mockGetSessionList.mockRejectedValueOnce(new Error('Clerk 503'));

    const prisma = makePrisma(1);
    const result = await revokeAndSuspendUser(prisma, 'user_42');

    // Critical: Profile.suspended STILL got set so the team change isn't
    // wasted. The Clerk session will expire naturally; suspension at our
    // layer is the durable guard.
    expect(result.profileUpdated).toBe(true);
    expect(result.sessionsRevoked).toBe(0);
    expect(result.warnings.some((w) => w.startsWith('clerk-list-failed'))).toBe(true);
  });

  it('continues revoking remaining sessions when one revoke call fails', async () => {
    mockGetSessionList.mockResolvedValueOnce({
      data: [{ id: 'sess_a' }, { id: 'sess_b' }, { id: 'sess_c' }],
    });
    mockRevokeSession
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('Session already revoked'))
      .mockResolvedValueOnce({});

    const prisma = makePrisma(1);
    const result = await revokeAndSuspendUser(prisma, 'user_42');

    expect(mockRevokeSession).toHaveBeenCalledTimes(3);
    expect(result.sessionsRevoked).toBe(2);
    expect(result.warnings).toContain('session-revoke-failed: sess_b');
  });

  it('returns warnings but does NOT throw when Profile.updateMany fails', async () => {
    mockGetSessionList.mockResolvedValueOnce({ data: [{ id: 'sess_a' }] });
    mockRevokeSession.mockResolvedValue({});

    const prisma = {
      profile: {
        updateMany: vi.fn().mockRejectedValueOnce(new Error('DB connection lost')),
      },
    } as unknown as PrismaClient;
    const result = await revokeAndSuspendUser(prisma, 'user_42');

    expect(result.warnings.some((w) => w.startsWith('profile-update-failed'))).toBe(true);
    // Critical: Clerk revoke STILL ran — even if our DB is down, killing
    // the JWT is the highest-leverage immediate effect.
    expect(result.sessionsRevoked).toBe(1);
  });
});

describe('unsuspendUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears Profile.suspended and does NOT touch Clerk', async () => {
    const prisma = makePrisma(1);
    const result = await unsuspendUser(prisma, 'user_42');

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 'user_42' },
      data: { suspended: false },
    });
    expect(result).toBe(true);
    // No Clerk action on reactivate — their session is already gone,
    // they'll mint a fresh one on next sign-in.
    expect(mockGetSessionList).not.toHaveBeenCalled();
    expect(mockRevokeSession).not.toHaveBeenCalled();
  });

  it('returns false when no Profile row matches (never-logged-in user)', async () => {
    const prisma = makePrisma(0);
    const result = await unsuspendUser(prisma, 'user_never');

    expect(result).toBe(false);
  });
});
