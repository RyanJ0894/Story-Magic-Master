/**
 * ElevenLabs error-body classifier (#378).
 *
 * Today we log the raw response body for every non-2xx response from
 * ElevenLabs, but it's an opaque blob — Sentry / Logs queries can't tell
 * a `system_busy` (their infra) from a `too_many_concurrent_requests`
 * (our architecture) from a `rate_limit_exceeded` (minute-window cap).
 * Each implies a different operator action; lumping them together as
 * "429" prevents us from tuning correctly.
 *
 * The grant-tier context that motivated this — June 2026 emails:
 *
 *  - ElevenLabs platform incidents (May 25, Jun 1–2, Jun 9–10) elevated
 *    `system_busy` rates; pure ride-it-out.
 *  - Grant accounts inherit Starter/Creator concurrency caps (2–3 parallel);
 *    we will see `too_many_concurrent_requests` if `TTS_CONCURRENCY > 2`
 *    while we are on the grant.
 *
 * This module parses the response body into one of seven discrete kinds
 * so the retry layer + Sentry tags can act on the distinction.
 */

import { log } from './logger.js';

export type ElevenLabsErrorKind =
  /** Their infra overloaded — 429 with `system_busy`. Pure exponential retry. */
  | 'system_busy'
  /** We have too many in-flight requests — 429. Lower TTS_CONCURRENCY. */
  | 'too_many_concurrent_requests'
  /** Minute-window total cap — 429. Honor Retry-After + lower request rate. */
  | 'rate_limit_exceeded'
  /** Account quota / billing — typically 402, but ElevenLabs sometimes uses 429. */
  | 'quota_exceeded'
  /** voice_id not found — 404. Do not retry; fall back. */
  | 'voice_not_found'
  /** Upstream 5xx without a recognizable body. Retry. */
  | 'upstream_5xx'
  /** Anything else — log the body verbatim, fall back to status-only handling. */
  | 'unknown';

export interface ClassifiedElevenLabsError {
  kind: ElevenLabsErrorKind;
  /** Raw status code from the HTTP response (e.g. 429, 500, 404). */
  status: number;
  /**
   * Whether the operator should reduce concurrency. True for the
   * `too_many_concurrent_requests` branch only — everything else is
   * either upstream or a one-off and concurrency tuning won't help.
   */
  shouldLowerConcurrency: boolean;
  /**
   * The raw `detail.status` / `detail.message` token we matched on, when
   * present, so log queries can pivot on the exact ElevenLabs string.
   */
  matchedToken?: string;
}

/**
 * ElevenLabs returns errors in two shapes we've seen in the wild:
 *
 *   1. Structured:  { "detail": { "status": "system_busy", "message": "..." } }
 *   2. String:      { "detail": "Voice not found" }   (legacy 404 path)
 *
 * We accept both; cheaper to be permissive than to drop a useful signal.
 * Falls through to `'unknown'` (with the body logged at warn level) if
 * the response is HTML (Render 502 page) or otherwise unparseable.
 */
export function classifyElevenLabsError(
  status: number,
  rawBody: string,
): ClassifiedElevenLabsError {
  // Voice-not-found: stable 404 with `voice_not_found` in the body. We
  // check this FIRST because some malformed bodies otherwise fall to
  // 'unknown' even though the status alone tells us enough.
  if (status === 404 && rawBody.includes('voice_not_found')) {
    return { kind: 'voice_not_found', status, shouldLowerConcurrency: false, matchedToken: 'voice_not_found' };
  }

  // 402 / quota — ElevenLabs uses both 402 and 429 for billing depending
  // on tier. We treat any body containing `quota_exceeded` or
  // `insufficient_quota` as quota regardless of status.
  if (
    status === 402 ||
    rawBody.includes('quota_exceeded') ||
    rawBody.includes('insufficient_quota')
  ) {
    return { kind: 'quota_exceeded', status, shouldLowerConcurrency: false, matchedToken: 'quota_exceeded' };
  }

  // Try to parse JSON body for the structured form. If it isn't JSON
  // (Render's HTML 524/502 pages, CDN errors, etc.) we fall through.
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    // not JSON — leave parsed null
  }

  const detail = (parsed && typeof parsed === 'object' && (parsed as { detail?: unknown }).detail) || null;

  // Structured `detail.status` form
  if (detail && typeof detail === 'object') {
    const detailStatus = (detail as { status?: unknown }).status;
    if (typeof detailStatus === 'string') {
      const token = detailStatus.toLowerCase();
      if (token === 'system_busy') {
        return { kind: 'system_busy', status, shouldLowerConcurrency: false, matchedToken: token };
      }
      if (token === 'too_many_concurrent_requests') {
        return { kind: 'too_many_concurrent_requests', status, shouldLowerConcurrency: true, matchedToken: token };
      }
      if (token === 'too_many_requests' || token === 'rate_limit_exceeded') {
        return { kind: 'rate_limit_exceeded', status, shouldLowerConcurrency: false, matchedToken: token };
      }
    }
  }

  // Plain-string detail form (legacy)
  if (typeof detail === 'string') {
    const lower = detail.toLowerCase();
    if (lower.includes('voice') && lower.includes('not found')) {
      return { kind: 'voice_not_found', status, shouldLowerConcurrency: false, matchedToken: 'detail-string-voice-not-found' };
    }
  }

  // 5xx without a parseable structured body. Retryable upstream issue.
  if (status >= 500 && status < 600) {
    return { kind: 'upstream_5xx', status, shouldLowerConcurrency: false };
  }

  // Anything else — log the raw body so we can teach the classifier later.
  if (status === 429 || status >= 500) {
    log.warn('[elevenlabs-error] unrecognized error shape', { status, bodyPreview: rawBody.slice(0, 300) });
  }
  return { kind: 'unknown', status, shouldLowerConcurrency: false };
}

/**
 * Parse the `Retry-After` header per RFC 7231 §7.1.3:
 *   - Decimal seconds:  "Retry-After: 30"
 *   - HTTP-date:        "Retry-After: Wed, 22 Jun 2026 08:00:00 GMT"
 *
 * Returns the wait in milliseconds, capped at `maxCapMs` to prevent
 * a misbehaving server from pinning us for hours. Returns null when
 * the header is absent / malformed / negative.
 *
 * The cap matters: a 30s cap matches `withRetry`'s `maxDelayMs` so the
 * retry layer can substitute this value cleanly without changing its
 * own ceiling logic.
 */
export function parseRetryAfter(header: string | null, maxCapMs = 30_000): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed) return null;

  // Decimal-seconds form (non-negative per RFC 7231 §7.1.3).
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const secs = parseFloat(trimmed);
    if (!Number.isFinite(secs) || secs < 0) return null;
    return Math.min(secs * 1000, maxCapMs);
  }
  // A signed number is malformed per spec — reject before Date.parse,
  // which in Node 22 will happily interpret "-5" as year −5 and return
  // a valid epoch (far in the past). Without this guard the test
  // `'-5' → null` flaps depending on the platform's Date implementation.
  if (/^[+-]\d/.test(trimmed)) return null;

  // HTTP-date form. `Date.parse` handles RFC-7231 IMF-fixdate +
  // obsolete formats (RFC-850, asctime). Returns NaN on failure.
  const targetMs = Date.parse(trimmed);
  if (Number.isNaN(targetMs)) return null;
  // Compare against an injected `now` would be cleaner for tests, but
  // we want to keep the public signature simple — tests stub Date.now.
  const deltaMs = targetMs - Date.now();
  if (deltaMs <= 0) return 0;
  return Math.min(deltaMs, maxCapMs);
}
