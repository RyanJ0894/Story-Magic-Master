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
import fs from 'fs';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('./logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('./cleanup.js', () => ({
  getDiskUsage: vi.fn(() => ({ available_gb: 10, total_gb: 100, used_percent: 10 })),
}));

// child_process.execFileSync is mocked so we can simulate the three states
// the whisper-binary spawn probe needs to distinguish: success (any exit),
// shared-libs loader failure, and "binary doesn't exist".
vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
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

  describe('alignment block (#243 followup)', () => {
    // Spy fs so we can deterministically present "binary is here / executable"
    // for one path and "absent" for another, without depending on the real
    // permissions of test files on the dev machine. The execFileSync mock
    // controls the spawn outcome independently.
    const PRESENT = '/fake/bin/whisper';
    const ABSENT = '/tmp/__does_not_exist_for_health_test__/whisper';
    const MODEL_PRESENT = '/fake/models/ggml-base.en.bin';

    const saved = {
      WHISPER_CPP_PATH: process.env.WHISPER_CPP_PATH,
      WHISPER_MODEL_PATH: process.env.WHISPER_MODEL_PATH,
      GROQ_API_KEY: process.env.GROQ_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    };

    let existsSpy: ReturnType<typeof vi.spyOn>;
    let accessSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
      // PRESENT and MODEL_PRESENT "exist"; everything else doesn't.
      existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((p: fs.PathLike) =>
        p === PRESENT || p === MODEL_PRESENT,
      );
      // X_OK is satisfied for PRESENT; throws for anything else (matching
      // node's behavior of access() throwing on a path that doesn't exist
      // or lacks the bit).
      accessSpy = vi.spyOn(fs, 'accessSync').mockImplementation((p: fs.PathLike) => {
        if (p === PRESENT) return undefined;
        throw new Error(`ENOENT or EACCES on ${p}`);
      });

      // Reset the spawn-probe cache between tests.
      const mod = await import('./monitoring.js');
      mod._resetWhisperProbeCacheForTests();

      // Default execFileSync: spawn succeeds → represents a healthy binary.
      // mockReset clears both implementation and call history so we don't
      // inherit either from a previous test in this describe block.
      const { execFileSync } = await import('child_process');
      vi.mocked(execFileSync).mockReset();
      vi.mocked(execFileSync).mockReturnValue(Buffer.from('usage: whisper ...'));
    });

    afterEach(() => {
      existsSpy?.mockRestore();
      accessSpy?.mockRestore();
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    });

    it('reports primary=whisper-local when both binary and model are present and runnable', async () => {
      process.env.WHISPER_CPP_PATH = PRESENT;
      process.env.WHISPER_MODEL_PATH = MODEL_PRESENT;
      process.env.GROQ_API_KEY = 'gk_test';
      const { getHealthData } = await import('./monitoring.js');
      const data = getHealthData() as any;
      expect(data.alignment.primary).toBe('whisper-local');
      expect(data.alignment.whisperLocal.ready).toBe(true);
      expect(data.alignment.whisperLocal.binaryRunnable).toBe(true);
      expect(data.alignment.anyTierReady).toBe(true);
    });

    it('reports primary=groq-whisper when binary path missing but Groq key set', async () => {
      process.env.WHISPER_CPP_PATH = ABSENT;
      process.env.WHISPER_MODEL_PATH = ABSENT;
      process.env.GROQ_API_KEY = 'gk_test';
      delete process.env.OPENAI_API_KEY;
      const { getHealthData } = await import('./monitoring.js');
      const data = getHealthData() as any;
      expect(data.alignment.primary).toBe('groq-whisper');
      expect(data.alignment.whisperLocal.ready).toBe(false);
      expect(data.alignment.whisperLocal.binaryExists).toBe(false);
      expect(data.alignment.whisperLocal.binaryPresent).toBe(false);
      expect(data.alignment.groq.ready).toBe(true);
    });

    it('reports primary=openai-whisper when neither local nor Groq available', async () => {
      delete process.env.WHISPER_CPP_PATH;
      delete process.env.WHISPER_MODEL_PATH;
      delete process.env.GROQ_API_KEY;
      process.env.OPENAI_API_KEY = 'sk_test';
      const { getHealthData } = await import('./monitoring.js');
      const data = getHealthData() as any;
      expect(data.alignment.primary).toBe('openai-whisper');
      expect(data.alignment.anyTierReady).toBe(true);
    });

    it('reports primary=duration-estimator and anyTierReady=false in the fully-degraded case', async () => {
      delete process.env.WHISPER_CPP_PATH;
      delete process.env.WHISPER_MODEL_PATH;
      delete process.env.GROQ_API_KEY;
      delete process.env.OPENAI_API_KEY;
      const { getHealthData } = await import('./monitoring.js');
      const data = getHealthData() as any;
      expect(data.alignment.primary).toBe('duration-estimator');
      expect(data.alignment.anyTierReady).toBe(false);
    });

    it('treats only-binary-present as not-ready (the model file is also required)', async () => {
      process.env.WHISPER_CPP_PATH = PRESENT;
      process.env.WHISPER_MODEL_PATH = ABSENT;
      process.env.GROQ_API_KEY = 'gk_test';
      const { getHealthData } = await import('./monitoring.js');
      const data = getHealthData() as any;
      expect(data.alignment.whisperLocal.binaryPresent).toBe(true);
      expect(data.alignment.whisperLocal.modelPresent).toBe(false);
      expect(data.alignment.whisperLocal.ready).toBe(false);
      expect(data.alignment.primary).toBe('groq-whisper');
    });

    // -------------------------------------------------------------------
    // 2026-06-13 followup: the binary-spawn probe. Pure fs.existsSync was
    // false-positive when whisper.cpp built dynamically and couldn't find
    // libwhisper.so.1 at runtime. /health now spawns `--help` once per
    // probe window to confirm the binary actually loads.
    // -------------------------------------------------------------------

    it('treats binary as NOT runnable when execFileSync throws a shared-libs loader error', async () => {
      process.env.WHISPER_CPP_PATH = PRESENT;
      process.env.WHISPER_MODEL_PATH = MODEL_PRESENT;
      process.env.GROQ_API_KEY = 'gk_test';
      const { execFileSync } = await import('child_process');
      const err = new Error('spawn failed') as Error & { stderr: Buffer; status: number };
      err.stderr = Buffer.from(
        '/opt/render/project/src/bin/whisper: error while loading shared libraries: libwhisper.so.1: cannot open shared object file: No such file or directory',
      );
      err.status = 127;
      vi.mocked(execFileSync).mockImplementation(() => {
        throw err;
      });

      const { getHealthData } = await import('./monitoring.js');
      const data = getHealthData() as any;

      expect(data.alignment.whisperLocal.binaryExists).toBe(true);
      expect(data.alignment.whisperLocal.binaryExecutable).toBe(true);
      expect(data.alignment.whisperLocal.binaryRunnable).toBe(false);
      expect(data.alignment.whisperLocal.binaryProbeError).toContain('libwhisper');
      expect(data.alignment.whisperLocal.ready).toBe(false);
      expect(data.alignment.primary).toBe('groq-whisper');
    });

    it('treats binary as RUNNABLE when execFileSync throws but stderr is empty (--help typically exits non-zero)', async () => {
      process.env.WHISPER_CPP_PATH = PRESENT;
      process.env.WHISPER_MODEL_PATH = MODEL_PRESENT;
      process.env.GROQ_API_KEY = 'gk_test';
      const { execFileSync } = await import('child_process');
      const err = new Error('Command failed') as Error & { stderr: Buffer; status: number };
      err.stderr = Buffer.from('');
      err.status = 1;
      vi.mocked(execFileSync).mockImplementation(() => {
        throw err;
      });

      const { getHealthData } = await import('./monitoring.js');
      const data = getHealthData() as any;

      // Spawn happened (status=1 with empty stderr ≠ loader error) → runnable.
      expect(data.alignment.whisperLocal.binaryRunnable).toBe(true);
      expect(data.alignment.primary).toBe('whisper-local');
    });

    it('caches the spawn-probe result — second /health within the TTL does NOT re-spawn', async () => {
      process.env.WHISPER_CPP_PATH = PRESENT;
      process.env.WHISPER_MODEL_PATH = MODEL_PRESENT;
      process.env.GROQ_API_KEY = 'gk_test';
      const { execFileSync } = await import('child_process');

      const { getHealthData } = await import('./monitoring.js');
      getHealthData();
      getHealthData();
      getHealthData();

      // Only one spawn for the same WHISPER_CPP_PATH within the TTL window.
      expect(vi.mocked(execFileSync)).toHaveBeenCalledTimes(1);
    });
  });
});
