/**
 * Orchestrator Fetch Utility
 *
 * Wraps fetch calls to the orchestrator service with:
 * - Configurable timeouts (default 30s for generation, 10s for health)
 * - Retry logic with exponential backoff for transient failures
 * - Automatic service key injection
 */

import { Agent, fetch as undiciFetch } from 'undici';
import { log } from '@/lib/logger';

// Node.js (undici) has a 300 s internal headersTimeout that fires independently
// of any AbortController. For generation calls (20-min AbortController), undici's
// 300 s deadline fires first, producing "Headers Timeout Error". We bypass this by
// using undici's fetch directly with an agent whose timeouts exceed the AbortController.
// Using undiciFetch also skips Next.js's cache layer — correct for dynamic calls.
const ORCHESTRATOR_AGENT = new Agent({
  headersTimeout: 1_500_000, // 25 min — safely above the 20-min AbortController
  bodyTimeout: 1_500_000,
  keepAliveTimeout: 60_000,
  connections: 4,
});

function describeCause(error: unknown): string | undefined {
  if (!(error instanceof Error) || error.cause === undefined) return undefined;
  const cause = error.cause;
  if (cause instanceof AggregateError) {
    return cause.errors.map((e: unknown) => (e instanceof Error ? e.message : String(e))).join('; ');
  }
  if (cause instanceof Error) return cause.message;
  try { return JSON.stringify(cause); } catch { return String(cause); }
}

// =============================================================================
// Types
// =============================================================================

interface OrchestratorFetchOptions {
  /** HTTP method (default: GET) */
  method?: string;
  /** Request body (will be JSON-serialized) */
  body?: unknown;
  /** Timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
  /** Number of retries for transient failures (default: 2) */
  retries?: number;
  /** Base delay in ms for exponential backoff (default: 1000) */
  retryBaseDelayMs?: number;
  /** Additional headers */
  headers?: Record<string, string>;
}

interface OrchestratorFetchResult {
  response: Response;
  /** Number of attempts made (1 = no retries needed) */
  attempts: number;
}

// HTTP status codes that are safe to retry
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

// =============================================================================
// Helpers
// =============================================================================

function getOrchestratorUrl(): string {
  return process.env.ORCHESTRATOR_URL || 'http://localhost:22002';
}

function getServiceHeaders(): Record<string, string> {
  const serviceKey = process.env.SERVICE_SECRET_KEY;
  return serviceKey ? { 'X-Service-Key': serviceKey } : {};
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse a `Retry-After` header into milliseconds. RFC 7231 allows two forms:
 *   - delta-seconds:   `Retry-After: 60`
 *   - HTTP-date:       `Retry-After: Wed, 21 Oct 2026 07:28:00 GMT`
 * We don't expect the date form from our orchestrator (it returns seconds via
 * express-rate-limit), but we handle both so a misbehaving upstream can't
 * silently fall through to the default backoff. Returns null when missing or
 * unparseable.
 */
function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  // Numeric (seconds) form.
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10) * 1000;
  }
  // HTTP-date form.
  const ts = Date.parse(trimmed);
  if (!Number.isNaN(ts)) {
    return Math.max(0, ts - Date.now());
  }
  return null;
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof TypeError) {
    // Network errors (DNS, connection refused, etc.)
    return true;
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    // Timeout — retryable
    return true;
  }
  return false;
}

// =============================================================================
// Main Utility
// =============================================================================

/**
 * Fetch from the orchestrator service with timeout and retry support.
 *
 * @param path - URL path relative to the orchestrator base URL (e.g., "/health", "/orchestrate")
 * @param options - Fetch options including timeout and retry configuration
 * @returns The fetch Response object
 * @throws Error if all attempts fail
 */
export async function orchestratorFetch(
  path: string,
  options: OrchestratorFetchOptions = {}
): Promise<OrchestratorFetchResult> {
  const {
    method = 'GET',
    body,
    timeoutMs = 30_000,
    // 2026-06-25: 2 retries with 1s/2s backoff couldn't outlast a 60-second
    // Retry-After from the orchestrator's strict rate limit (job 3a9db72b
    // chunks 6+7 both 429'd). Bumped to 4 retries; the Retry-After parser
    // below also short-circuits exponential backoff when the server has
    // already named a wait time.
    retries = 4,
    retryBaseDelayMs = 1_000,
    headers = {},
  } = options;

  // Cap on how long we'll honor a single Retry-After header. Beyond this
  // it's faster to surface the failure to the caller than to block. Matches
  // the typical orchestrator strict-limit window (60s) with headroom.
  const RETRY_AFTER_CAP_MS = 90_000;

  const baseUrl = getOrchestratorUrl();
  const url = `${baseUrl}${path}`;

  const fetchHeaders: Record<string, string> = {
    ...getServiceHeaders(),
    ...headers,
  };

  if (body !== undefined) {
    fetchHeaders['Content-Type'] = 'application/json';
  }

  const maxAttempts = 1 + retries;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // Use the custom undici agent (with extended headersTimeout/bodyTimeout)
      // only for long-running calls where the 20-min AbortController must be the
      // effective deadline. Short calls (health checks, 30s posts) use globalThis.fetch
      // so test mocks on globalThis.fetch continue to work without changes.
      const needsLongAgent = timeoutMs > 300_000;
      const response = needsLongAgent
        ? (await undiciFetch(url, {
            method,
            headers: fetchHeaders,
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: controller.signal,
            dispatcher: ORCHESTRATOR_AGENT,
          }) as unknown as Response)
        : await fetch(url, {
            method,
            headers: fetchHeaders,
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: controller.signal,
          });

      clearTimeout(timeoutId);

      // If response is OK or non-retryable status, return immediately
      if (response.ok || !RETRYABLE_STATUS_CODES.has(response.status)) {
        return { response, attempts: attempt };
      }

      // Retryable HTTP status
      lastError = new Error(`Orchestrator returned HTTP ${response.status}`);

      if (attempt < maxAttempts) {
        // Honor the server's Retry-After header when present (orchestrator's
        // rate-limit middleware sets it). Falls back to exponential backoff
        // otherwise. The cap keeps a misconfigured upstream from parking
        // a request for hours.
        const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
        const expoDelay = retryBaseDelayMs * Math.pow(2, attempt - 1);
        const delay = retryAfterMs !== null
          ? Math.min(Math.max(retryAfterMs, expoDelay), RETRY_AFTER_CAP_MS)
          : expoDelay;
        log.warn(`[orchestratorFetch] Retryable HTTP ${response.status} from ${path}, retrying in ${delay}ms`, {
          attempt,
          maxAttempts,
          status: response.status,
          retryAfterFromServer: retryAfterMs,
        });
        await sleep(delay);
        continue;
      }

      // Final attempt — return the error response as-is so caller can handle it
      return { response, attempts: attempt };
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts && isRetryableError(error)) {
        const delay = retryBaseDelayMs * Math.pow(2, attempt - 1);
        const errorMsg = error instanceof Error ? error.message : String(error);
        log.warn(`[orchestratorFetch] Transient error on ${path}, retrying in ${delay}ms`, {
          attempt,
          maxAttempts,
          error: errorMsg,
        });
        await sleep(delay);
        continue;
      }

      // Non-retryable or final attempt
      const errorMsg = error instanceof Error ? error.message : String(error);
      const causeMsg = describeCause(error);
      log.error(`[orchestratorFetch] Failed to reach ${path}`, {
        attempt,
        error: errorMsg,
        ...(causeMsg ? { cause: causeMsg } : {}),
      });
      throw error;
    }
  }

  // Should not reach here, but just in case
  throw lastError;
}

// =============================================================================
// Convenience Methods
// =============================================================================

/**
 * POST JSON to the orchestrator with generation-appropriate timeout (30s).
 */
export async function orchestratorPost(
  path: string,
  body: unknown,
  options: Omit<OrchestratorFetchOptions, 'method' | 'body'> = {}
): Promise<Response> {
  const { response } = await orchestratorFetch(path, {
    method: 'POST',
    body,
    timeoutMs: 30_000,
    ...options,
  });
  return response;
}

/**
 * Fetch from the orchestrator with a short timeout for health/status checks (10s).
 */
export async function orchestratorHealthCheck(
  path: string = '/health'
): Promise<Response> {
  const { response } = await orchestratorFetch(path, {
    method: 'GET',
    timeoutMs: 10_000,
    retries: 1,
  });
  return response;
}

// =============================================================================
// Deploy-window mitigation
// =============================================================================

/**
 * Thrown when the orchestrator was unreachable during a transient network
 * outage (Render deploy rollout, brief 5xx storm, DNS hiccup). Distinct from
 * a "real" generation failure (script validation, quota, etc.) so callers
 * can apply longer backoff instead of burning the user's retry budget.
 */
export class OrchestratorUnreachableError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'OrchestratorUnreachableError';
  }
}

/**
 * True when an error or HTTP status looks like a transient orchestrator
 * unavailability (Render rolling deploy, brief 5xx, network blip) rather
 * than a real failure that won't resolve by waiting.
 *
 * - 502/503/504 — Render load balancer is between containers, retry helps
 * - 408 / network errors / aborts — fetch never got an answer
 */
export function isTransientOrchestratorError(err: unknown): boolean {
  if (err instanceof OrchestratorUnreachableError) return true;
  if (err instanceof TypeError) return true; // network-level (DNS, ECONNREFUSED, ECONNRESET)
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('http 502') || msg.includes('http 503') || msg.includes('http 504') || msg.includes('http 408')) return true;
    if (msg.includes('fetch failed') || msg.includes('econnrefused') || msg.includes('enotfound')) return true;
    // #320 (2026-06-17): upstream TTS provider 5xx / 429 is transient —
    // Ryan's incident was sustained ElevenLabs 500s that exhausted the
    // orchestrator's per-call retry budget (now 5 attempts × ~60s window).
    // When that still fails, let the queue worker retry the whole job
    // after a longer backoff rather than terminally failing the run.
    if (msg.includes('elevenlabs tts failed 5')) return true;
    if (msg.includes('elevenlabs tts failed 429')) return true;
  }
  return false;
}

/**
 * Wait up to `maxWaitMs` for the orchestrator to respond healthy on `/health`.
 * Polls every `pollIntervalMs` until either:
 *   - a successful 2xx response → resolves
 *   - the timeout elapses without success → throws OrchestratorUnreachableError
 *
 * Use this at the *start* of long-running jobs to avoid wasting a director
 * pass when the orchestrator is mid-deploy. ~60s of polling covers Render's
 * worst-case rolling-deploy window (build + boot + first health check, which
 * can be 45-55s on a cold orchestrator start with the whisper-model setup).
 *
 * Was 30s before A-001 (2026-06-15) — Ryan was hitting this on every test
 * that happened to overlap a deploy. The bump to 60s eliminates that race
 * for the typical case while keeping the failure mode obvious when the
 * orchestrator is truly dead (we'll still error within a minute, not 5).
 *
 * 2026-06-20: bumped default to 90s. Ryan's 6/19 7:15 PM trace still hit
 * "did not become ready within 60000ms (probed 15x)" on a cold-boot deploy
 * — whisper.cpp model load adds ~30s to the warm-start window on a fresh
 * container, taking us past 60s on the unlucky path. 90s covers the worst
 * case while still failing fast if the orchestrator is genuinely down.
 *
 * Cheap: each poll is a 10s-timeout HEAD/GET that returns 200 in <100ms on
 * a healthy service. If we're already healthy, this returns in ~50ms.
 */
export async function waitForOrchestratorReady(
  maxWaitMs: number = 90_000,
  pollIntervalMs: number = 3_000,
): Promise<void> {
  const start = Date.now();
  let lastError: unknown;
  let probeCount = 0;

  while (Date.now() - start < maxWaitMs) {
    probeCount++;
    try {
      const response = await orchestratorHealthCheck('/health');
      if (response.ok) {
        if (probeCount > 1) {
          log.info('[waitForOrchestratorReady] orchestrator ready', {
            probeCount,
            waitedMs: Date.now() - start,
          });
        }
        return;
      }
      // Got a response but not OK — record + keep polling
      lastError = new Error(`orchestrator /health returned HTTP ${response.status}`);
    } catch (err) {
      lastError = err;
    }

    // Don't sleep past the deadline
    const remaining = maxWaitMs - (Date.now() - start);
    if (remaining <= 0) break;
    await sleep(Math.min(pollIntervalMs, remaining));
  }

  throw new OrchestratorUnreachableError(
    `orchestrator did not become ready within ${maxWaitMs}ms (probed ${probeCount}x)`,
    lastError,
  );
}

/**
 * POST to orchestrator for long-running generation tasks (20 min timeout, 1 retry).
 * 20 minutes accommodates 100-page scripts: TTS + assembly + concatenation.
 *
 * The orchestrator streams SSE progress events to keep Render's 300 s proxy
 * timeout at bay. We buffer the full stream, extract the last `data:` event
 * (which carries the JSON result or error), and return a synthetic Response
 * so callers see the same interface as before.
 */
export async function orchestratorGenerate(
  path: string,
  body: unknown
): Promise<Response> {
  const { response } = await orchestratorFetch(path, {
    method: 'POST',
    body,
    timeoutMs: 1_200_000, // 20 minutes for generation
    retries: 1,
    retryBaseDelayMs: 2_000,
  });

  const ct = response.headers.get('content-type') ?? '';
  if (!ct.includes('text/event-stream')) {
    // Fast error paths (400/403/404/422/503) return plain JSON — pass through.
    return response;
  }

  // Consume SSE stream. Progress events are discarded; the last `data:` event
  // is the result (type: 'result') sent by the orchestrator after the pipeline.
  const text = await response.text();
  const lastData = text
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .at(-1)
    ?.slice(6)
    .trim();

  if (!lastData) {
    throw new Error('SSE stream from orchestrator ended without a result event');
  }

  const parsed: Record<string, unknown> = JSON.parse(lastData);
  const status = parsed['status'] === 'error' ? 500 : 200;

  return new Response(JSON.stringify(parsed), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
