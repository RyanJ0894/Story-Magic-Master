/**
 * Tests for the LISTEN-client pool.
 *
 * The pool's contract:
 *   - Each open call returns a handle with a `close()` that releases the connection
 *   - Counter increments only AFTER successful connect
 *   - Counter decrements on close (and only once — idempotent close)
 *   - When the budget is exhausted, openJobListenClient throws and the
 *     SSE endpoint returns 503 → client falls back to polling
 *   - Initial LISTEN failure rolls back the counter increment
 *
 * The pool is module-level state. Tests use the `_resetListenerCountForTesting`
 * escape hatch between cases to normalize.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockConnect, mockQuery, mockEnd, mockOn, ClientCtorCalls } = vi.hoisted(() => ({
  mockConnect: vi.fn(),
  mockQuery: vi.fn(),
  mockEnd: vi.fn(),
  mockOn: vi.fn(),
  ClientCtorCalls: [] as Array<{ connectionString: string }>,
}));

vi.mock('pg', () => {
  class MockClient {
    constructor(config: { connectionString: string }) {
      ClientCtorCalls.push(config);
    }
    connect = mockConnect;
    query = mockQuery;
    end = mockEnd;
    on = mockOn;
  }
  return { Client: MockClient };
});

import {
  openJobListenClient,
  listenerBudgetExhausted,
  getActiveListenerCount,
  _resetListenerCountForTesting,
} from '@/lib/realtime/job-listen-pool';

const ORIG_DATABASE_URL = process.env.DATABASE_URL;

beforeEach(() => {
  mockConnect.mockReset().mockResolvedValue(undefined);
  mockQuery.mockReset().mockResolvedValue({ rows: [] });
  mockEnd.mockReset().mockResolvedValue(undefined);
  mockOn.mockReset();
  ClientCtorCalls.length = 0;
  _resetListenerCountForTesting();
  process.env.DATABASE_URL = 'postgresql://test/test';
});

describe('openJobListenClient — happy path', () => {
  it('connects, registers LISTEN, and increments the active counter', async () => {
    const handle = await openJobListenClient({
      jobId: 'aaaa-bbbb-cccc',
      onNotify: () => {},
    });

    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith('LISTEN "job:aaaa-bbbb-cccc"');
    expect(getActiveListenerCount()).toBe(1);
    expect(typeof handle.close).toBe('function');
  });

  it('subscribes to notification events on the pg client', async () => {
    await openJobListenClient({
      jobId: 'aaaa',
      onNotify: () => {},
    });

    // `on('notification', ...)` is the wire that delivers NOTIFY to our handler.
    const onCalls = mockOn.mock.calls.map((c) => c[0]);
    expect(onCalls).toContain('notification');
    expect(onCalls).toContain('error');
  });

  it('close() runs UNLISTEN, ends the client, and decrements the counter', async () => {
    const handle = await openJobListenClient({ jobId: 'jid', onNotify: () => {} });
    expect(getActiveListenerCount()).toBe(1);

    await handle.close();

    expect(mockQuery).toHaveBeenCalledWith('UNLISTEN "job:jid"');
    expect(mockEnd).toHaveBeenCalledTimes(1);
    expect(getActiveListenerCount()).toBe(0);
  });

  it('close() is idempotent — second call is a no-op', async () => {
    const handle = await openJobListenClient({ jobId: 'jid', onNotify: () => {} });
    await handle.close();
    await handle.close();

    expect(mockEnd).toHaveBeenCalledTimes(1); // not 2
    expect(getActiveListenerCount()).toBe(0); // not -1
  });
});

describe('openJobListenClient — failure paths', () => {
  it('throws if DATABASE_URL is unset', async () => {
    delete process.env.DATABASE_URL;
    await expect(
      openJobListenClient({ jobId: 'x', onNotify: () => {} }),
    ).rejects.toThrow(/DATABASE_URL/);
    process.env.DATABASE_URL = ORIG_DATABASE_URL; // restore
  });

  it('does not increment the counter if connect fails', async () => {
    mockConnect.mockRejectedValueOnce(new Error('connect refused'));
    await expect(
      openJobListenClient({ jobId: 'x', onNotify: () => {} }),
    ).rejects.toThrow(/connect refused/);
    expect(getActiveListenerCount()).toBe(0);
  });

  it('rolls back the counter increment if LISTEN query fails', async () => {
    // Make the LISTEN query throw but connect succeed. We have to fail on
    // the SECOND query (the first is the LISTEN itself; there's only one).
    mockQuery.mockRejectedValueOnce(new Error('listen failed'));

    await expect(
      openJobListenClient({ jobId: 'x', onNotify: () => {} }),
    ).rejects.toThrow(/listen failed/);

    expect(getActiveListenerCount()).toBe(0);
    expect(mockEnd).toHaveBeenCalledTimes(1); // pg client was released
  });
});

describe('budget exhaustion', () => {
  it('reports budget-exhausted false on a fresh pool', () => {
    expect(listenerBudgetExhausted()).toBe(false);
  });

  it('throws a budget error when MAX_SSE_LISTENERS is reached', async () => {
    // Default cap is 16. Open 16, then try a 17th.
    const handles = [];
    for (let i = 0; i < 16; i++) {
      handles.push(await openJobListenClient({ jobId: `job-${i}`, onNotify: () => {} }));
    }
    expect(getActiveListenerCount()).toBe(16);
    expect(listenerBudgetExhausted()).toBe(true);

    await expect(
      openJobListenClient({ jobId: 'overflow', onNotify: () => {} }),
    ).rejects.toThrow(/budget exhausted/);

    // Closing a handle frees up budget for the next request.
    await handles[0].close();
    expect(listenerBudgetExhausted()).toBe(false);
  });
});
