/**
 * Projects API Route
 *
 * GET /api/projects - List all projects for the authenticated user
 * POST /api/projects - Create a new project
 */

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCsrf } from '@/lib/csrf';

// =============================================================================
// Input Validation
// =============================================================================

const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(200, 'Project name too long'),
  script_text: z.string().optional(),
  page_count: z.number().int().min(0).max(150).optional(),
});

// =============================================================================
// GET - List user's projects
// =============================================================================

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  try {
    const projects = await prisma.project.findMany({
      where: { userId },
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

    return NextResponse.json({ projects });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch projects', code: 'FETCH_ERROR' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create a new project
// =============================================================================

export async function POST(request: Request) {
  // CSRF protection
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json(
      { error: 'CSRF validation failed', code: 'CSRF_ERROR' },
      { status: 403 }
    );
  }

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

  const parseResult = CreateProjectSchema.safeParse(body);
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
    const project = await prisma.project.create({
      data: {
        userId,
        name,
        scriptText: script_text || null,
        pageCount: page_count || 0,
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to create project', code: 'CREATE_ERROR' },
      { status: 500 }
    );
  }
}
