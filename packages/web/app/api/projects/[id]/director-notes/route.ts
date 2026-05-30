/**
 * Director Notes API
 *
 * GET /api/projects/[id]/director-notes — return current director notes
 * PUT /api/projects/[id]/director-notes — save director notes (ownership enforced)
 */

import { withProjectAuth, errorResponse } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { Prisma } from '@story-magic/shared';
import { z } from 'zod';

const CharacterNotesSchema = z.record(z.string(), z.string().max(2000));

const DirectorNotesSchema = z.object({
  global: z.string().max(500),
  characters: CharacterNotesSchema,
});

const PutBodySchema = z.object({
  directorNotes: DirectorNotesSchema.nullable(),
});

export const GET = withProjectAuth(async (_request, { prisma, projectId }) => {
  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: { directorNotes: true },
  });

  if (!project) {
    return errorResponse('Project not found', 404, { code: 'NOT_FOUND' });
  }

  return NextResponse.json({ directorNotes: project.directorNotes ?? null });
});

export const PUT = withProjectAuth(async (request, { prisma, projectId }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON', 400, { code: 'INVALID_JSON' });
  }

  const parsed = PutBodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse('Validation failed', 400, {
      code: 'VALIDATION_ERROR',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { directorNotes: parsed.data.directorNotes ?? Prisma.DbNull },
    select: { directorNotes: true },
  });

  return NextResponse.json({ directorNotes: updated.directorNotes ?? null });
});
