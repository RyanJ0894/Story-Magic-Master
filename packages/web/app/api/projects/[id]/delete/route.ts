import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { validateCsrf } from '@/lib/csrf';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  // CSRF protection
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // Delete project (cascade will handle jobs and audio_outputs)
    const deleted = await prisma.project.deleteMany({
      where: { id: params.id, userId },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Delete failed' }, { status: 500 });
  }
}
