/**
 * H4 — Defensive prisma writes
 *
 * `safeUpdate` and `safeCreate` wrap prisma operations so that the two
 * race conditions we keep hitting in production:
 *
 *   1. Job worker writes a job_log AFTER the project (and its cascading
 *      job rows) has been deleted — produces a P2003 foreign-key violation
 *      that the worker can't meaningfully handle anyway.
 *
 *   2. Job worker tries to update a job row that's been cascade-deleted
 *      while the worker was processing — produces a P2025 "record not
 *      found" error.
 *
 * …no longer surface as PrismaClientKnownRequestError thrown out of the
 * worker (which then trips the orchestrator's retry path and pollutes
 * Sentry). Instead they return `null` / `false` quietly with a structured
 * warn log so we can track them as "the row was gone by the time we wrote"
 * — a benign race, not an error.
 *
 * Adapted from the symptom Chris hit 2026-06-13: a job log + job.update
 * fired AFTER our e2e teardown cleanup deleted the project mid-flight.
 * The errors were correct ("the foreign key isn't there") but the
 * appropriate handling is to swallow them.
 *
 * Use these for ANY write whose target row could legitimately have been
 * cascade-deleted between the read-or-decide step and the write step.
 *
 *   await safeUpdate(prisma.job, { where: { id }, data: { status } });
 *   await safeCreate(prisma.jobLog, { data: { jobId, kind, message } });
 *
 * Do NOT use these as a blanket replacement — they're correct only when
 * a missing row IS a benign outcome. For "the user typed a bad ID" cases
 * you still want the throw so the API returns 404.
 */

import { Prisma } from '@story-magic/shared';
import { log } from '@/lib/logger';

// Prisma client model delegate has these methods — we narrow to what we use.
interface UpdateModel<T, A> {
  update: (args: A) => Promise<T>;
}

interface CreateModel<T, A> {
  create: (args: A) => Promise<T>;
}

/**
 * Update a row, returning `null` instead of throwing if the row was
 * already deleted (P2025) or its required FK target was deleted (P2003).
 *
 * Any other Prisma error still propagates — those are real bugs.
 */
export async function safeUpdate<T, A>(
  model: UpdateModel<T, A>,
  args: A,
  context?: Record<string, unknown>,
): Promise<T | null> {
  try {
    return await model.update(args);
  } catch (err) {
    if (isBenignRaceError(err)) {
      log.warn('[safeUpdate] target row missing (cascade race); skipping update', {
        code: (err as { code?: string }).code,
        meta: (err as { meta?: unknown }).meta,
        ...context,
      });
      return null;
    }
    throw err;
  }
}

/**
 * Create a row, returning `null` instead of throwing if the row's
 * required FK target has been deleted (P2003). Useful for log/audit
 * tables that may try to write after their parent was cleaned up.
 */
export async function safeCreate<T, A>(
  model: CreateModel<T, A>,
  args: A,
  context?: Record<string, unknown>,
): Promise<T | null> {
  try {
    return await model.create(args);
  } catch (err) {
    if (isBenignRaceError(err)) {
      log.warn('[safeCreate] FK target missing (cascade race); skipping create', {
        code: (err as { code?: string }).code,
        meta: (err as { meta?: unknown }).meta,
        ...context,
      });
      return null;
    }
    throw err;
  }
}

/**
 * True for the two Prisma error codes that indicate a cascade race.
 * Exported so callers can use it directly if they need bespoke handling.
 */
export function isBenignRaceError(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  // P2025: An operation failed because it depends on one or more records that
  //        were required but not found. — row deleted between read + write.
  // P2003: Foreign key constraint failed on the field — parent was deleted.
  return err.code === 'P2025' || err.code === 'P2003';
}
