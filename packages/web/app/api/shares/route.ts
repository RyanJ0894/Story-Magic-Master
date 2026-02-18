import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { hashPassword } from '@/lib/password';
import { CreateShareRequestSchema } from '@/lib/api/dto';
import { validateCsrf } from '@/lib/csrf';
import { log } from '@/lib/logger';

// GET /api/shares - List all shares for current user
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');

  const where: Record<string, unknown> = { sharedBy: userId };
  if (projectId) {
    where.projectId = projectId;
  }

  const shares = await prisma.scriptShare.findMany({
    where,
    include: {
      project: {
        select: {
          id: true,
          name: true,
          pageCount: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ shares });
}

// POST /api/shares - Create a new share link
export async function POST(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  // Parse and validate request body
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  const parseResult = CreateShareRequestSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parseResult.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const {
    project_id,
    access_level,
    expires_at,
    recipient_email,
    recipient_name,
    max_plays,
    password,
  } = parseResult.data;

  // Verify user owns this project
  const project = await prisma.project.findFirst({
    where: { id: project_id },
    select: { id: true, name: true, userId: true },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (project.userId !== userId) {
    return NextResponse.json({ error: 'Not authorized to share this project' }, { status: 403 });
  }

  // Check subscription status
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['active', 'trialing'] },
    },
  });

  if (!subscription) {
    return NextResponse.json(
      { error: 'Active subscription required to share scripts' },
      { status: 403 }
    );
  }

  // Generate share code
  const shareCode = nanoid(10);

  try {
    // Create share record
    const share = await prisma.scriptShare.create({
      data: {
        projectId: project_id,
        sharedBy: userId,
        shareCode,
        accessLevel: access_level,
        expiresAt: expires_at ? new Date(expires_at) : null,
        recipientEmail: recipient_email ?? null,
        recipientName: recipient_name ?? null,
        maxPlays: max_plays ?? null,
        passwordHash: password ? await hashPassword(password) : null,
        isActive: true,
      },
    });

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/s/${shareCode}`;

    return NextResponse.json({
      share,
      shareUrl,
      shareCode,
    });
  } catch (error) {
    log.error('Error creating share', error);
    return NextResponse.json({ error: 'Failed to create share' }, { status: 500 });
  }
}
