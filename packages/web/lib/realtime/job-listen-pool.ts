/**
 * Real-time job sync — Postgres LISTEN client manager.
 *
 * Web's SSE endpoint can't reuse Prisma's connection pool because:
 *
 *   1. Prisma multiplexes queries through pooled connections; it doesn't
 *      hold one open for an indefinite LISTEN.
 *   2. Prisma's transactional view doesn't surface `notification` events
 *      from the underlying pg driver.
 *
 * So each SSE client gets a dedicated `pg.Client` (from the `pg` package
 * directly), connects, runs `LISTEN "job:{id}"`, and pushes events to the
 * browser. When the browser disconnects, we run `UNLISTEN` and release
 * the connection.
 *
 * **Connection budget.** Each open SSE client = 1 Postgres connection.
 * Render Postgres limits us to ~20 connections shared with Prisma's pool
 * (default 8). We cap simultaneous SSE listeners per web instance via
 * `MAX_SSE_LISTENERS` (default 16) — when at cap, the SSE endpoint
 * returns 503 and the browser falls back to its existing 2 s polling.
 *
 * **No retry inside this helper.** If the connect or LISTEN throws, we
 * surface the error and let the SSE route handle the fallback. Keeping
 * retry logic out of the helper makes it composable and easy to test.
 *
 * See `docs/REALTIME_JOB_SYNC_2026-06-25.md` for the full architecture.
 */

import { Client } from 'pg';
import { jobChannelName } from './notify-job-update';

const MAX_SSE_LISTENERS = parseInt(process.env.MAX_SSE_LISTENERS || '16', 10);

/**
 * Active LISTEN-holding clients. Incremented on connect, decremented on
 * `close()`. Module-scope counter survives across requests on a single
 * web instance — exactly the granularity we want. Render's multi-instance
 * setup means each instance gets its own counter; budget is per-instance.
 */
let activeListenerCount = 0;

export function getActiveListenerCount(): number {
  return activeListenerCount;
}

/**
 * True when we're at or above the configured cap. SSE endpoint should
 * 503 in this case so the client falls back to polling.
 */
export function listenerBudgetExhausted(): boolean {
  return activeListenerCount >= MAX_SSE_LISTENERS;
}

export interface OpenListenClientOptions {
  jobId: string;
  /** Fired whenever Postgres delivers a notification on the channel. */
  onNotify: () => void;
  /**
   * Fired on connection error AFTER the initial connect has succeeded
   * (so the SSE route can close the stream cleanly). Initial connect
   * errors throw from `openJobListenClient` itself.
   */
  onError?: (err: Error) => void;
}

export interface OpenListenClientHandle {
  /** Release the pg connection. Idempotent; calling twice is a no-op. */
  close: () => Promise<void>;
}

/**
 * Open a dedicated pg.Client and start LISTENing on the channel for `jobId`.
 *
 * Throws if:
 *   - We're at the connection budget (`listenerBudgetExhausted()`)
 *   - The pg connect fails
 *   - The initial LISTEN query fails
 *
 * On success, returns a handle whose `close()` runs UNLISTEN + end().
 */
export async function openJobListenClient(
  options: OpenListenClientOptions,
): Promise<OpenListenClientHandle> {
  if (listenerBudgetExhausted()) {
    throw new Error(
      `LISTEN budget exhausted (${activeListenerCount}/${MAX_SSE_LISTENERS}); client should fall back to polling`,
    );
  }

  const channel = jobChannelName(options.jobId);
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set; cannot open LISTEN client');
  }

  // Increment optimistically BEFORE we await — `await client.connect()`
  // yields the event loop, so N concurrent calls could otherwise all
  // pass the budget check before any of them increment. Reserve the
  // slot now; decrement in the catch block if anything fails.
  activeListenerCount += 1;
  const client = new Client({ connectionString });

  try {
    await client.connect();

    // pg client emits `notification` events for every NOTIFY received on
    // any channel the client is currently LISTENing on. Filter by channel
    // name as defense-in-depth (a single client only LISTENs on one channel
    // here, but better to be explicit).
    client.on('notification', (msg) => {
      if (msg.channel === channel) {
        options.onNotify();
      }
    });

    client.on('error', (err) => {
      if (options.onError) options.onError(err);
    });

    // Channel name is double-quoted because pg treats colons as special
    // tokens otherwise. Built from a UUID-validated jobId — no injection.
    await client.query(`LISTEN "${channel}"`);
  } catch (openErr) {
    // Connect or LISTEN failed — release the reserved slot and bubble.
    activeListenerCount = Math.max(0, activeListenerCount - 1);
    try { await client.end(); } catch { /* noop */ }
    throw openErr;
  }

  let closed = false;
  return {
    close: async () => {
      if (closed) return;
      closed = true;
      activeListenerCount = Math.max(0, activeListenerCount - 1);
      try { await client.query(`UNLISTEN "${channel}"`); } catch { /* noop */ }
      try { await client.end(); } catch { /* noop */ }
    },
  };
}

/**
 * Test-only reset. Production code never calls this. Exposed so tests can
 * normalize the module-level counter between cases without re-loading the
 * module.
 */
export function _resetListenerCountForTesting(): void {
  activeListenerCount = 0;
}
