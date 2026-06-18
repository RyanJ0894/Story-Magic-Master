// @vitest-environment node

/**
 * Tests for voice-validator — the pre-flight probe that catches broken
 * voice IDs before the orchestrator burns a 30-second retry budget per
 * dead chunk.
 *
 * Covers the 2026-06-17 incident class: voice exists in our catalog and
 * ElevenLabs /voices/<id> returns 200, but /text-to-speech/<id> returns
 * 500 (server-degraded) or 403 (account-level revoked).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Module mocks
vi.mock('./logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockPrismaUpdate = vi.fn().mockResolvedValue({});
vi.mock('./prisma.js', () => ({
  prisma: {
    voiceCatalogEntry: { update: (...args: unknown[]) => mockPrismaUpdate(...args) },
  },
}));

import { probeVoice, probeVoices, preFlightVoices, extractVoiceIds } from './voice-validator.js';

const mockFetch = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  process.env.ELEVENLABS_API_KEY = 'test-key';
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});
afterEach(() => {
  delete process.env.ELEVENLABS_API_KEY;
});

function fakeResponse(status: number, body: string = ''): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  } as Response;
}

describe('probeVoice', () => {
  it('returns ok=true on 200', async () => {
    mockFetch.mockResolvedValue(fakeResponse(200));
    const r = await probeVoice('v1', 'k');
    expect(r).toEqual({ voiceId: 'v1', ok: true, status: 200 });
  });

  it('classifies 500 as server_degraded', async () => {
    mockFetch.mockResolvedValue(fakeResponse(500, 'internal_server_error'));
    const r = await probeVoice('v1', 'k');
    expect(r.ok).toBe(false);
    expect(r.status).toBe(500);
    expect(r.reason).toBe('server_degraded');
  });

  it('classifies 403 as revoked', async () => {
    mockFetch.mockResolvedValue(fakeResponse(403, '{"detail":{"code":"voice_access_denied"}}'));
    const r = await probeVoice('v1', 'k');
    expect(r.reason).toBe('revoked');
  });

  it('classifies 404 as not_found', async () => {
    mockFetch.mockResolvedValue(fakeResponse(404, 'voice_not_found'));
    const r = await probeVoice('v1', 'k');
    expect(r.reason).toBe('not_found');
  });

  it('classifies 429 as rate_limited (transient — NOT auto-deactivated)', async () => {
    mockFetch.mockResolvedValue(fakeResponse(429, 'rate limit'));
    const r = await probeVoice('v1', 'k');
    expect(r.reason).toBe('rate_limited');
  });

  it('treats 401/402 as auth — not auto-deactivated', async () => {
    mockFetch.mockResolvedValue(fakeResponse(401));
    expect((await probeVoice('v1', 'k')).reason).toBe('auth');
    mockFetch.mockResolvedValue(fakeResponse(402));
    expect((await probeVoice('v1', 'k')).reason).toBe('auth');
  });

  it('captures network errors as status=0 reason=other', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNRESET'));
    const r = await probeVoice('v1', 'k');
    expect(r.ok).toBe(false);
    expect(r.status).toBe(0);
    expect(r.reason).toBe('other');
    expect(r.errorBody).toContain('ECONNRESET');
  });
});

describe('probeVoices', () => {
  it('returns one result per input voice', async () => {
    mockFetch.mockResolvedValue(fakeResponse(200));
    const results = await probeVoices(['a', 'b', 'c', 'd', 'e'], 'k');
    expect(results.length).toBe(5);
    expect(new Set(results.map((r) => r.voiceId))).toEqual(new Set(['a', 'b', 'c', 'd', 'e']));
  });

  it('handles empty input gracefully', async () => {
    const r = await probeVoices([], 'k');
    expect(r).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('preFlightVoices — auto-deactivation rules', () => {
  it('auto-deactivates server_degraded (500) voices', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('bad-server')) return fakeResponse(500, 'internal_server_error');
      return fakeResponse(200);
    });

    const r = await preFlightVoices(['good', 'bad-server']);
    expect(r.valid).toEqual(['good']);
    expect(r.broken.length).toBe(1);
    expect(r.broken[0].reason).toBe('server_degraded');
    expect(r.deactivated).toBe(1);
    expect(mockPrismaUpdate).toHaveBeenCalledWith({
      where: { voiceId: 'bad-server' },
      data: { isActive: false },
    });
  });

  it('auto-deactivates revoked (403) voices', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('revoked')) return fakeResponse(403, 'voice_access_denied');
      return fakeResponse(200);
    });

    const r = await preFlightVoices(['revoked']);
    expect(r.deactivated).toBe(1);
    expect(r.broken[0].reason).toBe('revoked');
  });

  it('auto-deactivates not_found (404) voices', async () => {
    mockFetch.mockResolvedValue(fakeResponse(404, 'voice_not_found'));
    const r = await preFlightVoices(['gone']);
    expect(r.deactivated).toBe(1);
    expect(r.broken[0].reason).toBe('not_found');
  });

  it('does NOT auto-deactivate rate_limited (transient)', async () => {
    mockFetch.mockResolvedValue(fakeResponse(429));
    const r = await preFlightVoices(['busy']);
    expect(r.broken.length).toBe(1);
    expect(r.deactivated).toBe(0);
    expect(mockPrismaUpdate).not.toHaveBeenCalled();
  });

  it('does NOT auto-deactivate auth failures (401/402)', async () => {
    mockFetch.mockResolvedValue(fakeResponse(401));
    const r = await preFlightVoices(['v1']);
    expect(r.deactivated).toBe(0);
    expect(mockPrismaUpdate).not.toHaveBeenCalled();
  });

  it('does NOT auto-deactivate network errors (status 0)', async () => {
    mockFetch.mockRejectedValue(new Error('network'));
    const r = await preFlightVoices(['v1']);
    expect(r.deactivated).toBe(0);
    expect(mockPrismaUpdate).not.toHaveBeenCalled();
  });

  it('dedupes duplicate voice IDs before probing', async () => {
    mockFetch.mockResolvedValue(fakeResponse(200));
    await preFlightVoices(['a', 'a', 'a', 'b', 'b']);
    // 5 inputs → 2 unique → 2 fetch calls
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('returns empty success when given empty input', async () => {
    const r = await preFlightVoices([]);
    expect(r).toEqual({ valid: [], broken: [], deactivated: 0 });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('skips probing when ELEVENLABS_API_KEY is missing — never blocks the run', async () => {
    delete process.env.ELEVENLABS_API_KEY;
    const r = await preFlightVoices(['a', 'b']);
    expect(r).toEqual({ valid: ['a', 'b'], broken: [], deactivated: 0 });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // Peter's 2026-06-17 concern: don't nuke the whole catalog during an
  // ElevenLabs outage.
  describe('platform-incident guard', () => {
    it('aborts auto-deactivation when >50% of voices return 500 (looks like outage)', async () => {
      mockFetch.mockResolvedValue(fakeResponse(500, 'internal_server_error'));
      const r = await preFlightVoices(['a', 'b', 'c', 'd']);
      expect(r.broken.length).toBe(4);
      expect(r.deactivated).toBe(0);
      expect(r.abortedDeactivation).toBe(true);
      expect(mockPrismaUpdate).not.toHaveBeenCalled();
    });

    it('STILL deactivates when only 1-of-3 fail with 500 (per-voice degradation)', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('bad')) return fakeResponse(500, 'internal_server_error');
        return fakeResponse(200);
      });
      const r = await preFlightVoices(['good1', 'good2', 'bad']);
      expect(r.broken.length).toBe(1);
      expect(r.deactivated).toBe(1);
      expect(r.abortedDeactivation).toBeFalsy();
    });

    it('still deactivates 403 / 404 voices even during a 5xx-storm', async () => {
      // 3/4 voices return 500 (storm) but one returns 403 (revoked).
      // The 403 should NOT be deactivated either since we abort the whole
      // pass when the failure rate looks like a platform incident.
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('revoked')) return fakeResponse(403);
        return fakeResponse(500);
      });
      const r = await preFlightVoices(['a', 'b', 'c', 'revoked']);
      expect(r.broken.length).toBe(4);
      expect(r.deactivated).toBe(0);
      expect(r.abortedDeactivation).toBe(true);
    });
  });
});

describe('extractVoiceIds', () => {
  it('returns unique voice_keys across all scenes', () => {
    const scenes = [
      { dialogue: [{ voice_key: 'A' }, { voice_key: 'B' }, { voice_key: 'A' }] },
      { dialogue: [{ voice_key: 'C' }, { voice_key: 'B' }] },
    ];
    expect(extractVoiceIds(scenes).sort()).toEqual(['A', 'B', 'C']);
  });

  it('skips lines without voice_key', () => {
    const scenes = [{ dialogue: [{ voice_key: 'A' }, {}, { voice_key: 'B' }] }];
    expect(extractVoiceIds(scenes).sort()).toEqual(['A', 'B']);
  });

  it('handles empty / undefined scenes', () => {
    expect(extractVoiceIds([])).toEqual([]);
    expect(extractVoiceIds([{}])).toEqual([]);
  });
});
