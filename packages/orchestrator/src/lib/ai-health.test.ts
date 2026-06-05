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
});
