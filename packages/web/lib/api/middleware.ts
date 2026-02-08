/**
 * Shared API Route Middleware
 *
 * Composable wrappers that eliminate repeated auth, CSRF, and ownership
 * boilerplate from Next.js API routes.
 *
 * Usage:
 *   export const GET = withAuth(async (request, { user, supabase }) => { ... });
 *   export const POST = withAuth(async (request, { user, supabase }) => { ... }, { csrf: true });
 *   export const PATCH = withProjectAuth(async (request, { user, supabase, project, projectId }) => { ... });
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateCsrf } from '@/lib/csrf';
import type { SupabaseClient, User } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthContext {
  user: User;
  supabase: SupabaseClient;
}

export interface ProjectAuthContext extends AuthContext {
  projectId: string;
  project: Record<string, unknown>;
}

export interface WithAuthOptions {
  /** Validate CSRF origin header. Default: true for POST/PUT/PATCH/DELETE */
  csrf?: boolean;
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

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 },
      );
    }

    const params = route?.params ? await route.params : {};
    return (handler as AuthHandlerWithParams)(request, { user, supabase, params });
  };
}

// ---------------------------------------------------------------------------
// withProjectAuth — auth + project ownership in one call
// ---------------------------------------------------------------------------

export function withProjectAuth(
  handler: ProjectAuthHandler,
  options: WithAuthOptions & { select?: string } = {},
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

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
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

    const selectCols = options.select || '*';
    const { data: project, error } = await supabase
      .from('projects')
      .select(selectCols)
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (error || !project) {
      return NextResponse.json(
        { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
        { status: 404 },
      );
    }

    return handler(request, { user, supabase, projectId, project: project as unknown as Record<string, unknown> });
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
