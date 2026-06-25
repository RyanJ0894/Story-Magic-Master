/**
 * Tests for notifyJobUpdate — the worker → Postgres NOTIFY helper.
 *
 * The helper's contract:
 *   - Builds the channel name as `job:${jobId}` (single source of truth
 *     used by both NOTIFY and LISTEN)
 *   - Calls $executeRawUnsafe with `NOTIFY "channel"`
 *   - Returns true on success, false on any thrown error
 *   - Swallows errors so a NOTIFY failure cannot cascade into a pipeline failure
 *
 * The silent-failure rule is critical: every place that calls
 * notifyJobUpdate is in a hot path where throwing would mean a failed
 * generation. Pin the contract here so a future refactor can't drop it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecuteRawUnsafe } = vi.hoisted(() => ({
  mockExecuteRawUnsafe: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    $executeRawUnsafe: (...args: unknown[]) => mockExecuteRawUnsafe(...args),
  },
}));

import { notifyJobUpdate, jobChannelName } from '@/lib/realtime/notify-job-update';

beforeEach(() => {
  mockExecuteRawUnsafe.mockReset();
});

describe('jobChannelName', () => {
  it('produces a stable `job:{id}` format', () => {
    const id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    expect(jobChannelName(id)).toBe(`job:${id}`);
  });

  it('does not URL-encode or normalize the jobId — channel is what the worker emits', () => {
    // If the caller passed a non-UUID string, jobChannelName should still
    // produce a deterministic channel — UUID validation is a separate concern.
    expect(jobChannelName('abc-123')).toBe('job:abc-123');
  });
});

describe('notifyJobUpdate — happy path', () => {
  it('calls $executeRawUnsafe with the correctly quoted NOTIFY SQL', async () => {
    mockExecuteRawUnsafe.mockResolvedValue(1);
    const jobId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    const ok = await notifyJobUpdate(jobId);

    expect(ok).toBe(true);
    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(1);
    expect(mockExecuteRawUnsafe).toHaveBeenCalledWith(
      `NOTIFY "job:${jobId}"`,
    );
  });

  it('uses the same channel name as jobChannelName (single source of truth)', async () => {
    mockExecuteRawUnsafe.mockResolvedValue(1);
    const jobId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    await notifyJobUpdate(jobId);

    expect(mockExecuteRawUnsafe).toHaveBeenCalledWith(
      `NOTIFY "${jobChannelName(jobId)}"`,
    );
  });
});

describe('notifyJobUpdate — silent-failure contract', () => {
  // These tests pin the rule: NOTIFY failure must NEVER throw out of the
  // helper. Every callsite is in a worker hot-path; a thrown NOTIFY would
  // turn a real progress write into a failed generation.

  it('returns false (not throws) when the DB query rejects', async () => {
    mockExecuteRawUnsafe.mockRejectedValue(new Error('connection refused'));

    const ok = await notifyJobUpdate('any-id');

    expect(ok).toBe(false);
  });

  it('returns false (not throws) on a synchronous throw from the query layer', async () => {
    mockExecuteRawUnsafe.mockImplementation(() => {
      throw new Error('synchronous explosion');
    });

    const ok = await notifyJobUpdate('any-id');

    expect(ok).toBe(false);
  });

  it('survives a non-Error throw (defensive)', async () => {
    mockExecuteRawUnsafe.mockRejectedValue('not even an Error');

    const ok = await notifyJobUpdate('any-id');

    expect(ok).toBe(false);
  });
});
