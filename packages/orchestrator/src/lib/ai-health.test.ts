// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PreflightResult } from './ai-health.js';

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted above dynamic import
// ---------------------------------------------------------------------------

vi.mock('./logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('./sentry.js', () => ({
  captureError: vi.fn(),
  Sentry: { addBreadcrumb: vi.fn() },
}));

vi.mock('./prisma.js', () => ({
  prisma: {
    aiHealthLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetch(statusMap: Record<string, number>) {
  return vi.fn((url: string) => {
    const entry = Object.entries(statusMap).find(([key]) => url.includes(key));
    const status = entry ? entry[1] : 200;
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('checkAIProviders', () => {
  let checkAIProviders: (triggeredBy?: string) => Promise<PreflightResult>;

  beforeEach(async () => {
    vi.resetModules();
    // Clear mock call history between tests (the captureError + addBreadcrumb
    // mocks from vi.mock('./sentry.js') would otherwise accumulate calls
    // from prior tests). Does NOT clear the mock implementations themselves.
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.OPENAI_API_KEY = 'sk-openai-test';
    process.env.ELEVENLABS_API_KEY = 'xi-test';
    ({ checkAIProviders } = await import('./ai-health.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('canProceed when all providers healthy', async () => {
    vi.stubGlobal('fetch', makeFetch({ 'anthropic.com': 200, 'openai.com': 200, 'elevenlabs.io': 200 }));

    const result = await checkAIProviders();

    expect(result.canProceed).toBe(true);
    expect(result.blockedBy).toHaveLength(0);
    expect(result.results.every((r) => r.status === 'healthy')).toBe(true);
  });

  it('canProceed when anthropic down but openai healthy', async () => {
    vi.stubGlobal('fetch', makeFetch({ 'anthropic.com': 401, 'openai.com': 200, 'elevenlabs.io': 200 }));

    const result = await checkAIProviders();

    expect(result.canProceed).toBe(true);
    expect(result.results.find((r) => r.provider === 'anthropic')?.errorCode).toBe('INVALID_KEY');
    expect(result.results.find((r) => r.provider === 'openai')?.status).toBe('healthy');
  });

  it('blocks when both LLM providers down', async () => {
    vi.stubGlobal('fetch', makeFetch({ 'anthropic.com': 402, 'openai.com': 401, 'elevenlabs.io': 200 }));

    const result = await checkAIProviders();

    expect(result.canProceed).toBe(false);
    expect(result.blockedBy).toContain('all LLM providers (anthropic + openai) are down');
  });

  it('blocks when elevenlabs down', async () => {
    vi.stubGlobal('fetch', makeFetch({ 'anthropic.com': 200, 'openai.com': 200, 'elevenlabs.io': 403 }));

    const result = await checkAIProviders();

    expect(result.canProceed).toBe(false);
    expect(result.blockedBy).toContain('ElevenLabs TTS is unreachable');
  });

  it('marks provider degraded (not down) on 429', async () => {
    vi.stubGlobal('fetch', makeFetch({ 'anthropic.com': 429, 'openai.com': 200, 'elevenlabs.io': 200 }));

    const result = await checkAIProviders();

    expect(result.canProceed).toBe(true);
    expect(result.results.find((r) => r.provider === 'anthropic')?.status).toBe('degraded');
    expect(result.results.find((r) => r.provider === 'anthropic')?.errorCode).toBe('RATE_LIMITED');
  });

  it('marks provider down on timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('anthropic.com')) {
          return new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Probe timed out after 8000ms')), 10),
          );
        }
        return Promise.resolve({ ok: true, status: 200 });
      }),
    );

    const result = await checkAIProviders();

    expect(result.results.find((r) => r.provider === 'anthropic')?.errorCode).toBe('TIMEOUT');
    expect(result.canProceed).toBe(true); // openai still up
  });

  it('returns down with INVALID_KEY when env var missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    vi.stubGlobal('fetch', makeFetch({ 'openai.com': 200, 'elevenlabs.io': 200 }));

    const result = await checkAIProviders();

    const anthropic = result.results.find((r) => r.provider === 'anthropic');
    expect(anthropic?.status).toBe('down');
    expect(anthropic?.errorCode).toBe('INVALID_KEY');
    expect(anthropic?.latencyMs).toBe(0);
    expect(result.canProceed).toBe(true); // openai still up
  });

  it('proceeds even when DB persistence fails', async () => {
    const { prisma } = await import('./prisma.js');
    vi.mocked(prisma.aiHealthLog.create).mockRejectedValue(new Error('DB unavailable'));
    vi.stubGlobal('fetch', makeFetch({ 'anthropic.com': 200, 'openai.com': 200, 'elevenlabs.io': 200 }));

    // Should not throw
    const result = await checkAIProviders();
    expect(result.canProceed).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 2026-06-13 followup — transient errors must NOT page as INVALID_KEY.
  // The prior classifyError treated any `msg.includes('authentication')` as
  // INVALID_KEY and emitToSentry captureError'd every non-RATE_LIMITED
  // failure, producing 206 false-positive INVALID_KEY events in Sentry
  // during the deploy-churn window.
  // -------------------------------------------------------------------------

  describe('classifyError — transient errors do not masquerade as INVALID_KEY', () => {
    const TRANSIENT_MESSAGES: Array<{ msg: string; expected: string }> = [
      { msg: 'fetch failed', expected: 'UNREACHABLE' },
      { msg: 'ECONNREFUSED 127.0.0.1:443', expected: 'UNREACHABLE' },
      { msg: 'ECONNRESET while reading TLS handshake', expected: 'UNREACHABLE' },
      { msg: 'socket hang up', expected: 'UNREACHABLE' },
      { msg: 'getaddrinfo ENOTFOUND api.elevenlabs.io', expected: 'UNREACHABLE' },
      { msg: 'network is unreachable', expected: 'UNREACHABLE' },
      { msg: 'request aborted', expected: 'TIMEOUT' },
      { msg: 'Probe timed out after 8000ms', expected: 'TIMEOUT' },
    ];

    for (const { msg, expected } of TRANSIENT_MESSAGES) {
      it(`classifies "${msg}" as ${expected}, not INVALID_KEY`, async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn((url: string) => {
            if (url.includes('elevenlabs.io')) {
              return Promise.reject(new Error(msg));
            }
            return Promise.resolve({ ok: true, status: 200 });
          }),
        );
        const result = await checkAIProviders();
        const el = result.results.find((r) => r.provider === 'elevenlabs');
        expect(el?.errorCode).toBe(expected);
        expect(el?.errorCode).not.toBe('INVALID_KEY');
      });
    }

    it('still classifies real 401 from the HTTP layer as INVALID_KEY', async () => {
      vi.stubGlobal('fetch', makeFetch({ 'anthropic.com': 200, 'openai.com': 200, 'elevenlabs.io': 401 }));
      const result = await checkAIProviders();
      const el = result.results.find((r) => r.provider === 'elevenlabs');
      expect(el?.errorCode).toBe('INVALID_KEY');
    });

    it('still classifies a message that explicitly mentions "api key" as INVALID_KEY', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new Error('Provided api key is malformed'))),
      );
      const result = await checkAIProviders();
      const el = result.results.find((r) => r.provider === 'elevenlabs');
      expect(el?.errorCode).toBe('INVALID_KEY');
    });
  });

  describe('emitToSentry — only hard config errors page', () => {
    it('does NOT captureError for UNREACHABLE (transient)', async () => {
      const { captureError } = await import('./sentry.js');
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
          if (url.includes('elevenlabs.io')) return Promise.reject(new Error('fetch failed'));
          return Promise.resolve({ ok: true, status: 200 });
        }),
      );
      await checkAIProviders();
      expect(captureError).not.toHaveBeenCalled();
    });

    it('does NOT captureError for TIMEOUT (transient)', async () => {
      const { captureError } = await import('./sentry.js');
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
          if (url.includes('elevenlabs.io')) return Promise.reject(new Error('Probe timed out after 8000ms'));
          return Promise.resolve({ ok: true, status: 200 });
        }),
      );
      await checkAIProviders();
      expect(captureError).not.toHaveBeenCalled();
    });

    it('DOES captureError for real INVALID_KEY (401 from API)', async () => {
      const { captureError } = await import('./sentry.js');
      vi.stubGlobal('fetch', makeFetch({ 'anthropic.com': 200, 'openai.com': 200, 'elevenlabs.io': 401 }));
      await checkAIProviders();
      expect(captureError).toHaveBeenCalled();
      const args = vi.mocked(captureError).mock.calls[0];
      expect((args[0] as Error).message).toContain('elevenlabs');
      expect((args[0] as Error).message).toContain('INVALID_KEY');
    });

    it('DOES captureError for QUOTA_EXCEEDED (402 from API)', async () => {
      const { captureError } = await import('./sentry.js');
      vi.stubGlobal('fetch', makeFetch({ 'anthropic.com': 200, 'openai.com': 200, 'elevenlabs.io': 402 }));
      await checkAIProviders();
      // anthropic + openai healthy → only elevenlabs captured
      const calls = vi.mocked(captureError).mock.calls;
      expect(calls.length).toBe(1);
      expect((calls[0][0] as Error).message).toContain('QUOTA_EXCEEDED');
    });

    it('does NOT captureError for RATE_LIMITED (degraded, not down)', async () => {
      const { captureError } = await import('./sentry.js');
      vi.stubGlobal('fetch', makeFetch({ 'anthropic.com': 200, 'openai.com': 200, 'elevenlabs.io': 429 }));
      await checkAIProviders();
      expect(captureError).not.toHaveBeenCalled();
    });
  });

  describe('persistResult — DB failure leaves a Sentry breadcrumb', () => {
    it('leaves an "ai.health" breadcrumb when DB write fails so Sentry-only events are explainable', async () => {
      const { prisma } = await import('./prisma.js');
      const { Sentry } = await import('./sentry.js');
      vi.mocked(prisma.aiHealthLog.create).mockRejectedValue(new Error('DB unavailable'));
      vi.stubGlobal('fetch', makeFetch({ 'anthropic.com': 200, 'openai.com': 200, 'elevenlabs.io': 200 }));

      await checkAIProviders();

      // Find any breadcrumb whose message mentions persist skipped
      const calls = vi.mocked(Sentry.addBreadcrumb).mock.calls;
      const persistSkipped = calls.find(([crumb]) =>
        typeof crumb === 'object' && crumb !== null && 'message' in crumb &&
        typeof (crumb as { message?: unknown }).message === 'string' &&
        ((crumb as { message: string }).message.includes('persist skipped')),
      );
      expect(persistSkipped).toBeDefined();
    });
  });
});
