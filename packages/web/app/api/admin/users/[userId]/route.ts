import { NextResponse } from 'next/server';
import { withAuth, parseBody, errorResponse } from '@/lib/api/middleware';
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
    return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
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
    return errorResponse('User not found', 404, { code: 'NOT_FOUND' });
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
    return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
  }

  const parsed = await parseBody(request, UpdateUserSchema);
  if ('error' in parsed) return parsed.error;

  const updates = parsed.data;

  // Verify target user exists
  const existingUser = await prisma.profile.findUnique({
    where: { id: targetUserId },
    select: { id: true, userType: true },
  });

  if (!existingUser) {
    return errorResponse('User not found', 404, { code: 'NOT_FOUND' });
  }

  // Prevent admin from demoting themselves
  if (targetUserId === authUserId && updates.user_type && updates.user_type !== 'admin') {
    return errorResponse('Cannot change your own admin role', 400, { code: 'SELF_DEMOTE' });
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
    return errorResponse('Failed to update user', 500);
  }
}, { rateLimit: 'strict' });
