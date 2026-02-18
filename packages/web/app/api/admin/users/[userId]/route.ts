import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { z } from 'zod';
import { logAuditEvent, extractRequestInfo, AuditActions, ResourceTypes } from '@/lib/api/audit';
import { log } from '@/lib/logger';

// =============================================================================
// Input Validation
// =============================================================================

const UpdateUserSchema = z.object({
  user_type: z.enum(['writer', 'reader', 'admin']).optional(),
  suspended: z.boolean().optional(),
});

// =============================================================================
// GET /api/admin/users/[userId] - Get user details
// =============================================================================

export const GET = withAuth(async (request, { userId: authUserId, prisma, params }) => {
  const targetUserId = params.userId;

  // Verify admin
  const adminProfile = await prisma.profile.findUnique({
    where: { id: authUserId },
    select: { userType: true },
  });

  if (adminProfile?.userType !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch user profile with related data
  const userProfile = await prisma.profile.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      fullName: true,
      userType: true,
      writerCode: true,
      readerCode: true,
      createdAt: true,
      updatedAt: true,
      subscriptions: {
        select: {
          id: true,
          status: true,
          plan: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
        },
      },
    },
  });

  if (!userProfile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Fetch project count for this user
  const projectCount = await prisma.project.count({
    where: { userId: targetUserId },
  });

  return NextResponse.json({
    data: {
      ...userProfile,
      project_count: projectCount,
    },
  });
});

// =============================================================================
// PATCH /api/admin/users/[userId] - Update user (role, suspend, etc.)
// =============================================================================

export const PATCH = withAuth(async (request, { userId: authUserId, prisma, params }) => {
  const targetUserId = params.userId;

  // Verify admin
  const adminProfile = await prisma.profile.findUnique({
    where: { id: authUserId },
    select: { userType: true },
  });

  if (adminProfile?.userType !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parseResult = UpdateUserSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({
      error: 'Invalid request body',
      details: parseResult.error.format(),
    }, { status: 400 });
  }

  const updates = parseResult.data;

  // Verify target user exists
  const existingUser = await prisma.profile.findUnique({
    where: { id: targetUserId },
    select: { id: true, userType: true },
  });

  if (!existingUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Prevent admin from demoting themselves
  if (targetUserId === authUserId && updates.user_type && updates.user_type !== 'admin') {
    return NextResponse.json({ error: 'Cannot change your own admin role' }, { status: 400 });
  }

  // Build Prisma update data with camelCase
  const prismaUpdates: Record<string, unknown> = {};
  if (updates.user_type !== undefined) prismaUpdates.userType = updates.user_type;
  if (updates.suspended !== undefined) prismaUpdates.suspended = updates.suspended;

  try {
    const updatedUser = await prisma.profile.update({
      where: { id: targetUserId },
      data: prismaUpdates,
    });

    // Log audit event
    const requestInfo = extractRequestInfo(request);
    await logAuditEvent({
      user_id: authUserId,
      action: updates.suspended ? AuditActions.ADMIN_USER_SUSPEND : AuditActions.ADMIN_USER_UPDATE,
      resource_type: ResourceTypes.USER,
      resource_id: targetUserId,
      details: {
        changes: updates,
        previous_user_type: existingUser.userType,
      },
      ...requestInfo,
    });

    return NextResponse.json({ data: updatedUser });
  } catch (error) {
    log.error('Error updating user', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
});
