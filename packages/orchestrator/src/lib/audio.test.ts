// @vitest-environment node

/**
 * Tests for ttsGenerate in lib/audio.ts.
 *
 * REGRESSION (2026-05-28, Peter Octavian): output_format must be a URL query
 * parameter. ElevenLabs silently ignores it in the request body and returns
 * MPEG instead of raw PCM, breaking the transcodePcmToWav step downstream.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before any import that triggers module load
// ---------------------------------------------------------------------------

vi.mock('ffmpeg-static', () => ({ default: '/fake/ffmpeg' }));
vi.mock('ffprobe-static', () => ({ default: { path: '/fake/ffprobe' } }));

vi.mock('execa', () => ({
  execa: vi.fn().mockResolvedValue({ stdout: Buffer.from('FAKE_WAV_OUTPUT') }),
}));

// Bypass retry delays — tests call the inner fn exactly once
vi.mock('./retry.js', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
  RetryableError: class RetryableError extends Error {
    status: number;
    isRetryable: boolean;
    constructor(message: string, status: number, isRetryable = true) {
      super(message);
      this.name = 'RetryableError';
      this.status = status;
      this.isRetryable = isRetryable;
    }
  },
}));

vi.mock('./logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ttsGenerate } from './audio.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeResponse(status: number, body: string | Buffer): Response {
  const text = typeof body === 'string' ? body : '';
  const buf = body instanceof Buffer ? body : Buffer.from(body);
  return {
    ok: status < 400,
    status,
    text: async () => text,
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// ttsGenerate
// ---------------------------------------------------------------------------

describe('ttsGenerate', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('ELEVENLABS_API_KEY', 'test-key-abc');
    vi.stubEnv('ELEVENLABS_MOCK', '');
    vi.stubEnv('ELEVENLABS_MODEL', '');
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  // ── Mock mode ────────────────────────────────────────────────────────────

  describe('mock mode (ELEVENLABS_MOCK=true)', () => {
    it('returns a Buffer without calling the ElevenLabs API', async () => {
      vi.stubEnv('ELEVENLABS_MOCK', 'true');

      const result = await ttsGenerate({ voice: { voice_id: 'v1', params_json: {} }, text: 'Hello world.' });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ── Missing API key ──────────────────────────────────────────────────────

  it('throws when ELEVENLABS_API_KEY is not set', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', '');

    await expect(
      ttsGenerate({ voice: { voice_id: 'v1', params_json: {} }, text: 'Hello.' })
    ).rejects.toThrow('ELEVENLABS_API_KEY missing');
  });

  // ── HTTP request structure ────────────────────────────────────────────────

  describe('HTTP request structure', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue(fakeResponse(200, Buffer.from('pcm-data')));
    });

    it('sends output_format=pcm_24000 as a URL query param — NOT in the request body', async () => {
      let capturedUrl = '';
      let capturedBody: Record<string, unknown> = {};

      mockFetch.mockImplementation(async (url: string, init: RequestInit) => {
        capturedUrl = url;
        capturedBody = JSON.parse(init.body as string);
        return fakeResponse(200, Buffer.from('pcm'));
      });

      await ttsGenerate({ voice: { voice_id: 'voice123', params_json: {} }, text: 'Test line.' });

      // THE REGRESSION CHECK: must be a query param
      expect(capturedUrl).toContain('?output_format=pcm_24000');

      // Must NOT appear in the JSON body (ElevenLabs ignores unknown body fields
      // and returns MPEG when output_format is absent from the query string)
      expect(capturedBody).not.toHaveProperty('output_format');
    });

    it('includes the voice_id in the URL path', async () => {
      let capturedUrl = '';
      mockFetch.mockImplementation(async (url: string) => {
        capturedUrl = url;
        return fakeResponse(200, Buffer.from('pcm'));
      });

      await ttsGenerate({ voice: { voice_id: 'my-voice-xyz', params_json: {} }, text: 'Hello.' });

      expect(capturedUrl).toContain('/text-to-speech/my-voice-xyz');
    });

    it('sends Accept: audio/pcm header', async () => {
      let capturedHeaders: Record<string, string> = {};
      mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
        capturedHeaders = init.headers as Record<string, string>;
        return fakeResponse(200, Buffer.from('pcm'));
      });

      await ttsGenerate({ voice: { voice_id: 'v1', params_json: {} }, text: 'Hello.' });

      expect(capturedHeaders['Accept']).toBe('audio/pcm');
    });

    it('sends xi-api-key header matching ELEVENLABS_API_KEY', async () => {
      let capturedHeaders: Record<string, string> = {};
      mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
        capturedHeaders = init.headers as Record<string, string>;
        return fakeResponse(200, Buffer.from('pcm'));
      });

      await ttsGenerate({ voice: { voice_id: 'v1', params_json: {} }, text: 'Hello.' });

      expect(capturedHeaders['xi-api-key']).toBe('test-key-abc');
    });

    it('includes text and model_id in request body, defaults to eleven_turbo_v2_5', async () => {
      let capturedBody: Record<string, unknown> = {};
      mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
        capturedBody = JSON.parse(init.body as string);
        return fakeResponse(200, Buffer.from('pcm'));
      });

      await ttsGenerate({ voice: { voice_id: 'v1', params_json: {} }, text: 'Dialogue line.' });

      expect(capturedBody.text).toBe('Dialogue line.');
      expect(capturedBody.model_id).toBe('eleven_turbo_v2_5');
      expect(capturedBody).toHaveProperty('voice_settings');
    });

    it('respects ELEVENLABS_MODEL env var override', async () => {
      vi.stubEnv('ELEVENLABS_MODEL', 'eleven_multilingual_v2');
      let capturedBody: Record<string, unknown> = {};
      mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
        capturedBody = JSON.parse(init.body as string);
        return fakeResponse(200, Buffer.from('pcm'));
      });

      await ttsGenerate({ voice: { voice_id: 'v1', params_json: {} }, text: 'Hello.' });

      expect(capturedBody.model_id).toBe('eleven_multilingual_v2');
    });

    it('uses params_json as voice_settings when non-empty', async () => {
      const customParams = { stability: 0.9, similarity_boost: 0.5 };
      let capturedBody: Record<string, unknown> = {};
      mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
        capturedBody = JSON.parse(init.body as string);
        return fakeResponse(200, Buffer.from('pcm'));
      });

      await ttsGenerate({ voice: { voice_id: 'v1', params_json: customParams }, text: 'Hello.' });

      expect(capturedBody.voice_settings).toEqual(customParams);
    });

    it('uses default voice_settings when params_json is empty', async () => {
      let capturedBody: Record<string, unknown> = {};
      mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
        capturedBody = JSON.parse(init.body as string);
        return fakeResponse(200, Buffer.from('pcm'));
      });

      await ttsGenerate({ voice: { voice_id: 'v1', params_json: {} }, text: 'Hello.' });

      expect(capturedBody.voice_settings).toEqual(
        expect.objectContaining({ stability: 0.4, similarity_boost: 0.7, use_speaker_boost: false })
      );
    });
  });

  // ── Error handling ────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('throws a non-retryable error on 401 Unauthorized with a clear message', async () => {
      mockFetch.mockResolvedValue(fakeResponse(401, 'Unauthorized'));

      await expect(
        ttsGenerate({ voice: { voice_id: 'v1', params_json: {} }, text: 'Hello.' })
      ).rejects.toThrow(/invalid or missing/i);
    });

    it('throws a non-retryable error on 402 Payment Required mentioning billing', async () => {
      mockFetch.mockResolvedValue(fakeResponse(402, 'payment required'));

      await expect(
        ttsGenerate({ voice: { voice_id: 'v1', params_json: {} }, text: 'Hello.' })
      ).rejects.toThrow(/billing/i);
    });

    it('throws a retryable error on 429 Rate Limit', async () => {
      mockFetch.mockResolvedValue(fakeResponse(429, 'rate limited'));

      await expect(
        ttsGenerate({ voice: { voice_id: 'v1', params_json: {} }, text: 'Hello.' })
      ).rejects.toThrow('429');
    });

    it('throws a retryable error on 500 Internal Server Error', async () => {
      mockFetch.mockResolvedValue(fakeResponse(500, 'internal server error'));

      await expect(
        ttsGenerate({ voice: { voice_id: 'v1', params_json: {} }, text: 'Hello.' })
      ).rejects.toThrow('500');
    });

    it('throws on non-voice_not_found 404', async () => {
      mockFetch.mockResolvedValue(fakeResponse(404, 'resource_not_found'));

      await expect(
        ttsGenerate({ voice: { voice_id: 'v1', params_json: {} }, text: 'Hello.' })
      ).rejects.toThrow('404');
    });
  });

  // ── Voice fallback on 404 voice_not_found ────────────────────────────────

  describe('voice fallback', () => {
    it('retries with the default male voice (Adam) when voice_not_found 404 is returned', async () => {
      const urlsCalled: string[] = [];

      mockFetch.mockImplementation(async (url: string) => {
        urlsCalled.push(url);
        // First call with unknown voice → 404 voice_not_found
        if (urlsCalled.length === 1) {
          return fakeResponse(404, 'voice_not_found');
        }
        // Second call with fallback voice → success
        return fakeResponse(200, Buffer.from('pcm'));
      });

      const result = await ttsGenerate({
        voice: { voice_id: 'nonexistent-voice-id', params_json: {} },
        text: 'Hello fallback.',
      });

      expect(urlsCalled).toHaveLength(2);
      expect(urlsCalled[0]).toContain('nonexistent-voice-id');
      // pNInz6obpgDQGcFmaJgB is the Adam (default male) voice ID
      expect(urlsCalled[1]).toContain('pNInz6obpgDQGcFmaJgB');
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  // ── Successful transcoding ────────────────────────────────────────────────

  it('passes the response bytes through transcodePcmToWav and returns a Buffer', async () => {
    mockFetch.mockResolvedValue(fakeResponse(200, Buffer.from('raw-pcm-bytes')));

    const result = await ttsGenerate({ voice: { voice_id: 'v1', params_json: {} }, text: 'Hello.' });

    expect(result).toBeInstanceOf(Buffer);
    // execa mock returns 'FAKE_WAV_OUTPUT', confirming the transcoding path ran
    expect(result.toString()).toBe('FAKE_WAV_OUTPUT');
  });
});
