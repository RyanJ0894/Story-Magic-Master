/**
 * Tests for orchestratorFetch's Retry-After handling.
 *
 * 2026-06-25: Ryan's job 3a9db72b failed on chunks 6+7 because the orchestrator
 * returned 429 with `Retry-After: 60` and `orchestratorFetch` ignored the header
 * — it slept its hardcoded 2 seconds and gave up. The fix:
 *   - Parse `Retry-After` (delta-seconds or HTTP-date)
 *   - Use max(serverDelay, expoBackoff) capped at 90s
 *   - Bump default retries from 2 → 4 so a 60s wait can fit
 *
 * We can't directly assert on sleep timing (test would be flaky), so we assert
 * on the WARN log payload — it records the chosen delay and the parsed server
 * value, which is enough to pin the behavior.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  log: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/env', () => ({
  env: { ORCHESTRATOR_URL: 'http://orch.test' },
}));

import { orchestratorFetch } from '@/lib/orchestrator-fetch';
import { log } from '@/lib/logger';

const ORIG_FETCH = globalThis.fetch;

function makeResponse(status: number, headers: Record<string, string> = {}, body = '{}'): Response {
  return new Response(body, { status, headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = ORIG_FETCH;
});

describe('orchestratorFetch — Retry-After', () => {
  it('honors numeric Retry-After (delta-seconds) instead of using default backoff', async () => {
    // Two 429s with Retry-After: 5, then 200. Bumping retries=4 keeps it
    // within budget. Use a tiny retry-after so the fake-timer fast-forward
    // is cheap, but big enough to exceed retryBaseDelayMs (1s) on attempt 1.
    const calls: Request[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      calls.push(input as Request);
      if (calls.length === 1) return makeResponse(429, { 'retry-after': '5' });
      return makeResponse(200, {}, '{"ok":true}');
    }) as typeof globalThis.fetch;

    const promise = orchestratorFetch('/test', { retries: 2, retryBaseDelayMs: 1_000 });
    // Drain microtasks + advance to cover the 5s retry-after window.
    await vi.advanceTimersByTimeAsync(6_000);
    const { response, attempts } = await promise;

    expect(response.status).toBe(200);
    expect(attempts).toBe(2);

    const warnCalls = (log.warn as ReturnType<typeof vi.fn>).mock.calls;
    expect(warnCalls.length).toBeGreaterThan(0);
    // The warn payload should report the parsed Retry-After value (5000ms)
    // and a chosen delay >= 5000ms (max of server vs expo backoff).
    const payload = warnCalls[0][1];
    expect(payload.retryAfterFromServer).toBe(5_000);
  });

  it('falls back to exponential backoff when Retry-After is absent', async () => {
    let count = 0;
    globalThis.fetch = vi.fn(async () => {
      count++;
      if (count === 1) return makeResponse(503); // no Retry-After
      return makeResponse(200);
    }) as typeof globalThis.fetch;

    const promise = orchestratorFetch('/test', { retries: 2, retryBaseDelayMs: 1_000 });
    await vi.advanceTimersByTimeAsync(2_000);
    const { response } = await promise;

    expect(response.status).toBe(200);
    const warnCalls = (log.warn as ReturnType<typeof vi.fn>).mock.calls;
    expect(warnCalls[0][1].retryAfterFromServer).toBeNull();
  });

  it('caps Retry-After at 90 s — never blocks longer than that', async () => {
    let count = 0;
    globalThis.fetch = vi.fn(async () => {
      count++;
      if (count === 1) return makeResponse(429, { 'retry-after': '600' }); // 10 min
      return makeResponse(200);
    }) as typeof globalThis.fetch;

    const promise = orchestratorFetch('/test', { retries: 2, retryBaseDelayMs: 1_000 });
    // 90 s cap means the second attempt must run after fast-forwarding 90s.
    await vi.advanceTimersByTimeAsync(91_000);
    const { response } = await promise;

    expect(response.status).toBe(200);
    // The fetch must have happened only twice — the 10-minute retry-after
    // was capped, not honored verbatim.
    expect(count).toBe(2);
  });
});
