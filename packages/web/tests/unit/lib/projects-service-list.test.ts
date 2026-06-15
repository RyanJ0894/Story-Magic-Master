/**
 * Regression coverage for DT-32-H-1 (2026-06-14 code review).
 *
 * PR #177 + migration 0039 added per-sub-account project isolation via
 * `project_assignments`. `withProjectAuth` was updated to require an explicit
 * assignment row for sub-accounts. The list endpoint at
 * `lib/services/projects.ts::listProjects` was NOT updated and continued to
 * return every team-shared project to every active team member — leaking
 * project names + scriptText to sub-accounts who could not actually open
 * those projects.
 *
 * These tests pin the new three-path predicate (own / master / sub-account
 * with explicit assignment) at the predicate-shape level. We don't need a
 * real database — verifying the `where` clause structure is enough to
 * prevent the regression, since the bug was the absence of the
 * `projectAssignments.some` constraint, not Prisma's evaluation of it.
 */

import { describe, it, expect, vi } from 'vitest';
import { listProjects, activeMemberWhere } from '@/lib/services/projects';

type Prisma = Parameters<typeof listProjects>[0];

function makePrisma() {
  const findMany = vi.fn().mockResolvedValue([]);
  return {
    prisma: { project: { findMany } } as unknown as Prisma,
    findMany,
  };
}

describe('listProjects — sub-account isolation predicate (DT-32-H-1)', () => {
  it('OR clause has exactly three paths (own / master / sub-account+assignment)', async () => {
    const { prisma, findMany } = makePrisma();
    await listProjects(prisma, 'user-1');

    const args = findMany.mock.calls[0][0];
    expect(args.where.OR).toHaveLength(3);
  });

  it('path 1 — user owns the project directly', async () => {
    const { prisma, findMany } = makePrisma();
    await listProjects(prisma, 'user-1');

    const args = findMany.mock.calls[0][0];
    expect(args.where.OR[0]).toEqual({ userId: 'user-1' });
  });

  it('path 2 — user is the team owner (master) gets broad team-share access', async () => {
    const { prisma, findMany } = makePrisma();
    await listProjects(prisma, 'master-1');

    const args = findMany.mock.calls[0][0];
    // The master path is teamShares.some.team.ownerId === userId, with NO
    // projectAssignments constraint — masters see every project shared with
    // their team, by definition.
    expect(args.where.OR[1]).toEqual({
      teamShares: { some: { team: { ownerId: 'master-1' } } },
    });
  });

  it('path 3 — sub-account requires BOTH team membership AND an explicit ProjectAssignment', async () => {
    const { prisma, findMany } = makePrisma();
    await listProjects(prisma, 'sub-account-1');

    const args = findMany.mock.calls[0][0];
    // The sub-account path uses AND so both conditions must hold. The
    // projectAssignments.some constraint is the bug fix — without it the
    // sub-account would see every team-shared project, including ones they
    // were never assigned to.
    expect(args.where.OR[2]).toEqual({
      AND: [
        {
          teamShares: {
            some: {
              team: { members: { some: activeMemberWhere('sub-account-1') } },
            },
          },
        },
        { projectAssignments: { some: { userId: 'sub-account-1' } } },
      ],
    });
  });

  it('regression — predicate must NOT contain a path that grants access via team membership alone', async () => {
    const { prisma, findMany } = makePrisma();
    await listProjects(prisma, 'sub-account-1');

    const args = findMany.mock.calls[0][0];
    // The pre-fix bug was a single OR-clause path matching any active team
    // member. Walk the new OR clauses and assert none of them grant access
    // based on team membership without also requiring projectAssignments.
    for (const branch of args.where.OR) {
      if (
        // Top-level teamShares (not wrapped in AND) means "any team member
        // of any sharing team sees it" — which is the bug we're preventing.
        // The masters path is OK because it filters by team.ownerId, not by
        // membership.
        'teamShares' in branch &&
        'some' in (branch as { teamShares: { some: Record<string, unknown> } }).teamShares
      ) {
        const teamPredicate = (branch as {
          teamShares: { some: { team: Record<string, unknown> } };
        }).teamShares.some.team;
        if ('members' in teamPredicate) {
          throw new Error(
            'Bug regressed: listProjects has a top-level OR path that matches via team membership without requiring a ProjectAssignment row. ' +
            'The sub-account path must wrap membership AND projectAssignments in an AND.',
          );
        }
      }
    }
  });

  it('matches withProjectAuth shape — sub-account membership predicate uses activeMemberWhere', () => {
    // activeMemberWhere is exported so withProjectAuth and listProjects can
    // stay in lock-step. If this contract changes, both call sites need to
    // be updated together.
    const w = activeMemberWhere('u');
    expect(w).toMatchObject({
      userId: 'u',
      deactivatedAt: null,
    });
    // acceptedAt: { not: null } — the cast types it as Date|null; just
    // confirm the operator shape.
    expect(w.acceptedAt).toEqual({ not: null });
  });
});
