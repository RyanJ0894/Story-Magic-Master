/**
 * Projects Service
 *
 * Pure business logic for project CRUD operations.
 * No HTTP request/response handling — routes call these functions
 * and translate results into HTTP responses.
 */

import { Prisma } from '@story-magic/shared';
import type { PrismaClient } from '@story-magic/shared';

// =============================================================================
// Types
// =============================================================================

export interface CreateProjectInput {
  name: string;
  description?: string | null;
  scriptText?: string | null;
  pageCount?: number;
}

export interface UpdateProjectInput {
  name?: string;
  scriptText?: string;
  pageCount?: number;
}

// =============================================================================
// List projects
// =============================================================================

/**
 * Canonical predicate for "user is an active team member".
 * Mirrors the checks in withProjectAuth: accepted and not deactivated.
 */
export const activeMemberWhere = (userId: string) =>
  ({
    userId,
    acceptedAt: { not: null as Date | null },
    deactivatedAt: null,
  }) as const;

export async function listProjects(prisma: PrismaClient, userId: string) {
  // DT-32-H-1: mirror withProjectAuth's three-path predicate so the list
  // endpoint cannot leak project metadata (name, scriptText, pageCount) to
  // sub-accounts who lack an explicit ProjectAssignment. Without this, the
  // single-project read path (withProjectAuth) correctly 404s but the
  // dashboard list still surfaces every team-shared row.
  //
  // Paths:
  //   1. User owns the project directly.
  //   2. User is the team owner (master) — broad access to any team-shared project.
  //   3. User is an accepted team member (sub-account) — requires an explicit
  //      ProjectAssignment row scoped to (this user, this project).
  return prisma.project.findMany({
    where: {
      OR: [
        { userId },
        { teamShares: { some: { team: { ownerId: userId } } } },
        {
          AND: [
            {
              teamShares: {
                some: {
                  team: { members: { some: activeMemberWhere(userId) } },
                },
              },
            },
            { projectAssignments: { some: { userId } } },
          ],
        },
      ],
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      scriptText: true,
      pageCount: true,
      voiceAssignments: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  });
}

// =============================================================================
// Create project
// =============================================================================

export async function createProject(
  prisma: PrismaClient,
  userId: string,
  input: CreateProjectInput,
) {
  return prisma.project.create({
    data: {
      userId,
      name: input.name,
      description: input.description || null,
      scriptText: input.scriptText || null,
      pageCount: input.pageCount || 0,
    },
  });
}

// =============================================================================
// Get project (with ownership check)
// =============================================================================

/**
 * Fetch a single project, verifying ownership.
 * Returns null if the project does not exist or the user does not own it.
 */
export async function getProject(
  prisma: PrismaClient,
  projectId: string,
  userId: string,
) {
  return prisma.project.findFirst({
    where: { id: projectId, userId },
  });
}

// =============================================================================
// Update project (assumes ownership already verified by withProjectAuth)
// =============================================================================

export async function updateProject(
  prisma: PrismaClient,
  projectId: string,
  input: UpdateProjectInput,
) {
  return prisma.project.update({
    where: { id: projectId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.scriptText !== undefined && {
        scriptText: input.scriptText,
        directorJson: Prisma.DbNull, // invalidate cached parse — script changed
      }),
      ...(input.pageCount !== undefined && { pageCount: input.pageCount }),
    },
  });
}

// =============================================================================
// Delete project (assumes ownership already verified by withProjectAuth)
// =============================================================================

export async function deleteProject(prisma: PrismaClient, projectId: string) {
  return prisma.project.delete({
    where: { id: projectId },
  });
}
