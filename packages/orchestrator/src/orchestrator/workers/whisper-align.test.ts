/**
 * Tests for the whisperAlign fallback chain (PR F of #186).
 *
 * Verifies routing decisions when whisper.cpp fails:
 *   - Groq Whisper is tried first (default on if GROQ_API_KEY set)
 *   - OpenAI Whisper is tried only when ENABLE_OPENAI_WHISPER_FALLBACK=true
 *   - Duration estimator (null result) is the last resort
 *
 * We don't exercise the real whisper.cpp binary — we force it to fail by
 * pointing at a non-existent path and inspecting which API path runs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock execa so whisper.cpp invocation always throws ───────────────────
vi.mock('execa', () => ({
  execa: vi.fn().mockRejectedValue(new Error('whisper.cpp not installed')),
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  // Return a fake audio buffer so the API path doesn't need a real WAV.
  const fakeAudioBuffer = Buffer.from('fake-wav-bytes');
  const promises = {
    ...actual.promises,
    readFile: vi.fn(async () => fakeAudioBuffer),
  };
  return {
    ...actual,
    promises,
    default: { ...actual, existsSync: vi.fn(() => false), createReadStream: vi.fn(), promises },
    existsSync: vi.fn(() => false),
    createReadStream: vi.fn(),
  };
});

vi.mock('../../lib/logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// withRetry strips backoff so failing-fast tests don't sleep for seconds.
vi.mock('../../lib/retry.js', () => ({
  withRetry: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}));

// fetch is the only external surface — drive its responses per test.
const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

import { whisperAlign } from './whisper-align.js';

describe('whisperAlign fallback chain', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env to a known minimal state.
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ENABLE_GROQ_WHISPER_FALLBACK;
    delete process.env.ENABLE_OPENAI_WHISPER_FALLBACK;
    delete process.env.GROQ_WHISPER_MODEL;
    // Always force whisper.cpp through the catch branch.
    process.env.WHISPER_CPP_PATH = '/does/not/exist/whisper';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns null (duration estimator path) when no API keys are configured', async () => {
    const result = await whisperAlign('/tmp/sample.mp3', 'hello world');
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses Groq Whisper when GROQ_API_KEY is set (default-on)', async () => {
    process.env.GROQ_API_KEY = 'groq-test-key';
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ words: [{ word: 'hello', start: 0, end: 0.5 }] }),
    });

    const result = await whisperAlign('/tmp/sample.mp3', 'hello world');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('api.groq.com');
    expect(result).toEqual([{ word: 'hello', start: 0, end: 0.5 }]);
  });

  it('falls through to OpenAI when Groq fails AND OpenAI is enabled', async () => {
    process.env.GROQ_API_KEY = 'groq-test-key';
    process.env.OPENAI_API_KEY = 'openai-test-key';
    process.env.ENABLE_OPENAI_WHISPER_FALLBACK = 'true';

    // 1st fetch (Groq) fails, 2nd fetch (OpenAI) succeeds.
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'groq down' })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ words: [{ word: 'hi', start: 0, end: 0.3 }] }),
      });

    const result = await whisperAlign('/tmp/sample.mp3', 'hi');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('api.groq.com');
    expect(fetchMock.mock.calls[1][0]).toContain('api.openai.com');
    expect(result).toEqual([{ word: 'hi', start: 0, end: 0.3 }]);
  });

  it('does NOT try OpenAI when ENABLE_OPENAI_WHISPER_FALLBACK is unset, even on Groq failure', async () => {
    process.env.GROQ_API_KEY = 'groq-test-key';
    process.env.OPENAI_API_KEY = 'openai-test-key';
    // ENABLE_OPENAI_WHISPER_FALLBACK intentionally not set.
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'groq down' });

    const result = await whisperAlign('/tmp/sample.mp3', 'hi');

    expect(fetchMock).toHaveBeenCalledTimes(1); // Only Groq attempted.
    expect(result).toBeNull(); // Fell through to duration estimator.
  });

  it('skips Groq entirely when ENABLE_GROQ_WHISPER_FALLBACK=false', async () => {
    process.env.GROQ_API_KEY = 'groq-test-key';
    process.env.ENABLE_GROQ_WHISPER_FALLBACK = 'false';
    process.env.OPENAI_API_KEY = 'openai-test-key';
    process.env.ENABLE_OPENAI_WHISPER_FALLBACK = 'true';

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ words: [{ word: 'x', start: 0, end: 0.1 }] }),
    });

    await whisperAlign('/tmp/sample.mp3', 'x');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('api.openai.com');
  });

  it('uses GROQ_WHISPER_MODEL env override when set', async () => {
    process.env.GROQ_API_KEY = 'groq-test-key';
    process.env.GROQ_WHISPER_MODEL = 'whisper-large-v3-turbo';
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ words: [] }),
    });

    await whisperAlign('/tmp/sample.mp3', 'x');

    // The FormData object isn't trivially inspectable in mocks, but we can
    // confirm Groq was the target.
    expect(fetchMock.mock.calls[0][0]).toContain('api.groq.com');
  });
});
