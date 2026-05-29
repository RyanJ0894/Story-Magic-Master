/**
 * Tests for teams service — listTeams, createTeam, getTeam, updateTeam,
 * deleteTeam, listMembers.
 *
 * addMember is covered separately in teams-add-member.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/email', () => ({
  sendTeamInviteEmail: vi.fn().mockResolvedValue({ success: true }),
}));

import {
  listTeams,
  createTeam,
  getTeam,
  updateTeam,
  deleteTeam,
  listMembers,
  TeamServiceError,
} from '@/lib/services/teams';

// ── Types ────────────────────────────────────────────────────────────────────

type Prisma = Parameters<typeof listTeams>[0];

// ── Fixtures ─────────────────────────────────────────────────────────────────

const OWNER_ID = 'owner-1';
const MEMBER_ID = 'member-user-1';
const TEAM_ID = 'team-1';

const BASE_TEAM = {
  id: TEAM_ID,
  name: 'Test Crew',
  ownerId: OWNER_ID,
  description: null,
  defaultShareAccess: 'stream',
  autoShareNewProjects: false,
  createdAt: new Date('2026-01-01'),
};

const MEMBER_ROW = {
  id: 'tm-1',
  userId: MEMBER_ID,
  invitedEmail: 'member@example.com',
  role: 'member',
  status: 'accepted',
  invitedAt: new Date(),
  acceptedAt: new Date(),
  user: { fullName: 'Test Member', avatarUrl: null, id: MEMBER_ID },
  inviter: { fullName: 'Owner Name' },
};

// ── Prisma factory ────────────────────────────────────────────────────────────

function makePrisma(opts: {
  teamFindUnique?: Record<string, unknown> | null;
  teamFindFirst?: Record<string, unknown> | null;
  teamFindMany?: Record<string, unknown>[];
  membershipFindMany?: Record<string, unknown>[];
  memberFindFirst?: Record<string, unknown> | null;
  memberFindMany?: Record<string, unknown>[];
} = {}) {
  const team = {
    findUnique: vi.fn().mockResolvedValue(opts.teamFindUnique ?? null),
    findFirst: vi.fn().mockResolvedValue(opts.teamFindFirst ?? null),
    findMany: vi.fn().mockResolvedValue(opts.teamFindMany ?? []),
    create: vi.fn().mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({ id: 'team-new', ...args.data }),
    ),
    update: vi.fn().mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({ id: TEAM_ID, ...args.data }),
    ),
    delete: vi.fn().mockResolvedValue({ id: TEAM_ID }),
  };

  const teamMember = {
    findFirst: vi.fn().mockResolvedValue(opts.memberFindFirst ?? null),
    findMany: vi.fn().mockResolvedValue(opts.memberFindMany ?? []),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  };

  const teamShare = {
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  };

  // listTeams calls teamMember.findMany for memberships; subsequent calls use teamMember.findFirst
  if (opts.membershipFindMany !== undefined) {
    // Override the first teamMember.findMany call to return membership rows
    const original = teamMember.findMany;
    let firstCall = true;
    teamMember.findMany = vi.fn().mockImplementation(async () => {
      if (firstCall) {
        firstCall = false;
        return opts.membershipFindMany!;
      }
      return opts.memberFindMany ?? [];
    });
    void original;
  }

  return { prisma: { team, teamMember, teamShare } as unknown as Prisma, team, teamMember, teamShare };
}

// =============================================================================
// listTeams
// =============================================================================

describe('listTeams', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns owned teams with role=owner', async () => {
    const { prisma } = makePrisma({
      teamFindMany: [{ ...BASE_TEAM, members: [] }],
      membershipFindMany: [],
    });

    const result = await listTeams(prisma, OWNER_ID);

    expect(result.owned).toHaveLength(1);
    expect(result.owned[0]).toMatchObject({ id: TEAM_ID });
    expect(result.teams[0]).toMatchObject({ role: 'owner' });
  });

  it('returns member teams with membership info', async () => {
    const membershipRow = {
      id: 'tm-1',
      role: 'member',
      status: 'accepted',
      team: { ...BASE_TEAM, owner: { fullName: 'Owner', avatarUrl: null } },
    };

    const { prisma } = makePrisma({
      teamFindMany: [],
      membershipFindMany: [membershipRow],
    });

    const result = await listTeams(prisma, MEMBER_ID);

    expect(result.member).toHaveLength(1);
    expect(result.member[0]).toMatchObject({ id: TEAM_ID });
    expect(result.member[0]).toHaveProperty('membership.role', 'member');
  });

  it('returns empty arrays when user has no teams', async () => {
    const { prisma } = makePrisma({ teamFindMany: [], membershipFindMany: [] });

    const result = await listTeams(prisma, 'unaffiliated-user');

    expect(result.owned).toHaveLength(0);
    expect(result.member).toHaveLength(0);
    expect(result.teams).toHaveLength(0);
  });
});

// =============================================================================
// createTeam
// =============================================================================

describe('createTeam', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates team with provided name and ownerId', async () => {
    const { prisma, team } = makePrisma();

    await createTeam(prisma, OWNER_ID, { name: 'New Crew' });

    expect(team.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerId: OWNER_ID, name: 'New Crew' }),
      }),
    );
  });

  it('applies defaultShareAccess=stream when not provided', async () => {
    const { prisma, team } = makePrisma();

    await createTeam(prisma, OWNER_ID, { name: 'Crew' });

    const call = team.create.mock.calls[0][0];
    expect(call.data.defaultShareAccess).toBe('stream');
    expect(call.data.autoShareNewProjects).toBe(false);
  });

  it('respects explicit defaultShareAccess override', async () => {
    const { prisma, team } = makePrisma();

    await createTeam(prisma, OWNER_ID, { name: 'Crew', defaultShareAccess: 'download', autoShareNewProjects: true });

    const call = team.create.mock.calls[0][0];
    expect(call.data.defaultShareAccess).toBe('download');
    expect(call.data.autoShareNewProjects).toBe(true);
  });
});

// =============================================================================
// getTeam
// =============================================================================

describe('getTeam', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('throws NOT_FOUND when team does not exist', async () => {
    const { prisma } = makePrisma({ teamFindUnique: null });

    await expect(getTeam(prisma, TEAM_ID, OWNER_ID)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('returns team for owner without checking membership', async () => {
    const teamWithMeta = { ...BASE_TEAM, members: [], owner: { fullName: 'Owner', avatarUrl: null } };
    const { prisma, teamMember } = makePrisma({ teamFindUnique: teamWithMeta });

    const result = await getTeam(prisma, TEAM_ID, OWNER_ID);

    expect(result.team.id).toBe(TEAM_ID);
    expect(result.isOwner).toBe(true);
    expect(teamMember.findFirst).not.toHaveBeenCalled();
  });

  it('throws FORBIDDEN when non-owner has no accepted membership', async () => {
    const teamWithMeta = { ...BASE_TEAM, members: [], owner: { fullName: 'Owner', avatarUrl: null } };
    const { prisma } = makePrisma({ teamFindUnique: teamWithMeta, memberFindFirst: null });

    await expect(getTeam(prisma, TEAM_ID, 'other-user')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('returns team for accepted member', async () => {
    const teamWithMeta = { ...BASE_TEAM, members: [], owner: { fullName: 'Owner', avatarUrl: null } };
    const { prisma } = makePrisma({
      teamFindUnique: teamWithMeta,
      memberFindFirst: { id: 'tm-1' },
    });

    const result = await getTeam(prisma, TEAM_ID, MEMBER_ID);

    expect(result.team.id).toBe(TEAM_ID);
    expect(result.isOwner).toBe(false);
  });
});

// =============================================================================
// updateTeam
// =============================================================================

describe('updateTeam', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('throws NOT_FOUND when caller is not the owner', async () => {
    const { prisma } = makePrisma({ teamFindFirst: null });

    await expect(updateTeam(prisma, TEAM_ID, 'other-user', { name: 'New' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('updates only the provided fields', async () => {
    const { prisma, team } = makePrisma({ teamFindFirst: { id: TEAM_ID } });

    await updateTeam(prisma, TEAM_ID, OWNER_ID, { name: 'Renamed Crew' });

    expect(team.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEAM_ID },
        data: { name: 'Renamed Crew' },
      }),
    );
  });

  it('skips undefined fields in the update payload', async () => {
    const { prisma, team } = makePrisma({ teamFindFirst: { id: TEAM_ID } });

    await updateTeam(prisma, TEAM_ID, OWNER_ID, { autoShareNewProjects: true });

    const updateData = team.update.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty('name');
    expect(updateData.autoShareNewProjects).toBe(true);
  });

  it('returns the updated team', async () => {
    const { prisma } = makePrisma({ teamFindFirst: { id: TEAM_ID } });

    const result = await updateTeam(prisma, TEAM_ID, OWNER_ID, { name: 'Updated' });

    expect(result).toMatchObject({ id: TEAM_ID, name: 'Updated' });
  });
});

// =============================================================================
// deleteTeam
// =============================================================================

describe('deleteTeam', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('throws NOT_FOUND when caller is not the owner', async () => {
    const { prisma } = makePrisma({ teamFindFirst: null });

    await expect(deleteTeam(prisma, TEAM_ID, 'other-user')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('deletes members, shares, and team in order', async () => {
    const { prisma, teamMember, teamShare, team } = makePrisma({
      teamFindFirst: { id: TEAM_ID, name: 'Crew' },
    });

    await deleteTeam(prisma, TEAM_ID, OWNER_ID);

    expect(teamMember.deleteMany).toHaveBeenCalledWith({ where: { teamId: TEAM_ID } });
    expect(teamShare.deleteMany).toHaveBeenCalledWith({ where: { teamId: TEAM_ID } });
    expect(team.delete).toHaveBeenCalledWith({ where: { id: TEAM_ID } });
  });

  it('returns the deleted team name', async () => {
    const { prisma } = makePrisma({ teamFindFirst: { id: TEAM_ID, name: 'Crew' } });

    const result = await deleteTeam(prisma, TEAM_ID, OWNER_ID);

    expect(result.teamName).toBe('Crew');
  });
});

// =============================================================================
// listMembers
// =============================================================================

describe('listMembers', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('throws NOT_FOUND when team does not exist', async () => {
    const { prisma } = makePrisma({ teamFindUnique: null });

    await expect(listMembers(prisma, TEAM_ID, OWNER_ID)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('throws FORBIDDEN for a non-owner without accepted membership', async () => {
    const { prisma } = makePrisma({
      teamFindUnique: { id: TEAM_ID, ownerId: OWNER_ID },
      memberFindFirst: null,
    });

    await expect(listMembers(prisma, TEAM_ID, 'other-user')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('returns members list and isOwner=true for the owner', async () => {
    const { prisma } = makePrisma({
      teamFindUnique: { id: TEAM_ID, ownerId: OWNER_ID },
      memberFindMany: [MEMBER_ROW],
    });

    const result = await listMembers(prisma, TEAM_ID, OWNER_ID);

    expect(result.isOwner).toBe(true);
    expect(result.members).toHaveLength(1);
    expect(result.members[0].id).toBe('tm-1');
  });

  it('returns members list and isOwner=false for an accepted member', async () => {
    const { prisma } = makePrisma({
      teamFindUnique: { id: TEAM_ID, ownerId: OWNER_ID },
      memberFindFirst: { id: 'tm-1' },
      memberFindMany: [MEMBER_ROW],
    });

    const result = await listMembers(prisma, TEAM_ID, MEMBER_ID);

    expect(result.isOwner).toBe(false);
    expect(result.members).toHaveLength(1);
  });
});
