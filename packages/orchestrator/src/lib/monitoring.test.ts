/**
 * Tests for monitoring.ts
 *
 * Key behaviours:
 * - pingCheckly returns true on 200, false on non-200, false when URL not set
 * - startMonitoring no-ops when CHECKLY_PING_URL is unset
 * - stopMonitoring cancels the scheduled timer
 * - Reschedule-on-completion pattern: only ONE ping runs at a time
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('./logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('./cleanup.js', () => ({
  getDiskUsage: vi.fn(() => ({ available_gb: 10, total_gb: 100, used_percent: 10 })),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const PING_URL = 'https://ping.example.com/heartbeat/abc';

function makeFetch(ok: boolean, status: number) {
  return vi.fn().mockResolvedValue({ ok, status }) as unknown as typeof fetch;
}

/** Flush all pending microtasks */
async function flushMicrotasks() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('pingCheckly', () => {
  let originalFetch: typeof global.fetch;
  const originalPingUrl = process.env.CHECKLY_PING_URL;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalPingUrl === undefined) {
      delete process.env.CHECKLY_PING_URL;
    } else {
      process.env.CHECKLY_PING_URL = originalPingUrl;
    }
    vi.useRealTimers();
  });

  it('returns false when CHECKLY_PING_URL is not set', async () => {
    delete process.env.CHECKLY_PING_URL;
    global.fetch = vi.fn() as unknown as typeof fetch;

    const { pingCheckly } = await import('./monitoring.js');
    const result = await pingCheckly();

    expect(result).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns true when fetch responds with 200', async () => {
    process.env.CHECKLY_PING_URL = PING_URL;
    global.fetch = makeFetch(true, 200);

    const { pingCheckly } = await import('./monitoring.js');
    const result = await pingCheckly();

    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(PING_URL, expect.objectContaining({ method: 'GET' }));
  });

  it('returns false when fetch responds with non-200', async () => {
    process.env.CHECKLY_PING_URL = PING_URL;
    global.fetch = makeFetch(false, 503);

    const { pingCheckly } = await import('./monitoring.js');
    const result = await pingCheckly();

    expect(result).toBe(false);
  });

  it('returns false and does not throw when fetch rejects', async () => {
    process.env.CHECKLY_PING_URL = PING_URL;
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as unknown as typeof fetch;

    const { pingCheckly } = await import('./monitoring.js');
    await expect(pingCheckly()).resolves.toBe(false);
  });
});

describe('startMonitoring / stopMonitoring', () => {
  let originalFetch: typeof global.fetch;
  const originalPingUrl = process.env.CHECKLY_PING_URL;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalPingUrl === undefined) {
      delete process.env.CHECKLY_PING_URL;
    } else {
      process.env.CHECKLY_PING_URL = originalPingUrl;
    }
    vi.useRealTimers();
  });

  it('does not schedule pings when CHECKLY_PING_URL is unset', async () => {
    delete process.env.CHECKLY_PING_URL;
    const mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;

    const { startMonitoring } = await import('./monitoring.js');
    startMonitoring();

    await vi.runAllTimersAsync();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fires an initial ping immediately on start', async () => {
    process.env.CHECKLY_PING_URL = PING_URL;
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = mockFetch as unknown as typeof fetch;

    const { startMonitoring, stopMonitoring } = await import('./monitoring.js');
    startMonitoring();

    // Flush microtasks so the initial pingCheckly() promise resolves
    await flushMicrotasks();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    stopMonitoring();
  });

  it('stopMonitoring cancels scheduled pings', async () => {
    process.env.CHECKLY_PING_URL = PING_URL;
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = mockFetch as unknown as typeof fetch;

    const { startMonitoring, stopMonitoring } = await import('./monitoring.js');
    startMonitoring();
    await flushMicrotasks();

    const callsAfterStart = mockFetch.mock.calls.length;
    stopMonitoring();

    // Advance well past the 5-minute interval
    await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
    // No additional pings should have fired after stop
    expect(mockFetch.mock.calls.length).toBe(callsAfterStart);
  });

  it('does not fire concurrent pings (reschedule-on-completion)', async () => {
    process.env.CHECKLY_PING_URL = PING_URL;

    let resolveSlow: (() => void) | null = null;
    let pingCount = 0;

    global.fetch = vi.fn().mockImplementation(() => {
      pingCount++;
      if (pingCount === 2) {
        // Second call (first scheduled ping) hangs for a long time
        return new Promise<{ ok: boolean; status: number }>((resolve) => {
          resolveSlow = () => resolve({ ok: true, status: 200 });
        });
      }
      // Initial ping resolves immediately
      return Promise.resolve({ ok: true, status: 200 });
    }) as unknown as typeof fetch;

    const { startMonitoring, stopMonitoring } = await import('./monitoring.js');
    startMonitoring();

    // Let the initial ping complete
    await flushMicrotasks();
    expect(pingCount).toBe(1);

    // Advance to trigger the first scheduled ping (at PING_INTERVAL_MS = 5 min)
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    await flushMicrotasks();
    expect(pingCount).toBe(2); // First scheduled ping started

    // Advance another 5+ minutes — with setInterval a third ping would start,
    // but with setTimeout reschedule it should NOT (pending ping hasn't resolved)
    await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
    await flushMicrotasks();
    expect(pingCount).toBe(2); // No concurrent third ping

    stopMonitoring();
    resolveSlow?.();
  });
});

describe('getHealthData', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns expected shape with required fields', async () => {
    const { getHealthData } = await import('./monitoring.js');
    const data = getHealthData();

    expect(data).toMatchObject({
      status: 'ok',
      service: 'story-magic-orchestrator',
      memory: expect.objectContaining({ rss_mb: expect.any(Number) }),
      capabilities: { director: true, orchestrator: true },
    });
    expect(typeof data.uptime_seconds).toBe('number');
    expect(typeof data.timestamp).toBe('string');
  });

  it('reports checkly monitoring as false when URL is not configured', async () => {
    delete process.env.CHECKLY_PING_URL;
    const { getHealthData } = await import('./monitoring.js');
    const data = getHealthData();
    expect(data.monitoring.checkly).toBe(false);
  });
});
