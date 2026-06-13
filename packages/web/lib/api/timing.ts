/**
 * H1 — Handler duration instrumentation
 *
 * Wrap any API route handler with `withTiming(handler, routeName)` to get:
 *   - A Sentry breadcrumb on every request: { route, method, duration_ms, status }
 *   - A `Sentry.captureMessage('Slow handler')` at level=warning when
 *     duration crosses SLOW_THRESHOLD_MS (default 5s)
 *   - A `level=error` Sentry event when duration crosses
 *     STUCK_THRESHOLD_MS (default 15s) — by this point Cloudflare is
 *     within 15s of killing the request with a 524 and we want it
 *     paged before the user sees a failure.
 *
 * The 5s / 15s thresholds come from today's incident data:
 *   - Healthy generation kicks return in <1s
 *   - Healthy project/page reads return in <500ms
 *   - The pdf-parse hang and OpenAI embedding loops both crossed 5s
 *     well before they failed
 *
 * Already wired into `withAuth` / `withProjectAuth` in middleware.ts so
 * every authenticated API route gets it automatically. Stand-alone use
 * for routes that don't go through those wrappers is supported.
 */

import { addBreadcrumb, captureMessage } from '@sentry/nextjs';

export const SLOW_THRESHOLD_MS = Number(process.env.HANDLER_SLOW_MS ?? 5_000);
export const STUCK_THRESHOLD_MS = Number(process.env.HANDLER_STUCK_MS ?? 15_000);

type RouteHandler = (request: Request, ctx?: unknown) => Promise<Response>;

export function withTiming(handler: RouteHandler, routeName: string): RouteHandler {
  return async (request, ctx) => {
    const method = request.method;
    const start = Date.now();
    let status = 0;
    try {
      const response = await handler(request, ctx);
      status = response.status;
      return response;
    } catch (err) {
      // Surface the duration on the error path too — most useful when the
      // error is itself caused by a slow upstream.
      status = 500;
      throw err;
    } finally {
      const duration_ms = Date.now() - start;
      recordTiming({ route: routeName, method, duration_ms, status });
    }
  };
}

/**
 * Standalone record — exported so the middleware wrappers
 * (withAuth/withProjectAuth) can call it without needing to wrap themselves.
 */
export function recordTiming(params: {
  route: string;
  method: string;
  duration_ms: number;
  status: number;
}): void {
  const { route, method, duration_ms, status } = params;

  // Always leave a breadcrumb. Cheap, attached to the next event Sentry sees.
  addBreadcrumb({
    category: 'http.handler',
    type: 'http',
    level: duration_ms >= STUCK_THRESHOLD_MS
      ? 'error'
      : duration_ms >= SLOW_THRESHOLD_MS
        ? 'warning'
        : 'info',
    message: `${method} ${route} → ${status} in ${duration_ms}ms`,
    data: { route, method, duration_ms, status },
  });

  if (duration_ms >= STUCK_THRESHOLD_MS) {
    captureMessage(`Stuck handler: ${method} ${route} took ${duration_ms}ms`, {
      level: 'error',
      tags: {
        kind: 'handler-stuck',
        route,
        method,
      },
      extra: { duration_ms, status, threshold_ms: STUCK_THRESHOLD_MS },
    });
  } else if (duration_ms >= SLOW_THRESHOLD_MS) {
    captureMessage(`Slow handler: ${method} ${route} took ${duration_ms}ms`, {
      level: 'warning',
      tags: {
        kind: 'handler-slow',
        route,
        method,
      },
      extra: { duration_ms, status, threshold_ms: SLOW_THRESHOLD_MS },
    });
  }
}
