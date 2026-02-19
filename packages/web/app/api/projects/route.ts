/**
 * Projects API Route
 *
 * GET /api/projects - List all projects for the authenticated user
 * POST /api/projects - Create a new project
 */

import { withAuth, parseBody } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listProjects, createProject } from '@/lib/services/projects';

// =============================================================================
// Input Validation
// =============================================================================

const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(200, 'Project name too long'),
  description: z.string().max(500).optional(),
  scriptText: z.string().optional(),
  pageCount: z.number().int().min(0).max(150).optional(),
  // Accept snake_case aliases for backwards compatibility
  script_text: z.string().optional(),
  page_count: z.number().int().min(0).max(150).optional(),
});

// =============================================================================
// GET - List user's projects
// =============================================================================

export const GET = withAuth(async (_request, { userId, prisma }) => {
  try {
    const projects = await listProjects(prisma, userId);
    return NextResponse.json({ projects });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch projects', code: 'FETCH_ERROR' },
      { status: 500 }
    );
  }
});

// =============================================================================
// POST - Create a new project
// =============================================================================

export const POST = withAuth(async (request, { userId, prisma }) => {
  const parsed = await parseBody(request, CreateProjectSchema);
  if ('error' in parsed) return parsed.error;

  const data = parsed.data;
  // Support both camelCase and snake_case field names
  const scriptText = data.scriptText || data.script_text;
  const pageCount = data.pageCount ?? data.page_count;

  try {
    const project = await createProject(prisma, userId, {
      name: data.name,
      description: data.description,
      scriptText: scriptText || null,
      pageCount: pageCount || 0,
    });

    return NextResponse.json(project, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to create project', code: 'CREATE_ERROR' },
      { status: 500 }
    );
  }
});
