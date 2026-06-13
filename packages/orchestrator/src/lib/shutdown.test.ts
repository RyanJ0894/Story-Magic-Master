/**
 * H7 — Tests for quiescent shutdown.
 *
 * Exercises the middleware + drain logic in isolation. Uses a stub
 * Server with a controllable close() so we don't have to bind a real
 * port.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Server } from 'http';
import { trackInFlight, quiescentShutdown, _resetForTests, _getState } from './shutdown.js';

function makeServer(): Server {
  const closeListeners: Array<() => void> = [];
  return {
    close: (cb?: () => void) => {
      // Defer to next tick to simulate real server.close behavior.
      setImmediate(() => {
        closeListeners.forEach((fn) => fn());
        if (cb) cb();
      });
    },
  } as unknown as Server;
}

function makeReqRes(path: string) {
  const finishListeners: Array<() => void> = [];
  const closeListeners: Array<() => void> = [];
  const req = { path } as any;
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body: any = undefined;
  const res = {
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (b: any) => {
      body = b;
    },
    on: (evt: string, fn: () => void) => {
      if (evt === 'finish') finishListeners.push(fn);
      if (evt === 'close') closeListeners.push(fn);
    },
    _finish: () => finishListeners.forEach((fn) => fn()),
    _close: () => closeListeners.forEach((fn) => fn()),
    _statusCode: () => statusCode,
    _body: () => body,
    _headers: () => headers,
  };
  return { req, res };
}

describe('trackInFlight middleware', () => {
  beforeEach(() => {
    _resetForTests();
  });

  it('skips short routes (does not count /health toward in-flight)', () => {
    const { req, res } = makeReqRes('/health');
    const next = vi.fn();
    trackInFlight(req, res as any, next);
    expect(next).toHaveBeenCalled();
    expect(_getState().inFlight).toBe(0);
  });

  it('counts long routes (/orchestrate) toward in-flight', () => {
    const { req, res } = makeReqRes('/orchestrate');
    const next = vi.fn();
    trackInFlight(req, res as any, next);
    expect(next).toHaveBeenCalled();
    expect(_getState().inFlight).toBe(1);
  });

  it('decrements on response finish', () => {
    const { req, res } = makeReqRes('/orchestrate');
    trackInFlight(req, res as any, vi.fn());
    expect(_getState().inFlight).toBe(1);
    (res as any)._finish();
    expect(_getState().inFlight).toBe(0);
  });

  it('does not double-decrement when finish AND close both fire', () => {
    const { req, res } = makeReqRes('/orchestrate');
    trackInFlight(req, res as any, vi.fn());
    (res as any)._finish();
    (res as any)._close();
    expect(_getState().inFlight).toBe(0);
  });
});

describe('quiescentShutdown', () => {
  beforeEach(() => {
    _resetForTests();
  });

  it('returns immediately when no requests are in flight', async () => {
    const server = makeServer();
    const exitCode = await quiescentShutdown(server);
    expect(exitCode).toBe(0);
    expect(_getState().draining).toBe(true);
  });

  it('rejects new long-running requests with 503 once draining', async () => {
    const server = makeServer();
    // Start shutdown — no inflight, so it resolves quickly.
    await quiescentShutdown(server);

    const { req, res } = makeReqRes('/orchestrate');
    const next = vi.fn();
    trackInFlight(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect((res as any)._statusCode()).toBe(503);
    expect((res as any)._headers()['Retry-After']).toBe('30');
    expect((res as any)._body()).toEqual({ error: 'service_draining', message: expect.any(String) });
  });

  it('waits for in-flight to finish before closing', async () => {
    const server = makeServer();
    const { req, res } = makeReqRes('/orchestrate');
    trackInFlight(req, res as any, vi.fn());
    expect(_getState().inFlight).toBe(1);

    let resolved = false;
    const shutdownPromise = quiescentShutdown(server).then((code) => {
      resolved = true;
      return code;
    });

    // Give the microtask queue a chance — should still be waiting.
    await new Promise((r) => setImmediate(r));
    expect(resolved).toBe(false);

    // Simulate the long-running request finishing.
    (res as any)._finish();

    const exitCode = await shutdownPromise;
    expect(exitCode).toBe(0);
    expect(resolved).toBe(true);
  });

  it('exits with code 1 if drain times out', async () => {
    process.env.SHUTDOWN_DRAIN_MS = '50';
    // Re-import to pick up the new timeout.
    vi.resetModules();
    const { trackInFlight: trackFresh, quiescentShutdown: shutdownFresh, _resetForTests: resetFresh } =
      await import('./shutdown.js');
    resetFresh();

    const server = makeServer();
    const { req, res } = makeReqRes('/orchestrate');
    trackFresh(req, res as any, vi.fn());

    const exitCode = await shutdownFresh(server);
    expect(exitCode).toBe(1);

    // Cleanup: don't leak the held in-flight slot to other tests.
    (res as any)._finish();
    delete process.env.SHUTDOWN_DRAIN_MS;
  });
});
