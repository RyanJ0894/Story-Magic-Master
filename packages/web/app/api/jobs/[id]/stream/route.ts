/**
 * GET /api/jobs/[id]/stream
 *
 * Real-time job-status push via Server-Sent Events.
 *
 * Behavior:
 *   1. Auth + ownership check (same shape as /api/jobs/[id])
 *   2. Open a dedicated pg.Client and LISTEN on the per-job channel
 *   3. Send initial JobStatus immediately so client doesn't wait for the
 *      next NOTIFY before showing anything
 *   4. On every Postgres NOTIFY: re-query the job + push JobStatus event
 *   5. Heartbeat every 25 s to keep Render's proxy + browser EventSource alive
 *   6. On client disconnect: UNLISTEN, release pg.Client, clear timers
 *
 * Fallback contract: any failure on this path (LISTEN budget exhausted,
 * pg connect failure, DB read error mid-stream) results in either a 503
 * (initial setup) or a stream close (mid-stream). The browser-side
 * useJobStream hook detects both and falls back to the existing 2 s
 * polling endpoint.
 *
 * Wire format: the `data:` payload is exactly the JSON shape returned by
 * /api/jobs/[id] so the client consumer can swap channels without
 * changing its state-update logic.
 *
 * See docs/REALTIME_JOB_SYNC_2026-06-25.md for the full design.
 */

import { withAuth, errorResponse } from '@/lib/api/middleware';
import {
  openJobListenClient,
  listenerBudgetExhausted,
  getActiveListenerCount,
} from '@/lib/realtime/job-listen-pool';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Build the JobStatus JSON we push over SSE. Same shape as the polling
 * endpoint (/api/jobs/[id]) so the consumer doesn't have to branch on
 * transport. Single source of truth for the wire format would be ideal
 * but the two routes already diverge slightly (this one doesn't include
 * `project_status`); refactoring to a shared serializer is a follow-up.
 */
function serializeJobForStream(job: {
  id: string;
  status: string;
  progress: unknown;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  projectId: string;
  segments: unknown;
  firstAudioUrl: string | null;
  result: unknown;
  retryCount: number;
  maxRetries: number;
}): Record<string, unknown> {
  const progress = (job.progress as Record<string, unknown> | null) || { step: 'unknown', percent: 0 };
  return {
    id: job.id,
    status: job.status,
    progress,
    error: job.error,
    started_at: job.startedAt,
    completed_at: job.completedAt,
    created_at: job.createdAt,
    project_id: job.projectId,
    segments: job.segments ?? null,
    firstAudioUrl: job.firstAudioUrl ?? null,
    audio_url:
      job.status === 'completed'
        ? ((job.result as Record<string, unknown>)?.audio_urls as string[] | undefined)?.[0] ?? null
        : null,
    retry_count: job.retryCount,
    max_retries: job.maxRetries,
  };
}

export const GET = withAuth(async (_request, { userId, prisma, params }) => {
  const jobId = params.id;

  // Initial auth + ownership check before opening any expensive resource.
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { project: { select: { userId: true } } },
  });

  if (!job) {
    return errorResponse('Job not found', 404, { code: 'NOT_FOUND' });
  }
  if (job.project.userId !== userId) {
    return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
  }

  // LISTEN budget check. If at cap, return 503 with Retry-After so the
  // client falls back to its 2 s polling. We never want to block here.
  if (listenerBudgetExhausted()) {
    log.warn('[/api/jobs/stream] LISTEN budget exhausted, returning 503', {
      activeListeners: getActiveListenerCount(),
    });
    return new Response(
      JSON.stringify({ error: 'service_busy', code: 'LISTENER_BUDGET' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '5' },
      },
    );
  }

  const encoder = new TextEncoder();

  // Hoist `cleanup` into the outer scope so both `start()` and `cancel()`
  // close over the same function. Earlier revision stashed it on the
  // controller object and read it via `this` in cancel(), but those are
  // different objects in the ReadableStreamSource init shape — the read
  // returned undefined and disconnects silently leaked pg connections.
  let cleanup: () => Promise<void> = async () => { /* will be replaced in start() */ };

  // Build a ReadableStream that holds the SSE connection. The cleanup
  // path (cancel) UNLISTENs + releases the pg client; the controller
  // closure pins the listenHandle / heartbeat / abort wiring.
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let listenHandle: { close: () => Promise<void> } | null = null;
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

      const sendEvent = (data: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Controller closed by the runtime; cleanup will follow via cancel()
        }
      };

      const sendHeartbeat = () => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          // noop
        }
      };

      cleanup = async () => {
        if (closed) return;
        closed = true;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (listenHandle) {
          try { await listenHandle.close(); } catch { /* noop */ }
        }
        try { controller.close(); } catch { /* noop */ }
      };

      // Always send the current state first so the browser doesn't have
      // to wait for a worker update before painting.
      sendEvent(serializeJobForStream(job));

      // Spin up the LISTEN client. Each NOTIFY refetches and pushes.
      try {
        listenHandle = await openJobListenClient({
          jobId,
          onNotify: () => {
            // Lazy refetch: keep this lambda fast and non-blocking so the
            // pg client's notification loop never stalls.
            (async () => {
              if (closed) return;
              try {
                const fresh = await prisma.job.findUnique({
                  where: { id: jobId },
                });
                if (fresh) sendEvent(serializeJobForStream(fresh));
              } catch (err) {
                log.warn('[/api/jobs/stream] refetch on NOTIFY failed', {
                  jobId,
                  error: err instanceof Error ? err.message : String(err),
                });
              }
            })();
          },
          onError: (err) => {
            log.warn('[/api/jobs/stream] pg client error mid-stream', {
              jobId,
              error: err.message,
            });
            void cleanup();
          },
        });
      } catch (err) {
        log.warn('[/api/jobs/stream] failed to open LISTEN client', {
          jobId,
          error: err instanceof Error ? err.message : String(err),
        });
        // Push a final event so the client knows we're done, then close.
        // Client side will treat the close as an error and fall back.
        void cleanup();
        return;
      }

      // 25 s heartbeat — same cadence used by the orchestrator SSE routes
      // (#394, #402, #403). Keeps Render's inter-service proxy and the
      // browser EventSource alive without flooding the wire.
      heartbeatTimer = setInterval(sendHeartbeat, 25_000);
    },
    async cancel(reason) {
      // The runtime calls cancel() when the client disconnects. `cleanup`
      // is the closure assigned by start() — same lexical scope, so both
      // sides see the same function reference.
      try { await cleanup(); } catch { /* noop */ }
      log.info('[/api/jobs/stream] client disconnected', { reason: String(reason ?? 'unknown') });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}, { rateLimit: 'loose' });
