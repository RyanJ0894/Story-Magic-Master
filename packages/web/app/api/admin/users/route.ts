import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { logAuditEvent, extractRequestInfo, AuditActions, ResourceTypes } from '@/lib/api/audit';
import { validateCsrf } from '@/lib/csrf';

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
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { userType: true },
  });

  if (profile?.userType !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const parseResult = GetUsersQuerySchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    search: searchParams.get('search'),
    type: searchParams.get('type'),
    sortBy: searchParams.get('sortBy'),
    sortOrder: searchParams.get('sortOrder'),
  });

  if (!parseResult.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  const { page, limit, search, type, sortBy, sortOrder } = parseResult.data;
  const offset = (page - 1) * limit;

  // Build where clause
  const where: Prisma.ProfileWhereInput = {};

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
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
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// Update user schema
const UpdateUserSchema = z.object({
  user_type: z.enum(['writer', 'reader', 'admin']).optional(),
  full_name: z.string().max(100).optional(),
  suspended: z.boolean().optional(),
});

/**
 * PATCH /api/admin/users
 * Update a user's profile (for admin actions)
 */
export async function PATCH(request: Request) {
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const { userId: adminUserId } = await auth();
  if (!adminUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminProfile = await prisma.profile.findUnique({
    where: { id: adminUserId },
    select: { userType: true },
  });

  if (adminProfile?.userType !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { userId, ...updateData } = body;

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const parseResult = UpdateUserSchema.safeParse(updateData);
  if (!parseResult.success) {
    return NextResponse.json({
      error: 'Invalid request body',
      details: parseResult.error.format(),
    }, { status: 400 });
  }

  const updates = parseResult.data;

  // Build Prisma update data with camelCase
  const prismaUpdates: Prisma.ProfileUpdateInput = {};
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
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
