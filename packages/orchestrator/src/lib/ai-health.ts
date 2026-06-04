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

  if (s === 401 || s === 403 || (msg.includes('invalid') && msg.includes('key')) || msg.includes('authentication')) return 'INVALID_KEY';
  if (s === 402 || msg.includes('credit') || msg.includes('quota') || msg.includes('billing')) return 'QUOTA_EXCEEDED';
  if (s === 429 || msg.includes('rate limit') || msg.includes('too many')) return 'RATE_LIMITED';
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) return 'TIMEOUT';
  if (msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('network')) return 'UNREACHABLE';
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
    // DB write failure must never block job dispatch
    log.warn('[AI Health] failed to persist health log — continuing', {
      error: dbErr instanceof Error ? dbErr.message : String(dbErr),
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

  // Capture a Sentry event for hard failures (key invalid, quota exhausted)
  // so they appear in the Issues list, not just breadcrumbs.
  if (result.status === 'down' && result.errorCode !== 'RATE_LIMITED') {
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
