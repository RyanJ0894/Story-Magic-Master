import { withAuth, parseBody, errorResponse } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { hashPassword } from '@/lib/password';
import { CreateShareRequestSchema } from '@/lib/api/dto';
import { log } from '@/lib/logger';

// GET /api/shares - List all shares for current user
export const GET = withAuth(async (request, { userId, prisma }) => {
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
});

// POST /api/shares - Create a new share link
export const POST = withAuth(async (request, { userId, prisma }) => {
  const parsed = await parseBody(request, CreateShareRequestSchema);
  if ('error' in parsed) return parsed.error;

  const {
    project_id,
    access_level,
    expires_at,
    recipient_email,
    recipient_name,
    max_plays,
    password,
  } = parsed.data;

  // Verify user owns this project
  const project = await prisma.project.findFirst({
    where: { id: project_id },
    select: { id: true, name: true, userId: true },
  });

  if (!project) {
    return errorResponse('Project not found', 404, { code: 'NOT_FOUND' });
  }

  if (project.userId !== userId) {
    return errorResponse('Not authorized to share this project', 403, { code: 'FORBIDDEN' });
  }

  // Check subscription status
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['active', 'trialing'] },
    },
  });

  if (!subscription) {
    return errorResponse('Active subscription required to share scripts', 403, { code: 'SUBSCRIPTION_REQUIRED' });
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
    return errorResponse('Failed to create share', 500);
  }
});
