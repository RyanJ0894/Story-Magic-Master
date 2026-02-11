/**
 * Single Project API Route
 *
 * GET /api/projects/[id] - Get a single project by ID
 * PATCH /api/projects/[id] - Update a project
 * DELETE /api/projects/[id] - Delete a project
 */

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCsrf } from '@/lib/csrf';

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({ project });
  } catch {
    return NextResponse.json(
      { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
      { status: 404 }
    );
  }
}

// =============================================================================
// PATCH - Update a project
// =============================================================================

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // CSRF protection
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json(
      { error: 'CSRF validation failed', code: 'CSRF_ERROR' },
      { status: 403 }
    );
  }

  const { id: projectId } = await params;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

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

  // Verify project exists and belongs to user
  const existing = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json(
      { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
      { status: 404 }
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
}

// =============================================================================
// DELETE - Delete a project
// =============================================================================

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // CSRF protection
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json(
      { error: 'CSRF validation failed', code: 'CSRF_ERROR' },
      { status: 403 }
    );
  }

  const { id: projectId } = await params;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // Verify project exists and belongs to user
  const existing = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json(
      { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
      { status: 404 }
    );
  }

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
}
