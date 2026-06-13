/**
 * H7 — Quiescent shutdown for the orchestrator.
 *
 * Render sends SIGTERM ~30 s before SIGKILL on every deploy. Without
 * drain logic, a /orchestrate request that started 8 minutes earlier
 * gets cut mid-render — the partial M4A in /tmp is orphaned and the
 * client retries, paying again for TTS.
 *
 * The contract:
 *   - track every long-running HTTP request via Express middleware
 *   - on SIGTERM/SIGINT, flip a "draining" flag — new long-running
 *     requests return 503 with Retry-After so Render's load balancer
 *     stops routing to us
 *   - wait up to `SHUTDOWN_DRAIN_MS` (default 25 s, below Render's 30 s
 *     SIGKILL window) for in-flight requests to finish
 *   - shut down monitoring + cleanup schedules
 *   - close the HTTP server (rejecting new keep-alive connections)
 *   - exit with code 0 on clean drain, code 1 on timeout
 *
 * Disable via env: `SHUTDOWN_DRAIN_DISABLED=true` — falls back to the
 * old "close immediately" behavior.
 *
 * Observability: every shutdown logs how many requests were in flight
 * when the signal arrived, how many drained successfully, and how many
 * were cut. Sentry breadcrumbs at each stage.
 */

import type { Server } from 'http';
import type { Request, Response, NextFunction } from 'express';
import { log } from './logger.js';
import { Sentry } from './sentry.js';

const DRAIN_TIMEOUT_MS = parseInt(process.env.SHUTDOWN_DRAIN_MS || '25000', 10);
const ENABLED = process.env.SHUTDOWN_DRAIN_DISABLED !== 'true';

// Routes whose duration matters — i.e. real generation work. /health
// and other fast routes are not counted; we don't want a 200 ms health
// check to block shutdown.
const LONG_RUNNING_PATHS = ['/orchestrate', '/generate-scenes', '/analyze', '/preview', '/stems', '/stitch-segments'];

let inFlight = 0;
let draining = false;
let drainResolve: (() => void) | null = null;

function isLongRunning(path: string): boolean {
  return LONG_RUNNING_PATHS.some((p) => path === p || path.startsWith(p + '/'));
}

/**
 * Express middleware. Mount before any long-running route. Increments
 * the in-flight counter and decrements on response finish/close.
 *
 * Returns 503 with Retry-After: 30 if draining has already started —
 * Render's load balancer will route the retry to a healthy instance.
 */
export function trackInFlight(req: Request, res: Response, next: NextFunction): void {
  if (!isLongRunning(req.path)) {
    next();
    return;
  }

  if (draining) {
    res.setHeader('Retry-After', '30');
    res.status(503).json({
      error: 'service_draining',
      message: 'Server is shutting down. Retry in 30 s.',
    });
    return;
  }

  inFlight += 1;
  let settled = false;
  const release = () => {
    if (settled) return;
    settled = true;
    inFlight = Math.max(0, inFlight - 1);
    if (draining && inFlight === 0 && drainResolve) {
      drainResolve();
      drainResolve = null;
    }
  };

  res.on('finish', release);
  res.on('close', release);
  next();
}

/**
 * Quiescent shutdown. Drains in-flight long-running requests, then
 * closes the server. Returns the resolved exit code.
 */
export async function quiescentShutdown(server: Server, onBeforeClose?: () => void | Promise<void>): Promise<number> {
  if (!ENABLED) {
    log.info('[shutdown] drain disabled — closing immediately');
    if (onBeforeClose) await onBeforeClose();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    return 0;
  }

  const startedAt = Date.now();
  const initialInFlight = inFlight;

  log.info('[shutdown] beginning drain', {
    inFlight: initialInFlight,
    drainTimeoutMs: DRAIN_TIMEOUT_MS,
  });
  Sentry.addBreadcrumb({
    category: 'shutdown',
    message: 'drain start',
    level: 'info',
    data: { inFlight: initialInFlight },
  });

  draining = true;

  // Wait for in-flight to drain, or for the timeout — whichever first.
  let drainedCleanly = true;
  if (inFlight > 0) {
    const drainPromise = new Promise<void>((resolve) => {
      drainResolve = resolve;
    });
    const TIMEOUT_SENTINEL: unique symbol = Symbol('timeout');
    const timeoutPromise = new Promise<typeof TIMEOUT_SENTINEL>((resolve) => {
      setTimeout(() => resolve(TIMEOUT_SENTINEL), DRAIN_TIMEOUT_MS).unref();
    });
    const result = await Promise.race([drainPromise, timeoutPromise]);
    if (result === TIMEOUT_SENTINEL) {
      drainedCleanly = false;
      log.warn('[shutdown] drain timed out', {
        stillInFlight: inFlight,
        drainTimeoutMs: DRAIN_TIMEOUT_MS,
      });
      Sentry.captureMessage('shutdown drain timed out', {
        level: 'warning',
        extra: { stillInFlight: inFlight, drainTimeoutMs: DRAIN_TIMEOUT_MS },
      });
    }
  }

  const drainedCount = initialInFlight - inFlight;
  log.info('[shutdown] drain complete', {
    drainedCount,
    stillInFlight: inFlight,
    elapsedMs: Date.now() - startedAt,
    clean: drainedCleanly,
  });

  if (onBeforeClose) {
    try {
      await onBeforeClose();
    } catch (err) {
      log.error('[shutdown] onBeforeClose threw', err instanceof Error ? err : new Error(String(err)));
    }
  }

  // Close the server. server.close() resolves when all keep-alive
  // sockets close; force-close after 5 s if any hang on.
  await new Promise<void>((resolve) => {
    const forceClose = setTimeout(() => {
      log.warn('[shutdown] server.close() did not resolve in 5 s — forcing');
      resolve();
    }, 5000);
    forceClose.unref();
    server.close(() => {
      clearTimeout(forceClose);
      resolve();
    });
  });

  log.info('[shutdown] server closed', {
    totalElapsedMs: Date.now() - startedAt,
    exitCode: drainedCleanly ? 0 : 1,
  });

  return drainedCleanly ? 0 : 1;
}

/**
 * Test-only — reset internal state. Production callers never need this.
 */
export function _resetForTests(): void {
  inFlight = 0;
  draining = false;
  drainResolve = null;
}

/**
 * Test-only — inspect current state without exposing the internals.
 */
export function _getState() {
  return { inFlight, draining };
}
