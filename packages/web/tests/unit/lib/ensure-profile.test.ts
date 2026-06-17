/**
 * Tests for ensureProfile — on-demand profile creation + backfill.
 *
 * Covers the 2026-05-27 change: the upsert `update` branch now backfills
 * email/fullName/avatarUrl from Clerk (previously a no-op `{}`), so brand-new
 * users whose Clerk webhook hasn't fired yet get their name filled in on a
 * subsequent request — without clobbering existing values when Clerk is sparse.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockCurrentUser } = vi.hoisted(() => ({
  mockPrisma: { profile: { upsert: vi.fn() } },
  mockCurrentUser: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@clerk/nextjs/server', () => ({ currentUser: mockCurrentUser }));
vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ensureProfile } from '@/lib/ensure-profile';

function upsertArgs() {
  return mockPrisma.profile.upsert.mock.calls[0][0];
}

describe('ensureProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.profile.upsert.mockImplementation(async (args: { create: { id: string } }) => ({
      id: args.create.id,
    }));
  });

  it('upserts on the Clerk user id', async () => {
    mockCurrentUser.mockResolvedValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      emailAddresses: [{ emailAddress: 'ada@example.com' }],
      imageUrl: 'https://img/ada.png',
    });

    await ensureProfile('user_123');

    expect(upsertArgs().where).toEqual({ id: 'user_123' });
  });

  it('create branch carries full Clerk identity', async () => {
    mockCurrentUser.mockResolvedValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      emailAddresses: [{ emailAddress: 'ada@example.com' }],
      imageUrl: 'https://img/ada.png',
    });

    await ensureProfile('user_123');

    expect(upsertArgs().create).toEqual({
      id: 'user_123',
      email: 'ada@example.com',
      fullName: 'Ada Lovelace',
      avatarUrl: 'https://img/ada.png',
    });
  });

  it('update branch backfills email/fullName/avatarUrl when Clerk has them', async () => {
    mockCurrentUser.mockResolvedValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      emailAddresses: [{ emailAddress: 'ada@example.com' }],
      imageUrl: 'https://img/ada.png',
    });

    await ensureProfile('user_123');

    expect(upsertArgs().update).toEqual({
      email: 'ada@example.com',
      fullName: 'Ada Lovelace',
      avatarUrl: 'https://img/ada.png',
    });
  });

  it('update branch is a no-op when Clerk returns no usable fields', async () => {
    // Brand-new Clerk user before propagation: no name, no email, no image.
    mockCurrentUser.mockResolvedValue({
      firstName: null,
      lastName: null,
      emailAddresses: [],
      imageUrl: null,
    });

    await ensureProfile('user_123');

    // No falsey values should be written — avoids clobbering existing data.
    expect(upsertArgs().update).toEqual({});
  });

  it('falls back to email as fullName when no first/last name', async () => {
    mockCurrentUser.mockResolvedValue({
      firstName: null,
      lastName: null,
      emailAddresses: [{ emailAddress: 'ada@example.com' }],
      imageUrl: null,
    });

    await ensureProfile('user_123');

    const args = upsertArgs();
    expect(args.create.fullName).toBe('ada@example.com');
    expect(args.update.fullName).toBe('ada@example.com');
    expect(args.update.avatarUrl).toBeUndefined();
  });

  it('handles a null Clerk user (webhook not fired, no session user)', async () => {
    mockCurrentUser.mockResolvedValue(null);

    await ensureProfile('user_123');

    const args = upsertArgs();
    expect(args.create).toEqual({
      id: 'user_123',
      email: null,
      fullName: null,
      avatarUrl: null,
    });
    expect(args.update).toEqual({});
  });

  // #322 (2026-06-17): the Clerk-session hydration race.
  describe('currentUser() retry behavior', () => {
    it('retries once when currentUser() throws on first attempt', async () => {
      mockCurrentUser
        .mockRejectedValueOnce(new Error('transient Clerk session error'))
        .mockResolvedValueOnce({
          firstName: 'Ada',
          emailAddresses: [{ emailAddress: 'ada@example.com' }],
        });

      await ensureProfile('user_123');

      expect(mockCurrentUser).toHaveBeenCalledTimes(2);
      // Upsert succeeded with the retry's data
      const args = upsertArgs();
      expect(args.create.email).toBe('ada@example.com');
    });

    it('still upserts with just the userId when BOTH attempts fail', async () => {
      mockCurrentUser
        .mockRejectedValueOnce(new Error('first attempt 503'))
        .mockRejectedValueOnce(new Error('second attempt 503'));

      // Critical: does NOT throw to the caller — would otherwise propagate
      // to dashboard error.tsx and render "Something went wrong".
      const result = await ensureProfile('user_123');
      expect(result).toBeDefined();

      expect(mockCurrentUser).toHaveBeenCalledTimes(2);
      const args = upsertArgs();
      expect(args.create).toEqual({
        id: 'user_123',
        email: null,
        fullName: null,
        avatarUrl: null,
      });
    });
  });
});
