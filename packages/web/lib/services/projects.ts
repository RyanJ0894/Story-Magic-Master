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

export async function listProjects(prisma: PrismaClient, userId: string) {
  return prisma.project.findMany({
    where: {
      OR: [
        // User's own projects
        { userId },
        // Projects shared with a team the user is an active member of
        {
          teamShares: {
            some: {
              team: {
                members: {
                  some: { userId, status: 'active' },
                },
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      name: true,
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
