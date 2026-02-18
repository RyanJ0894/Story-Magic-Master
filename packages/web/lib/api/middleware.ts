/**
 * Shared API Route Middleware
 *
 * Composable wrappers that eliminate repeated auth, CSRF, and ownership
 * boilerplate from Next.js API routes.
 *
 * Usage:
 *   export const GET = withAuth(async (request, { userId, prisma }) => { ... });
 *   export const POST = withAuth(async (request, { userId, prisma }) => { ... }, { csrf: true });
 *   export const PATCH = withProjectAuth(async (request, { userId, prisma, project, projectId }) => { ... });
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { validateCsrf } from '@/lib/csrf';
import { rateLimit, getClientIp, type RateLimitTier } from '@/lib/api/rate-limit';
import { prisma } from '@/lib/db';
import type { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthContext {
  userId: string;
  prisma: PrismaClient;
  params: Record<string, string>;
}

export interface ProjectAuthContext extends AuthContext {
  projectId: string;
  project: Record<string, unknown>;
}

export interface WithAuthOptions {
  /** Validate CSRF origin header. Default: true for POST/PUT/PATCH/DELETE */
  csrf?: boolean;
  /** Rate limit tier. Default: 'normal'. Set to false to disable. */
  rateLimit?: RateLimitTier | false;
}

type RouteParams = { params: Promise<Record<string, string>> };

type AuthHandler = (
  request: Request,
  ctx: AuthContext,
) => Promise<NextResponse | Response>;

type ProjectAuthHandler = (
  request: Request,
  ctx: ProjectAuthContext,
) => Promise<NextResponse | Response>;

// ---------------------------------------------------------------------------
// withAuth — authenticates user, optionally validates CSRF
// ---------------------------------------------------------------------------

export function withAuth(
  handler: AuthHandler,
  options: WithAuthOptions = {},
) {
  return async (request: Request, route?: RouteParams) => {
    // CSRF: default to checking on mutation methods
    const method = request.method.toUpperCase();
    const shouldCheckCsrf = options.csrf ?? ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (shouldCheckCsrf) {
      const csrfError = validateCsrf(request);
      if (csrfError) {
        return NextResponse.json(
          { error: 'CSRF validation failed', code: 'CSRF_ERROR' },
          { status: 403 },
        );
      }
    }

    // Rate limiting (after CSRF, before auth — blocks abusive IPs early)
    if (options.rateLimit !== false) {
      const tier = options.rateLimit || 'normal';
      const ip = getClientIp(request);
      const limited = await rateLimit(`api:${ip}`, tier);
      if (limited) return limited;
    }

    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 },
      );
    }

    const params = route?.params ? await route.params : {};
    return handler(request, { userId, prisma, params });
  };
}

// ---------------------------------------------------------------------------
// withProjectAuth — auth + project ownership in one call
// ---------------------------------------------------------------------------

export function withProjectAuth(
  handler: ProjectAuthHandler,
  options: WithAuthOptions = {},
) {
  return async (request: Request, route: RouteParams) => {
    const method = request.method.toUpperCase();
    const shouldCheckCsrf = options.csrf ?? ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (shouldCheckCsrf) {
      const csrfError = validateCsrf(request);
      if (csrfError) {
        return NextResponse.json(
          { error: 'CSRF validation failed', code: 'CSRF_ERROR' },
          { status: 403 },
        );
      }
    }

    // Rate limiting
    if (options.rateLimit !== false) {
      const tier = options.rateLimit || 'normal';
      const ip = getClientIp(request);
      const limited = await rateLimit(`api:${ip}`, tier);
      if (limited) return limited;
    }

    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 },
      );
    }

    const params = await route.params;
    const projectId = params.id;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID required', code: 'MISSING_PROJECT_ID' },
        { status: 400 },
      );
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: userId,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
        { status: 404 },
      );
    }

    return handler(request, { userId, prisma, params, projectId, project: project as unknown as Record<string, unknown> });
  };
}

// ---------------------------------------------------------------------------
// withAdminAuth — auth + admin role check in one call
// ---------------------------------------------------------------------------

export interface AdminAuthContext extends AuthContext {
  /** The admin's profile record (id + userType) */
  profile: { id: string; userType: string };
}

type AdminAuthHandler = (
  request: Request,
  ctx: AdminAuthContext,
) => Promise<NextResponse | Response>;

/**
 * Wraps a route handler with authentication and admin role verification.
 * Responds with 403 if the user's profile.userType is not 'admin'.
 */
export function withAdminAuth(
  handler: AdminAuthHandler,
  options: WithAuthOptions = {},
) {
  return withAuth(async (request, ctx) => {
    const profile = await ctx.prisma.profile.findUnique({
      where: { id: ctx.userId },
      select: { id: true, userType: true },
    });

    if (profile?.userType !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return handler(request, { ...ctx, profile: { id: profile.id, userType: profile.userType } });
  }, options);
}

// ---------------------------------------------------------------------------
// verifyOwnership — reusable ownership check for arbitrary resources
// ---------------------------------------------------------------------------

export interface VerifyOwnershipOptions<T> {
  /** The Prisma model name (e.g. 'scriptShare', 'team') */
  model: string;
  /** The resource ID to look up */
  resourceId: string;
  /** The authenticated user's ID */
  userId: string;
  /** The field on the model that stores the owner user ID. Default: 'userId' */
  ownerField?: string;
  /** Optional select clause to return specific fields */
  select?: Record<string, boolean>;
}

/**
 * Verifies that a resource exists and belongs to the authenticated user.
 * Returns the resource if ownership is confirmed, or a 404 NextResponse if not.
 *
 * Usage:
 *   const result = await verifyOwnership({
 *     model: 'scriptShare',
 *     resourceId: shareId,
 *     userId,
 *     ownerField: 'sharedBy',
 *   });
 *   if ('error' in result) return result.error;
 *   const share = result.data;
 */
export async function verifyOwnership<T = Record<string, unknown>>(
  opts: VerifyOwnershipOptions<T>,
): Promise<{ data: T } | { error: NextResponse }> {
  const { model, resourceId, userId, ownerField = 'userId', select } = opts;

  // Access the Prisma model dynamically
  const prismaModel = (prisma as unknown as Record<string, { findFirst: Function }>)[model];
  if (!prismaModel) {
    return {
      error: NextResponse.json(
        { error: 'Internal error', code: 'INVALID_MODEL' },
        { status: 500 },
      ),
    };
  }

  const resource = await prismaModel.findFirst({
    where: { id: resourceId },
    ...(select && { select: { ...select, [ownerField]: true } }),
  });

  if (!resource || (resource as Record<string, unknown>)[ownerField] !== userId) {
    return {
      error: NextResponse.json(
        { error: 'Not found', code: 'NOT_FOUND' },
        { status: 404 },
      ),
    };
  }

  return { data: resource as T };
}

// ---------------------------------------------------------------------------
// parseBody — safe JSON parsing + Zod validation helper
// ---------------------------------------------------------------------------

import { z } from 'zod';

export async function parseBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      error: NextResponse.json(
        { error: 'Invalid JSON in request body', code: 'INVALID_JSON' },
        { status: 400 },
      ),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      error: NextResponse.json(
        {
          error: 'Invalid request parameters',
          code: 'VALIDATION_ERROR',
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 },
      ),
    };
  }

  return { data: result.data };
}
