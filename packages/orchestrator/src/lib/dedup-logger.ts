/**
 * Deduped warning helper for high-frequency, repetitive log lines.
 *
 * The orchestrator emits the same warning many times per second when an
 * upstream provider is degraded — e.g. whisper.cpp missing in prod produced
 * thousands of identical "Local whisper binary not found" lines, and Groq
 * rate-limit fallbacks produced one log + one Sentry breadcrumb per scene
 * line. Useful in stdout for the first hit, then mostly noise.
 *
 * This helper:
 *   1. Always logs `log.debug` so the full firehose is available when
 *      LOG_LEVEL=debug is on.
 *   2. Emits a `log.warn` + Sentry breadcrumb only when the same category
 *      hasn't fired in the last `windowMs` (default 60s).
 *   3. Tracks suppressed count so the periodic warn can say "+N suppressed".
 *
 * Usage:
 *   import { dedupedWarn } from '../../lib/dedup-logger.js';
 *   dedupedWarn('whisper-missing-binary', 'falling back to Groq Whisper', {
 *     error: errMsg,
 *   });
 */

import { Sentry } from './sentry.js';
import { log } from './logger.js';

interface DedupEntry { lastEmit: number; suppressed: number }
const dedupState = new Map<string, DedupEntry>();

const DEFAULT_WINDOW_MS = 60_000;

export function dedupedWarn(
  category: string,
  message: string,
  data: Record<string, unknown> = {},
  windowMs: number = DEFAULT_WINDOW_MS,
): void {
  // The firehose is preserved at debug level so an operator who needs
  // every hit can crank LOG_LEVEL and see them.
  log.debug(message, { category, ...data });

  const now = Date.now();
  const entry = dedupState.get(category) ?? { lastEmit: 0, suppressed: 0 };

  if (now - entry.lastEmit < windowMs) {
    entry.suppressed += 1;
    dedupState.set(category, entry);
    return;
  }

  const suppressed = entry.suppressed;
  entry.lastEmit = now;
  entry.suppressed = 0;
  dedupState.set(category, entry);

  const suffix = suppressed > 0 ? ` (+${suppressed} suppressed in last ${Math.round(windowMs / 1000)}s)` : '';
  log.warn(`${message}${suffix}`, { category, ...data });

  Sentry.addBreadcrumb({
    category: `dedup.${category}`,
    level: 'warning',
    message,
    data: { ...data, suppressed },
  });
}
