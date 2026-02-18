/**
 * Orchestrator Fetch Utility
 *
 * Wraps fetch calls to the orchestrator service with:
 * - Configurable timeouts (default 30s for generation, 10s for health)
 * - Retry logic with exponential backoff for transient failures
 * - Automatic service key injection
 */

import { log } from '@/lib/logger';

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
    retries = 2,
    retryBaseDelayMs = 1_000,
    headers = {},
  } = options;

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

      const response = await fetch(url, {
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
        const delay = retryBaseDelayMs * Math.pow(2, attempt - 1);
        log.warn(`[orchestratorFetch] Retryable HTTP ${response.status} from ${path}, retrying in ${delay}ms`, {
          attempt,
          maxAttempts,
          status: response.status,
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

/**
 * POST to orchestrator for long-running generation tasks (5 min timeout, 1 retry).
 */
export async function orchestratorGenerate(
  path: string,
  body: unknown
): Promise<Response> {
  const { response } = await orchestratorFetch(path, {
    method: 'POST',
    body,
    timeoutMs: 300_000, // 5 minutes for generation
    retries: 1,
    retryBaseDelayMs: 2_000,
  });
  return response;
}
