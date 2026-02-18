import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/middleware';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { log } from '@/lib/logger';

// Query params schema
const GetAuditLogsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(30),
  action: z.string().optional(),
  resource: z.string().optional(),
  userId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * GET /api/admin/audit-logs
 * List audit log entries with filtering and pagination
 */
export const GET = withAdminAuth(async (request, { userId, prisma }) => {
  // Parse query params
  const { searchParams } = new URL(request.url);
  const parseResult = GetAuditLogsQuerySchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    action: searchParams.get('action'),
    resource: searchParams.get('resource'),
    userId: searchParams.get('userId'),
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
  });

  if (!parseResult.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  const { page, limit, action, resource, userId: filterUserId, startDate, endDate } = parseResult.data;
  const offset = (page - 1) * limit;

  // Build where clause
  const where: Prisma.AuditLogWhereInput = {};

  if (action) {
    where.action = { contains: action, mode: 'insensitive' };
  }
  if (resource) {
    where.resourceType = resource;
  }
  if (filterUserId) {
    where.userId = filterUserId;
  }
  if (startDate) {
    where.createdAt = { ...(where.createdAt as Prisma.DateTimeFilter || {}), gte: new Date(startDate) };
  }
  if (endDate) {
    where.createdAt = { ...(where.createdAt as Prisma.DateTimeFilter || {}), lte: new Date(endDate) };
  }

  try {
    const [logs, count] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { fullName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      data: logs,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
        hasMore: page * limit < count,
      },
    });
  } catch (error) {
    log.error('Error fetching audit logs', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
});
