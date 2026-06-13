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
import { recordTiming } from '@/lib/api/timing';
import { prisma } from '@/lib/db';
import type { PrismaClient } from '@story-magic/shared';
import { errorResponse } from '@/lib/api/error-response';
export { errorResponse } from '@/lib/api/error-response';

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

type RouteParams = { params: Promise<Record<string, string | string[]>> };

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
  return async (request: Request, route: RouteParams) => {
    // H1 (hardening): record handler duration on every request. Slow paths
    // hit Sentry as warnings, stuck paths (>15s, within 15s of the
    // Cloudflare 524 cutoff) hit as errors. Route name is derived from the
    // pathname which is good enough for the breadcrumb/event tag.
    const startedAt = Date.now();
    const routeName = new URL(request.url).pathname;
    let finalStatus = 0;
    try {
    // CSRF: default to checking on mutation methods
    const method = request.method.toUpperCase();
    const shouldCheckCsrf = options.csrf ?? ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (shouldCheckCsrf) {
      const csrfError = validateCsrf(request);
      if (csrfError) {
        finalStatus = 403;
        return errorResponse('CSRF validation failed', 403, { code: 'CSRF_ERROR' });
      }
    }

    // Rate limiting (after CSRF, before auth — blocks abusive IPs early)
    if (options.rateLimit !== false) {
      const tier = options.rateLimit || 'normal';
      const ip = getClientIp(request);
      const limited = await rateLimit(`api:${ip}`, tier);
      if (limited) {
        finalStatus = 429;
        return limited;
      }
    }

    const { userId } = await auth();

    if (!userId) {
      finalStatus = 401;
      return errorResponse('Unauthorized', 401, { code: 'AUTH_REQUIRED' });
    }

    const params = (route?.params ? await route.params : {}) as Record<string, string>;
    const response = await handler(request, { userId, prisma, params });
    finalStatus = (response as Response).status ?? 200;
    return response;
    } finally {
      recordTiming({
        route: routeName,
        method: request.method,
        duration_ms: Date.now() - startedAt,
        status: finalStatus,
      });
    }
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
    const startedAt = Date.now();
    const routeName = new URL(request.url).pathname;
    let finalStatus = 0;
    try {
    const method = request.method.toUpperCase();
    const shouldCheckCsrf = options.csrf ?? ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (shouldCheckCsrf) {
      const csrfError = validateCsrf(request);
      if (csrfError) {
        finalStatus = 403;
        return errorResponse('CSRF validation failed', 403, { code: 'CSRF_ERROR' });
      }
    }

    // Rate limiting
    if (options.rateLimit !== false) {
      const tier = options.rateLimit || 'normal';
      const ip = getClientIp(request);
      const limited = await rateLimit(`api:${ip}`, tier);
      if (limited) {
        finalStatus = 429;
        return limited;
      }
    }

    const { userId } = await auth();

    if (!userId) {
      finalStatus = 401;
      return errorResponse('Unauthorized', 401, { code: 'AUTH_REQUIRED' });
    }

    const params = (await route.params) as Record<string, string>;
    const projectId = params.id;

    if (!projectId) {
      finalStatus = 400;
      return errorResponse('Project ID required', 400, { code: 'MISSING_PROJECT_ID' });
    }

    // BL-014/BL-015: Three access paths:
    // 1. User owns the project directly.
    // 2. User is the team owner (master account) — full access to any project
    //    shared with their team.
    // 3. User is an accepted team member (sub-account) — requires an explicit
    //    ProjectAssignment record for this project (seeded from existing shares
    //    in migration 0035; new shares also create an assignment row).
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { userId },
          { teamShares: { some: { team: { ownerId: userId } } } },
          {
            AND: [
              {
                teamShares: {
                  some: {
                    team: {
                      members: {
                        some: {
                          userId,
                          acceptedAt: { not: null },
                          deactivatedAt: null,
                        },
                      },
                    },
                  },
                },
              },
              { projectAssignments: { some: { userId } } },
            ],
          },
        ],
      },
    });

    if (!project) {
      finalStatus = 404;
      return errorResponse('Project not found', 404, { code: 'PROJECT_NOT_FOUND' });
    }

    const response = await handler(request, { userId, prisma, params, projectId, project: project as unknown as Record<string, unknown> });
    finalStatus = (response as Response).status ?? 200;
    return response;
    } finally {
      recordTiming({
        route: routeName,
        method: request.method,
        duration_ms: Date.now() - startedAt,
        status: finalStatus,
      });
    }
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
      return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
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
      error: errorResponse('Internal error', 500, { code: 'INVALID_MODEL' }),
    };
  }

  const resource = await prismaModel.findFirst({
    where: { id: resourceId },
    ...(select && { select: { ...select, [ownerField]: true } }),
  });

  if (!resource || (resource as Record<string, unknown>)[ownerField] !== userId) {
    return {
      error: errorResponse('Not found', 404, { code: 'NOT_FOUND' }),
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
      error: errorResponse('Invalid JSON in request body', 400, { code: 'INVALID_JSON' }),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      error: errorResponse('Invalid request parameters', 400, {
        code: 'VALIDATION_ERROR',
        details: result.error.flatten().fieldErrors,
      }),
    };
  }

  return { data: result.data };
}
