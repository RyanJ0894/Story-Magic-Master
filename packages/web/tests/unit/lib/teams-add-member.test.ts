/**
 * Tests for addMember reactivation logic (teams service).
 *
 * Regression for the 2026-05-27 HIGH bug: re-inviting a previously *removed*
 * registered user 500'd because addMember always INSERTed, colliding with the
 * leftover row on the unique (teamId, userId) constraint. The fix matches a
 * prior row by email OR userId and reactivates it in place.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockSendEmail = vi.fn();
vi.mock('@/lib/email', () => ({
  sendTeamInviteEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

import { addMember, TeamServiceError } from '@/lib/services/teams';

const TEAM_ID = 'team-1';
const OWNER_ID = 'owner-1';
const EMAIL = 'invitee@example.com';

type Prisma = Parameters<typeof addMember>[0];

function makePrisma(overrides: {
  existingUser?: { id: string; fullName: string | null } | null;
  existingMember?: { id: string; status: string } | null;
}) {
  const teamMemberUpdate = vi.fn(async (args: { data: Record<string, unknown> }) => ({
    id: 'member-1',
    inviteToken: (args.data.inviteToken as string) ?? 'tok',
    ...args.data,
  }));
  const teamMemberCreate = vi.fn(async (args: { data: Record<string, unknown> }) => ({
    id: 'member-new',
    inviteToken: 'tok-created',
    ...args.data,
  }));
  const teamMemberFindFirst = vi.fn(async () => overrides.existingMember ?? null);

  const prisma = {
    team: { findFirst: vi.fn(async () => ({ id: TEAM_ID, name: 'Crew', ownerId: OWNER_ID })) },
    profile: {
      findFirst: vi.fn(async () => overrides.existingUser ?? null),
      findUnique: vi.fn(async () => ({ fullName: 'Owner' })),
    },
    teamMember: {
      findFirst: teamMemberFindFirst,
      update: teamMemberUpdate,
      create: teamMemberCreate,
    },
    alert: { create: vi.fn(async () => ({})) },
  };
  return { prisma: prisma as unknown as Prisma, teamMemberUpdate, teamMemberCreate, teamMemberFindFirst };
}

describe('addMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue({ success: true });
  });

  it('creates a fresh invite when no prior membership row exists', async () => {
    const { prisma, teamMemberCreate, teamMemberUpdate } = makePrisma({
      existingUser: null,
      existingMember: null,
    });

    await addMember(prisma, TEAM_ID, OWNER_ID, { email: EMAIL, role: 'member' });

    expect(teamMemberCreate).toHaveBeenCalledTimes(1);
    expect(teamMemberUpdate).not.toHaveBeenCalled();
  });

  it('reactivates a removed registered member instead of inserting a duplicate', async () => {
    const { prisma, teamMemberUpdate, teamMemberCreate } = makePrisma({
      existingUser: { id: 'user-9', fullName: 'Ada' },
      existingMember: { id: 'member-removed', status: 'removed' },
    });

    const result = await addMember(prisma, TEAM_ID, OWNER_ID, { email: EMAIL, role: 'viewer' });

    // No INSERT — the constraint-colliding path is never taken
    expect(teamMemberCreate).not.toHaveBeenCalled();
    expect(teamMemberUpdate).toHaveBeenCalledTimes(1);

    const updateArg = teamMemberUpdate.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'member-removed' });
    expect(updateArg.data.status).toBe('pending');
    expect(updateArg.data.userId).toBe('user-9');
    expect(updateArg.data.role).toBe('viewer');
    expect(updateArg.data.acceptedAt).toBeNull();
    // Fresh token minted (32 hex chars) since the INSERT trigger won't fire on UPDATE
    expect(updateArg.data.inviteToken).toMatch(/^[0-9a-f]{32}$/);
    expect(result.member).toBeDefined();
  });

  it('looks up a prior row by email OR the registered user id', async () => {
    const { prisma, teamMemberFindFirst } = makePrisma({
      existingUser: { id: 'user-9', fullName: 'Ada' },
      existingMember: { id: 'member-removed', status: 'removed' },
    });

    await addMember(prisma, TEAM_ID, OWNER_ID, { email: EMAIL });

    const whereArg = teamMemberFindFirst.mock.calls[0][0].where;
    expect(whereArg.OR).toEqual(
      expect.arrayContaining([{ invitedEmail: EMAIL }, { userId: 'user-9' }]),
    );
  });

  it('throws ALREADY_MEMBER for an accepted member', async () => {
    const { prisma } = makePrisma({
      existingUser: { id: 'user-9', fullName: 'Ada' },
      existingMember: { id: 'm', status: 'accepted' },
    });

    await expect(addMember(prisma, TEAM_ID, OWNER_ID, { email: EMAIL })).rejects.toMatchObject({
      code: 'ALREADY_MEMBER',
    });
  });

  it('throws INVITE_PENDING for a pending invite', async () => {
    const { prisma } = makePrisma({
      existingUser: null,
      existingMember: { id: 'm', status: 'pending' },
    });

    await expect(addMember(prisma, TEAM_ID, OWNER_ID, { email: EMAIL })).rejects.toBeInstanceOf(
      TeamServiceError,
    );
  });
});
