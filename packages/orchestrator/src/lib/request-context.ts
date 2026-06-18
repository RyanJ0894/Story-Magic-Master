/**
 * Per-request context via AsyncLocalStorage.
 *
 * 2026-06-17 (Peter): "Being able to associate requests with failures in the
 * logs would have helped debug this issue. If we are generating a request id
 * with the call to ElevenLabs then that should be logged with the request
 * data and any error response."
 *
 * Design:
 *   - At /orchestrate (and /generate-scenes) entry, generate a requestId and
 *     store it in AsyncLocalStorage along with project_id.
 *   - The pino logger's `mixin` function pulls from the context for every log
 *     line in that async chain — zero per-call-site overhead, no plumbing.
 *   - Outbound ElevenLabs requests forward the same requestId as `X-Request-ID`
 *     so a future ElevenLabs support ticket can be cross-referenced.
 *
 * Format: `sm_<base36 epoch-ms>_<6 random hex>` — short enough to copy by hand
 * (~22 chars), prefixed with `sm_` so it's instantly identifiable as ours when
 * grep'd. Sortable by time within a window. Not cryptographic — collision is
 * irrelevant at our request rate.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';

export interface RequestContext {
  /** Short request ID, e.g. "sm_lr2k9d_3a8f1c" — log-grep target. */
  requestId: string;
  /** Project being processed, if known. */
  projectId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function generateRequestId(): string {
  const time = Date.now().toString(36);
  const rand = randomBytes(3).toString('hex');
  return `sm_${time}_${rand}`;
}

/**
 * Run `fn` with the given context bound to AsyncLocalStorage. Every log line
 * the pino logger emits inside `fn` (including async children) automatically
 * picks up the requestId / projectId via the logger's mixin.
 */
export function runWithRequestContext<T>(ctx: RequestContext, fn: () => Promise<T> | T): Promise<T> | T {
  return storage.run(ctx, fn);
}

/**
 * Return the current request context if running inside `runWithRequestContext`,
 * otherwise undefined. The logger's mixin uses this; downstream code (like the
 * ElevenLabs TTS call) can also read it to forward the requestId as a header.
 */
export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}
