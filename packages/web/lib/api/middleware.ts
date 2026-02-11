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

type AuthHandlerWithParams = (
  request: Request,
  ctx: AuthContext & { params: Record<string, string> },
) => Promise<NextResponse | Response>;

type ProjectAuthHandler = (
  request: Request,
  ctx: ProjectAuthContext,
) => Promise<NextResponse | Response>;

// ---------------------------------------------------------------------------
// withAuth — authenticates user, optionally validates CSRF
// ---------------------------------------------------------------------------

export function withAuth(handler: AuthHandler, options?: WithAuthOptions): (request: Request) => Promise<NextResponse | Response>;
export function withAuth(handler: AuthHandlerWithParams, options?: WithAuthOptions): (request: Request, route: RouteParams) => Promise<NextResponse | Response>;
export function withAuth(
  handler: AuthHandler | AuthHandlerWithParams,
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
    return (handler as AuthHandlerWithParams)(request, { userId, prisma, params });
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

    return handler(request, { userId, prisma, projectId, project: project as unknown as Record<string, unknown> });
  };
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
