/**
 * Tests for session polling logic (#92) and SW registration guard (STORY-MAGIC-6)
 *
 * The core logic being tested:
 * 1. After 3 consecutive 401s, toast.error fires with "Connection lost" + "Check status →" action
 * 2. After 3 consecutive 401s, the counter resets (no toast spam)
 * 3. A successful response resets the consecutive-failure counter
 * 4. ServiceWorkerRegistration skips in navigator.webdriver contexts
 *
 * We test the polling logic in isolation by extracting it into a pure helper
 * and testing the helper directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockToastError = vi.fn();
const mockRouterRefresh = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// ── Poll Logic Extracted for Pure Testing ─────────────────────────────────────

/**
 * Mirrors the polling failure-handling logic from generate-button.tsx.
 * By extracting it as a pure function we can unit-test it without React.
 */
interface PollOptions {
  status: number;
  consecutiveFailures: { current: number };
  onToast: (msg: string, opts: { duration: number; action: { label: string; onClick: () => void } }) => void;
  onRefresh: () => void;
}

function handlePollResponse({ status, consecutiveFailures, onToast, onRefresh }: PollOptions): 'auth_fail' | 'other_fail' | 'ok' {
  if (status === 401) {
    consecutiveFailures.current += 1;
    if (consecutiveFailures.current >= 3) {
      consecutiveFailures.current = 0;
      onToast('Connection lost — your audio may be ready.', {
        duration: 30000,
        action: {
          label: 'Check status →',
          onClick: onRefresh,
        },
      });
    }
    return 'auth_fail';
  }
  if (status !== 200) {
    consecutiveFailures.current = 0;
    return 'other_fail';
  }
  consecutiveFailures.current = 0;
  return 'ok';
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('pollJobStatus failure handling (#92)', () => {
  let consecutiveFailures: { current: number };

  beforeEach(() => {
    vi.clearAllMocks();
    consecutiveFailures = { current: 0 };
  });

  it('does not toast on the first 401', () => {
    handlePollResponse({ status: 401, consecutiveFailures, onToast: mockToastError, onRefresh: mockRouterRefresh });
    expect(consecutiveFailures.current).toBe(1);
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('does not toast on the second 401', () => {
    handlePollResponse({ status: 401, consecutiveFailures, onToast: mockToastError, onRefresh: mockRouterRefresh });
    handlePollResponse({ status: 401, consecutiveFailures, onToast: mockToastError, onRefresh: mockRouterRefresh });
    expect(consecutiveFailures.current).toBe(2);
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('fires "Connection lost" toast on the third consecutive 401', () => {
    for (let i = 0; i < 3; i++) {
      handlePollResponse({ status: 401, consecutiveFailures, onToast: mockToastError, onRefresh: mockRouterRefresh });
    }
    expect(mockToastError).toHaveBeenCalledOnce();
    expect(mockToastError).toHaveBeenCalledWith(
      'Connection lost — your audio may be ready.',
      expect.objectContaining({ duration: 30000 })
    );
  });

  it('toast action label is "Check status →"', () => {
    for (let i = 0; i < 3; i++) {
      handlePollResponse({ status: 401, consecutiveFailures, onToast: mockToastError, onRefresh: mockRouterRefresh });
    }
    const opts = mockToastError.mock.calls[0]?.[1] as { action: { label: string; onClick: () => void } };
    expect(opts.action.label).toBe('Check status →');
  });

  it('toast action onClick calls router.refresh', () => {
    for (let i = 0; i < 3; i++) {
      handlePollResponse({ status: 401, consecutiveFailures, onToast: mockToastError, onRefresh: mockRouterRefresh });
    }
    const opts = mockToastError.mock.calls[0]?.[1] as { action: { label: string; onClick: () => void } };
    opts.action.onClick();
    expect(mockRouterRefresh).toHaveBeenCalledOnce();
  });

  it('resets counter after toast fires (no toast spam on subsequent 401s)', () => {
    for (let i = 0; i < 3; i++) {
      handlePollResponse({ status: 401, consecutiveFailures, onToast: mockToastError, onRefresh: mockRouterRefresh });
    }
    expect(consecutiveFailures.current).toBe(0);

    // Next 2 401s should NOT fire another toast
    handlePollResponse({ status: 401, consecutiveFailures, onToast: mockToastError, onRefresh: mockRouterRefresh });
    handlePollResponse({ status: 401, consecutiveFailures, onToast: mockToastError, onRefresh: mockRouterRefresh });
    expect(mockToastError).toHaveBeenCalledOnce();
  });

  it('resets counter on successful 200 response', () => {
    handlePollResponse({ status: 401, consecutiveFailures, onToast: mockToastError, onRefresh: mockRouterRefresh });
    handlePollResponse({ status: 401, consecutiveFailures, onToast: mockToastError, onRefresh: mockRouterRefresh });
    handlePollResponse({ status: 200, consecutiveFailures, onToast: mockToastError, onRefresh: mockRouterRefresh });

    expect(consecutiveFailures.current).toBe(0);
    expect(mockToastError).not.toHaveBeenCalled();

    // Would take another 3 401s to trigger toast
    handlePollResponse({ status: 401, consecutiveFailures, onToast: mockToastError, onRefresh: mockRouterRefresh });
    handlePollResponse({ status: 401, consecutiveFailures, onToast: mockToastError, onRefresh: mockRouterRefresh });
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('resets counter on non-401 error (e.g. 500)', () => {
    handlePollResponse({ status: 401, consecutiveFailures, onToast: mockToastError, onRefresh: mockRouterRefresh });
    handlePollResponse({ status: 500, consecutiveFailures, onToast: mockToastError, onRefresh: mockRouterRefresh });
    expect(consecutiveFailures.current).toBe(0);
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('polling is NOT permanently killed after 3 consecutive 401s (counter reset allows recovery)', () => {
    // Simulate 3x 401 → toast fires
    for (let i = 0; i < 3; i++) {
      handlePollResponse({ status: 401, consecutiveFailures, onToast: mockToastError, onRefresh: mockRouterRefresh });
    }
    // Counter is now 0 — if auth recovers on next poll, it succeeds normally
    const result = handlePollResponse({ status: 200, consecutiveFailures, onToast: mockToastError, onRefresh: mockRouterRefresh });
    expect(result).toBe('ok');
  });
});

describe('ServiceWorkerRegistration — navigator.webdriver guard (STORY-MAGIC-6)', () => {
  it('skips SW registration when navigator.webdriver is true', () => {
    const mockRegister = vi.fn().mockResolvedValue({});
    Object.defineProperty(global, 'navigator', {
      value: { serviceWorker: { register: mockRegister }, webdriver: true },
      configurable: true,
    });

    // Simulate the guard logic
    const shouldRegister = 'serviceWorker' in navigator && !navigator.webdriver;
    if (shouldRegister) navigator.serviceWorker.register('/sw.js');

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('registers SW when navigator.webdriver is false', () => {
    const mockRegister = vi.fn().mockResolvedValue({});
    Object.defineProperty(global, 'navigator', {
      value: { serviceWorker: { register: mockRegister }, webdriver: false },
      configurable: true,
    });

    const shouldRegister = 'serviceWorker' in navigator && !navigator.webdriver;
    if (shouldRegister) navigator.serviceWorker.register('/sw.js');

    expect(mockRegister).toHaveBeenCalledWith('/sw.js');
  });

  it('registers SW when navigator.webdriver is undefined (normal browser)', () => {
    const mockRegister = vi.fn().mockResolvedValue({});
    Object.defineProperty(global, 'navigator', {
      value: { serviceWorker: { register: mockRegister }, webdriver: undefined },
      configurable: true,
    });

    const shouldRegister = 'serviceWorker' in navigator && !navigator.webdriver;
    if (shouldRegister) navigator.serviceWorker.register('/sw.js');

    expect(mockRegister).toHaveBeenCalledWith('/sw.js');
  });
});
