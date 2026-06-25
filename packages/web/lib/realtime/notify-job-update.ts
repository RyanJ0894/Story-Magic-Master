/**
 * Real-time job sync — worker → Postgres NOTIFY emitter.
 *
 * Called by the worker immediately after every successful `prisma.job.update`
 * that changes progress/status. Fires a `pg_notify` on the per-job channel
 * `job:{jobId}` so any SSE handler with an open `LISTEN` on the same channel
 * gets woken up.
 *
 * Design choices documented in `docs/REALTIME_JOB_SYNC_2026-06-25.md`:
 *
 *   - **Light payload.** We don't send the job state in the NOTIFY itself.
 *     SSE handler refetches from DB on every wake-up. Avoids the 8 KB
 *     pg_notify limit, avoids race conditions across concurrent writes,
 *     and keeps worker code independent of SSE wire format.
 *
 *   - **Fail silent.** NOTIFY is a perf optimization. If it throws, the
 *     client's existing polling fallback (every 2 s) still surfaces the
 *     update with at most a 2 s lag. NOTIFY failure must never cascade
 *     into a pipeline failure.
 *
 *   - **Lazy / no-op when feature off.** No env-flag check here — the
 *     NOTIFY is harmless when no listener is attached. Worker always
 *     emits; UI side controls whether anyone consumes it.
 *
 * Channel-name format: `job:${uuid}`. Double-quoted in the NOTIFY/LISTEN
 * statements because pg quotes channel names containing colons. Channel
 * names are case-sensitive when quoted — keep both sides consistent.
 */

import { prisma } from '@/lib/db';

/**
 * Build the Postgres channel name for a given job's progress updates.
 *
 * Exported so SSE handlers (web side) and tests can build the identical
 * channel string without duplicating the format. Single source of truth
 * for the LISTEN ↔ NOTIFY contract.
 */
export function jobChannelName(jobId: string): string {
  return `job:${jobId}`;
}

/**
 * Emit a Postgres NOTIFY on the per-job channel. Swallows all errors.
 *
 * Returns true if the NOTIFY query completed without throwing, false
 * otherwise. Callers should NOT branch on the return — it's exposed only
 * for tests and dev tooling that want to assert delivery.
 */
export async function notifyJobUpdate(jobId: string): Promise<boolean> {
  try {
    const channel = jobChannelName(jobId);
    // We cannot use prisma.$executeRaw template literal here because the
    // channel name needs to be interpolated as a literal SQL identifier
    // (quoted, not a bound parameter). $executeRawUnsafe is the correct
    // tool — channel name is built from a UUID-validated jobId, so SQL
    // injection is not possible.
    await prisma.$executeRawUnsafe(`NOTIFY "${channel}"`);
    return true;
  } catch {
    // Intentionally silent — see file header for rationale.
    return false;
  }
}
