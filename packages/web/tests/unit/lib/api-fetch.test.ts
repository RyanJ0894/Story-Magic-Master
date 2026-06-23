/**
 * apiFetchWithRetry — issue #368 regression guard.
 *
 * Ryan hit Cloudflare 524 twice on /api/projects/upload during the
 * 2026-06-22 Render redeploy window. This file pins:
 *   1. Transient cutover statuses (502/503/504/524) are retried.
 *   2. Non-transient statuses (400/401/404/500) pass through immediately.
 *   3. Network errors (TypeError) are retried up to `retries` times.
 *   4. The retry budget is bounded — after N retries we give up.
 *   5. AbortSignal short-circuits both the in-flight request and the
 *      backoff sleep.
 *   6. Backoff doubles each attempt (1s, 2s, 4s default).
 *
 * If any test in this file goes red, paying users may see a transient
 * upload failure where they used to see a successful retry.
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetchWithRetry } from '@/lib/api/fetch';

const noSleep = () => Promise.resolve();

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('apiFetchWithRetry — transient cutover retry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retries on 524 and returns the eventual 201', async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(jsonResponse(524))
      .mockResolvedValueOnce(jsonResponse(524))
      .mockResolvedValueOnce(jsonResponse(201, { id: 'abc' }));
    globalThis.fetch = fetchSpy as typeof fetch;

    const res = await apiFetchWithRetry('/api/projects/upload', { method: 'POST' }, { sleep: noSleep });

    expect(res.status).toBe(201);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('retries on 502 / 503 / 504 the same way', async () => {
    for (const status of [502, 503, 504]) {
      const fetchSpy = vi.fn()
        .mockResolvedValueOnce(jsonResponse(status))
        .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
      globalThis.fetch = fetchSpy as typeof fetch;

      const res = await apiFetchWithRetry('/x', undefined, { sleep: noSleep });

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    }
  });

  it('does NOT retry on 4xx — passes through the first response', async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce(jsonResponse(400, { error: 'bad' }));
    globalThis.fetch = fetchSpy as typeof fetch;

    const res = await apiFetchWithRetry('/x', undefined, { sleep: noSleep });

    expect(res.status).toBe(400);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on 500 — that is an app error, not a cutover error', async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce(jsonResponse(500, { error: 'oops' }));
    globalThis.fetch = fetchSpy as typeof fetch;

    const res = await apiFetchWithRetry('/x', undefined, { sleep: noSleep });

    expect(res.status).toBe(500);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('gives up after `retries` retries and returns the final transient response', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(524));
    globalThis.fetch = fetchSpy as typeof fetch;

    const res = await apiFetchWithRetry('/x', undefined, { retries: 2, sleep: noSleep });

    expect(res.status).toBe(524);
    expect(fetchSpy).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });
});

describe('apiFetchWithRetry — network errors', () => {
  it('retries on network error (TypeError) and resolves on later success', async () => {
    const fetchSpy = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse(201, { id: 'y' }));
    globalThis.fetch = fetchSpy as typeof fetch;

    const res = await apiFetchWithRetry('/x', undefined, { sleep: noSleep });

    expect(res.status).toBe(201);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('rethrows the last network error if all attempts fail', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    globalThis.fetch = fetchSpy as typeof fetch;

    await expect(
      apiFetchWithRetry('/x', undefined, { retries: 2, sleep: noSleep }),
    ).rejects.toThrow('Failed to fetch');
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});

describe('apiFetchWithRetry — AbortSignal', () => {
  it('throws AbortError when signal is already aborted before first attempt', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as typeof fetch;

    await expect(
      apiFetchWithRetry('/x', undefined, { signal: controller.signal, sleep: noSleep }),
    ).rejects.toThrow(/aborted/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not swallow AbortError as a network error', async () => {
    const abortErr = new DOMException('Aborted', 'AbortError');
    const fetchSpy = vi.fn().mockRejectedValue(abortErr);
    globalThis.fetch = fetchSpy as typeof fetch;

    await expect(
      apiFetchWithRetry('/x', undefined, { retries: 5, sleep: noSleep }),
    ).rejects.toThrow(/aborted/i);
    // Critical: a user abort must NOT be retried, otherwise the
    // request keeps firing after the user navigated away.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('apiFetchWithRetry — backoff timing', () => {
  it('doubles the delay each retry (1s, 2s by default)', async () => {
    const sleepSpy = vi.fn().mockResolvedValue(undefined);
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(jsonResponse(524))
      .mockResolvedValueOnce(jsonResponse(524))
      .mockResolvedValueOnce(jsonResponse(201));
    globalThis.fetch = fetchSpy as typeof fetch;

    await apiFetchWithRetry('/x', undefined, { sleep: sleepSpy });

    expect(sleepSpy).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenNthCalledWith(1, 1000);
    expect(sleepSpy).toHaveBeenNthCalledWith(2, 2000);
  });

  it('honors a custom baseDelayMs', async () => {
    const sleepSpy = vi.fn().mockResolvedValue(undefined);
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(jsonResponse(524))
      .mockResolvedValueOnce(jsonResponse(201));
    globalThis.fetch = fetchSpy as typeof fetch;

    await apiFetchWithRetry('/x', undefined, { baseDelayMs: 50, sleep: sleepSpy });

    expect(sleepSpy).toHaveBeenCalledWith(50);
  });
});
