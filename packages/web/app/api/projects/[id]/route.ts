/**
 * Single Project API Route
 *
 * GET /api/projects/[id] - Get a single project by ID
 * PATCH /api/projects/[id] - Update a project
 * DELETE /api/projects/[id] - Delete a project
 */

import { withProjectAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';

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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in request body', code: 'INVALID_JSON' },
      { status: 400 }
    );
  }

  const parseResult = UpdateProjectSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: 'Invalid request parameters',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { name, script_text, page_count } = parseResult.data;

  try {
    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(name !== undefined && { name }),
        ...(script_text !== undefined && { scriptText: script_text }),
        ...(page_count !== undefined && { pageCount: page_count }),
      },
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
    await prisma.project.delete({
      where: { id: projectId },
    });

    return NextResponse.json({ success: true, deleted: projectId });
  } catch {
    return NextResponse.json(
      { error: 'Failed to delete project', code: 'DELETE_ERROR' },
      { status: 500 }
    );
  }
});
