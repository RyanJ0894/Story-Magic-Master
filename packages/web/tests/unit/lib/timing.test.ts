/**
 * H1 — handler timing instrumentation tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: vi.fn(),
  captureMessage: vi.fn(),
}));

import { recordTiming, SLOW_THRESHOLD_MS, STUCK_THRESHOLD_MS } from '@/lib/api/timing';
import { addBreadcrumb, captureMessage } from '@sentry/nextjs';

const mockBreadcrumb = addBreadcrumb as ReturnType<typeof vi.fn>;
const mockCapture = captureMessage as ReturnType<typeof vi.fn>;

describe('recordTiming', () => {
  beforeEach(() => vi.clearAllMocks());

  it('always drops a Sentry breadcrumb (info on fast)', () => {
    recordTiming({ route: '/api/x', method: 'GET', duration_ms: 50, status: 200 });
    expect(mockBreadcrumb).toHaveBeenCalledTimes(1);
    expect(mockBreadcrumb.mock.calls[0][0]).toMatchObject({
      category: 'http.handler',
      level: 'info',
      data: { route: '/api/x', method: 'GET', duration_ms: 50, status: 200 },
    });
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('captures a warning when duration crosses the slow threshold', () => {
    recordTiming({ route: '/api/score', method: 'GET', duration_ms: SLOW_THRESHOLD_MS + 1, status: 200 });
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture.mock.calls[0][1]).toMatchObject({
      level: 'warning',
      tags: { kind: 'handler-slow', route: '/api/score', method: 'GET' },
    });
  });

  it('captures an error when duration crosses the stuck threshold', () => {
    recordTiming({ route: '/api/projects/upload', method: 'POST', duration_ms: STUCK_THRESHOLD_MS + 1, status: 504 });
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture.mock.calls[0][1]).toMatchObject({
      level: 'error',
      tags: { kind: 'handler-stuck', route: '/api/projects/upload', method: 'POST' },
    });
  });

  it('breadcrumb level matches the captureMessage level on slow paths', () => {
    recordTiming({ route: '/api/x', method: 'GET', duration_ms: SLOW_THRESHOLD_MS + 100, status: 200 });
    expect(mockBreadcrumb.mock.calls[0][0].level).toBe('warning');
  });

  it('breadcrumb level escalates to error on stuck paths', () => {
    recordTiming({ route: '/api/x', method: 'GET', duration_ms: STUCK_THRESHOLD_MS + 100, status: 200 });
    expect(mockBreadcrumb.mock.calls[0][0].level).toBe('error');
  });
});
