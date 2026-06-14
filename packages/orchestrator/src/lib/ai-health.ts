/**
 * AI Health — pre-flight key validation + failure logging
 *
 * Probes each configured AI provider with a zero-cost HTTP check before
 * committing to a long-running batch job.  No tokens are consumed: we hit
 * the provider's model-list or user endpoint, which validates the key and
 * returns HTTP 200 if the account is in good standing.
 *
 * Results are written to `ai_health_log` and emitted as Sentry breadcrumbs
 * so failures appear in the next exception's context.
 */

import { log } from './logger.js';
import { captureError, Sentry } from './sentry.js';
import { prisma } from './prisma.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type FailureCode =
  | 'INVALID_KEY'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'UNREACHABLE'
  | 'UNKNOWN';

export type ProviderStatus = 'healthy' | 'degraded' | 'down';

export interface ProviderHealthResult {
  provider: string;
  status: ProviderStatus;
  latencyMs: number;
  errorCode?: FailureCode;
  errorMessage?: string;
}

export interface PreflightResult {
  canProceed: boolean;
  results: ProviderHealthResult[];
  blockedBy: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const PROBE_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Probe timed out after ${ms}ms`)), ms),
    ),
  ]);
}

function classifyError(err: unknown): FailureCode {
  if (!(err instanceof Error)) return 'UNKNOWN';
  const msg = err.message.toLowerCase();
  const s = (err as { statusCode?: number; status?: number }).statusCode
    ?? (err as { statusCode?: number; status?: number }).status;

  // Order matters: classify transient network failures FIRST so a 401 inside
  // a "fetch failed" wrapper doesn't get tagged INVALID_KEY. The 2026-06-13
  // incident (206 false-positive INVALID_KEY events) was caused by the
  // previous fall-through: bare `msg.includes('authentication')` matched
  // TLS-handshake errors during boot/shutdown.
  if (
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('enotfound') ||
    msg.includes('socket hang up') ||
    msg.includes('fetch failed') ||
    msg.includes('network')
  )
    return 'UNREACHABLE';
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) return 'TIMEOUT';
  if (s === 429 || msg.includes('rate limit') || msg.includes('too many')) return 'RATE_LIMITED';
  if (s === 402 || msg.includes('credit') || msg.includes('quota') || msg.includes('billing')) return 'QUOTA_EXCEEDED';
  // Only treat as a real auth failure when the HTTP layer says 401/403 OR the
  // message specifically calls out the API key. The previous broader
  // `msg.includes('authentication')` clause was the false-positive source.
  if (s === 401 || s === 403 || (msg.includes('invalid') && msg.includes('key')) || msg.includes('api key')) return 'INVALID_KEY';
  return 'UNKNOWN';
}

// ---------------------------------------------------------------------------
// Provider probes  (zero token cost — model-list / account endpoints)
// ---------------------------------------------------------------------------

async function probeLLM(
  provider: 'anthropic' | 'openai',
): Promise<ProviderHealthResult> {
  const apiKey =
    provider === 'anthropic'
      ? process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      provider,
      status: 'down',
      latencyMs: 0,
      errorCode: 'INVALID_KEY',
      errorMessage: `${provider.toUpperCase()}_API_KEY not configured`,
    };
  }

  const url =
    provider === 'anthropic'
      ? 'https://api.anthropic.com/v1/models'
      : 'https://api.openai.com/v1/models';

  const headers: Record<string, string> =
    provider === 'anthropic'
      ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
      : { Authorization: `Bearer ${apiKey}` };

  const start = Date.now();
  try {
    const res = await withTimeout(fetch(url, { headers }), PROBE_TIMEOUT_MS);
    const latencyMs = Date.now() - start;

    if (res.status === 401 || res.status === 403)
      return { provider, status: 'down', latencyMs, errorCode: 'INVALID_KEY', errorMessage: `HTTP ${res.status}` };
    if (res.status === 402)
      return { provider, status: 'down', latencyMs, errorCode: 'QUOTA_EXCEEDED', errorMessage: 'HTTP 402' };
    if (res.status === 429)
      return { provider, status: 'degraded', latencyMs, errorCode: 'RATE_LIMITED', errorMessage: 'HTTP 429' };
    if (!res.ok)
      return { provider, status: 'down', latencyMs, errorCode: 'UNKNOWN', errorMessage: `HTTP ${res.status}` };

    return { provider, status: 'healthy', latencyMs };
  } catch (err) {
    const errorCode = classifyError(err);
    return {
      provider,
      status: errorCode === 'RATE_LIMITED' ? 'degraded' : 'down',
      latencyMs: Date.now() - start,
      errorCode,
      errorMessage: err instanceof Error ? err.message.slice(0, 200) : String(err),
    };
  }
}

async function probeElevenLabs(): Promise<ProviderHealthResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return {
      provider: 'elevenlabs',
      status: 'down',
      latencyMs: 0,
      errorCode: 'INVALID_KEY',
      errorMessage: 'ELEVENLABS_API_KEY not configured',
    };
  }

  const start = Date.now();
  try {
    // GET /v1/user returns subscription quota — validates key + surfaces quota info
    const res = await withTimeout(
      fetch('https://api.elevenlabs.io/v1/user', {
        headers: { 'xi-api-key': apiKey },
      }),
      PROBE_TIMEOUT_MS,
    );
    const latencyMs = Date.now() - start;

    if (res.status === 401 || res.status === 403)
      return { provider: 'elevenlabs', status: 'down', latencyMs, errorCode: 'INVALID_KEY', errorMessage: `HTTP ${res.status}` };
    if (res.status === 402)
      return { provider: 'elevenlabs', status: 'down', latencyMs, errorCode: 'QUOTA_EXCEEDED', errorMessage: 'HTTP 402' };
    if (res.status === 429)
      return { provider: 'elevenlabs', status: 'degraded', latencyMs, errorCode: 'RATE_LIMITED', errorMessage: 'HTTP 429' };
    if (!res.ok)
      return { provider: 'elevenlabs', status: 'down', latencyMs, errorCode: 'UNKNOWN', errorMessage: `HTTP ${res.status}` };

    return { provider: 'elevenlabs', status: 'healthy', latencyMs };
  } catch (err) {
    const errorCode = classifyError(err);
    return {
      provider: 'elevenlabs',
      status: errorCode === 'RATE_LIMITED' ? 'degraded' : 'down',
      latencyMs: Date.now() - start,
      errorCode,
      errorMessage: err instanceof Error ? err.message.slice(0, 200) : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Persistence + Sentry emission
// ---------------------------------------------------------------------------

async function persistResult(
  result: ProviderHealthResult,
  triggeredBy: string,
): Promise<void> {
  try {
    await prisma.aiHealthLog.create({
      data: {
        provider: result.provider,
        status: result.status,
        errorCode: result.errorCode ?? null,
        errorMessage: result.errorMessage ?? null,
        latencyMs: result.latencyMs,
        triggeredBy,
      },
    });
  } catch (dbErr) {
    // DB write failure must never block job dispatch. Leave a Sentry
    // breadcrumb so a Sentry-only event without a matching ai_health_log row
    // is visible — that was the 2026-06-13 confusion: 206 INVALID_KEY events
    // in Sentry, zero rows in the DB.
    log.warn('[AI Health] failed to persist health log — continuing', {
      error: dbErr instanceof Error ? dbErr.message : String(dbErr),
    });
    Sentry.addBreadcrumb({
      category: 'ai.health',
      level: 'warning',
      message: 'persist skipped (DB unavailable) — Sentry-only health event',
      data: {
        provider: result.provider,
        status: result.status,
        errorCode: result.errorCode,
      },
    });
  }
}

function emitToSentry(result: ProviderHealthResult): void {
  if (result.status === 'healthy') return;

  const msg = `[AI Health] ${result.provider} ${result.status}: ${result.errorCode ?? 'UNKNOWN'}`;

  Sentry.addBreadcrumb({
    category: 'ai.health',
    message: msg,
    level: result.status === 'down' ? 'error' : 'warning',
    data: {
      provider: result.provider,
      errorCode: result.errorCode,
      latencyMs: result.latencyMs,
    },
  });

  // Only capture a Sentry issue for failures that represent a real
  // configuration problem the operator needs to fix: bad key or out of
  // quota. Transient classes (UNREACHABLE / TIMEOUT / UNKNOWN) stay as
  // breadcrumbs only — they'll surface in the issue's context if a real
  // downstream failure occurs, but they don't page on their own.
  //
  // 2026-06-13: the prior "all status=down except RATE_LIMITED" rule was
  // capturing 206 transient network errors as INVALID_KEY because of the
  // over-broad classifyError regex. Both have been tightened.
  const isHardConfigError =
    result.status === 'down' &&
    (result.errorCode === 'INVALID_KEY' || result.errorCode === 'QUOTA_EXCEEDED');

  if (isHardConfigError) {
    captureError(new Error(msg), {
      provider: result.provider,
      errorCode: result.errorCode,
      latencyMs: result.latencyMs,
    });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check all configured AI providers and determine whether a batch job
 * can safely proceed.
 *
 * canProceed = true  when at least one LLM (Anthropic or OpenAI) is
 *              reachable AND ElevenLabs TTS is reachable.
 *
 * Rate-limited ('degraded') providers are still considered reachable —
 * the existing retry/failover chain in llm-client.ts handles transient 429s.
 */
export async function checkAIProviders(
  triggeredBy = 'preflight',
): Promise<PreflightResult> {
  log.info('[AI Health] running preflight checks');

  const [anthropicResult, openaiResult, elevenLabsResult] = await Promise.all([
    probeLLM('anthropic'),
    probeLLM('openai'),
    probeElevenLabs(),
  ]);

  const results = [anthropicResult, openaiResult, elevenLabsResult];

  // Persist + emit concurrently; errors in either must not block canProceed
  await Promise.allSettled([
    ...results.map((r) => persistResult(r, triggeredBy)),
    Promise.resolve().then(() => results.forEach(emitToSentry)),
  ]);

  const llmOk =
    anthropicResult.status !== 'down' || openaiResult.status !== 'down';
  const ttsOk = elevenLabsResult.status !== 'down';

  const blockedBy: string[] = [];
  if (!llmOk) blockedBy.push('all LLM providers (anthropic + openai) are down');
  if (!ttsOk) blockedBy.push('ElevenLabs TTS is unreachable');

  const canProceed = llmOk && ttsOk;

  log.info('[AI Health] preflight complete', {
    canProceed,
    blockedBy,
    providers: results.map((r) => ({
      provider: r.provider,
      status: r.status,
      latencyMs: r.latencyMs,
      errorCode: r.errorCode,
    })),
  });

  return { canProceed, results, blockedBy };
}
