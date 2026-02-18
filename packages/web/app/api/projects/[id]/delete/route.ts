import { withProjectAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';

export const POST = withProjectAuth(async (request, { prisma, projectId }) => {
  try {
    await prisma.project.delete({
      where: { id: projectId },
    });

    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    log.error('Error deleting project', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Delete failed' }, { status: 500 });
  }
});
