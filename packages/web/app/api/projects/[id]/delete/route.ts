import { withProjectAuth, errorResponse } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import { deleteProject } from '@/lib/services/projects';

export const POST = withProjectAuth(async (request, { prisma, projectId }) => {
  try {
    await deleteProject(prisma, projectId);
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    log.error('Error deleting project', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Delete failed',
      500,
      { code: 'DELETE_ERROR' },
    );
  }
});
