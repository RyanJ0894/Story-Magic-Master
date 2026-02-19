/**
 * Single Project API Route
 *
 * GET /api/projects/[id] - Get a single project by ID
 * PATCH /api/projects/[id] - Update a project
 * DELETE /api/projects/[id] - Delete a project
 */

import { withProjectAuth, parseBody } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateProject, deleteProject } from '@/lib/services/projects';

// =============================================================================
// Input Validation
// =============================================================================

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  script_text: z.string().optional(),
  page_count: z.number().int().min(0).max(150).optional(),
});

// =============================================================================
// GET - Fetch a single project
// =============================================================================

export const GET = withProjectAuth(async (_request, { project }) => {
  return NextResponse.json({ project });
});

// =============================================================================
// PATCH - Update a project
// =============================================================================

export const PATCH = withProjectAuth(async (request, { prisma, projectId }) => {
  const parsed = await parseBody(request, UpdateProjectSchema);
  if ('error' in parsed) return parsed.error;

  const { name, script_text, page_count } = parsed.data;

  try {
    const project = await updateProject(prisma, projectId, {
      name,
      scriptText: script_text,
      pageCount: page_count,
    });

    return NextResponse.json({ project });
  } catch {
    return NextResponse.json(
      { error: 'Failed to update project', code: 'UPDATE_ERROR' },
      { status: 500 }
    );
  }
});

// =============================================================================
// DELETE - Delete a project
// =============================================================================

export const DELETE = withProjectAuth(async (_request, { prisma, projectId }) => {
  try {
    await deleteProject(prisma, projectId);
    return NextResponse.json({ success: true, deleted: projectId });
  } catch {
    return NextResponse.json(
      { error: 'Failed to delete project', code: 'DELETE_ERROR' },
      { status: 500 }
    );
  }
});
