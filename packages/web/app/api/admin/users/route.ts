import { NextResponse } from 'next/server';
import { withAdminAuth, parseBody, errorResponse } from '@/lib/api/middleware';
import { z } from 'zod';
import { Prisma } from '@story-magic/shared';
import { logAuditEvent, extractRequestInfo, AuditActions, ResourceTypes } from '@/lib/api/audit';
import { log } from '@/lib/logger';

// Query params schema
const GetUsersQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  type: z.enum(['writer', 'reader', 'admin']).optional(),
  sortBy: z.enum(['created_at', 'full_name', 'user_type']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Map sort field from snake_case to camelCase
const sortFieldMap: Record<string, string> = {
  created_at: 'createdAt',
  full_name: 'fullName',
  user_type: 'userType',
};

/**
 * GET /api/admin/users
 * List all users with filtering and pagination
 */
export const GET = withAdminAuth(async (request, { userId, prisma }) => {
  // Parse query params
  const { searchParams } = new URL(request.url);
  const parseResult = GetUsersQuerySchema.safeParse({
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    search: searchParams.get('search') ?? undefined,
    type: searchParams.get('type') ?? undefined,
    sortBy: searchParams.get('sortBy') ?? undefined,
    sortOrder: searchParams.get('sortOrder') ?? undefined,
  });

  if (!parseResult.success) {
    return errorResponse('Invalid query parameters', 400, { code: 'VALIDATION_ERROR' });
  }

  const { page, limit, search, type, sortBy, sortOrder } = parseResult.data;
  const offset = (page - 1) * limit;

  // Build where clause
  const where: Prisma.ProfileWhereInput = {};

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { writerCode: { contains: search, mode: 'insensitive' } },
      { readerCode: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (type) {
    where.userType = type;
  }

  const prismaSort = sortFieldMap[sortBy] || 'createdAt';

  try {
    const [users, count] = await Promise.all([
      prisma.profile.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          userType: true,
          writerCode: true,
          readerCode: true,
          createdAt: true,
          updatedAt: true,
          subscriptions: {
            select: { id: true, status: true, plan: true },
          },
        },
        orderBy: { [prismaSort]: sortOrder },
        skip: offset,
        take: limit,
      }),
      prisma.profile.count({ where }),
    ]);

    return NextResponse.json({
      data: users,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
        hasMore: page * limit < count,
      },
    });
  } catch (error) {
    log.error('Error fetching users', error);
    return errorResponse('Failed to fetch users', 500);
  }
});

// Update user schema (includes userId for identifying the target)
const UpdateUserBodySchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  user_type: z.enum(['writer', 'reader', 'admin']).optional(),
  full_name: z.string().max(100).optional(),
  suspended: z.boolean().optional(),
});

/**
 * PATCH /api/admin/users
 * Update a user's profile (for admin actions)
 */
export const PATCH = withAdminAuth(async (request, { userId: adminUserId, prisma }) => {
  const parsed = await parseBody(request, UpdateUserBodySchema);
  if ('error' in parsed) return parsed.error;

  const { userId, ...updates } = parsed.data;

  // Build Prisma update data with camelCase
  const prismaUpdates: Record<string, unknown> = {};
  if (updates.user_type !== undefined) prismaUpdates.userType = updates.user_type;
  if (updates.full_name !== undefined) prismaUpdates.fullName = updates.full_name;
  if (updates.suspended !== undefined) prismaUpdates.suspended = updates.suspended;

  try {
    const updatedUser = await prisma.profile.update({
      where: { id: userId },
      data: prismaUpdates,
    });

    // Log audit event
    const requestInfo = extractRequestInfo(request);
    await logAuditEvent({
      user_id: adminUserId,
      action: updates.suspended ? AuditActions.ADMIN_USER_SUSPEND : AuditActions.ADMIN_USER_UPDATE,
      resource_type: ResourceTypes.USER,
      resource_id: userId,
      details: {
        changes: updates,
      },
      ...requestInfo,
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    log.error('Error updating user', error);
    return errorResponse('Failed to update user', 500);
  }
}, { rateLimit: 'strict' });
