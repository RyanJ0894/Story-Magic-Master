import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must be defined BEFORE the import-under-test because vi.mock is hoisted.
vi.mock('./logger.js', () => ({
  log: { warn: vi.fn(), debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock('./sentry.js', () => ({
  Sentry: { addBreadcrumb: vi.fn() },
}));

import { dedupedWarn } from './dedup-logger.js';
import { log } from './logger.js';
import { Sentry } from './sentry.js';

const logWarn = log.warn as ReturnType<typeof vi.fn>;
const logDebug = log.debug as ReturnType<typeof vi.fn>;
const addBreadcrumb = Sentry.addBreadcrumb as ReturnType<typeof vi.fn>;

describe('dedupedWarn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  // Module-level dedup state persists across tests, so each test uses a
  // unique category to isolate its bucket.
  it('warns on the first call and writes a breadcrumb', () => {
    dedupedWarn('first-call', 'first', { x: 1 });
    expect(logWarn).toHaveBeenCalledTimes(1);
    expect(logWarn).toHaveBeenCalledWith('first', { category: 'first-call', x: 1 });
    expect(addBreadcrumb).toHaveBeenCalledTimes(1);
  });

  it('suppresses subsequent warns inside the window but still emits debug', () => {
    dedupedWarn('suppress-test', 'first');
    logWarn.mockClear();
    logDebug.mockClear();
    addBreadcrumb.mockClear();

    dedupedWarn('suppress-test', 'second');
    dedupedWarn('suppress-test', 'third');

    expect(logWarn).not.toHaveBeenCalled();
    expect(logDebug).toHaveBeenCalledTimes(2);
    expect(addBreadcrumb).not.toHaveBeenCalled();
  });

  it('warns again after the window passes, with the suppressed count', () => {
    dedupedWarn('window-test', 'first');
    dedupedWarn('window-test', 'second');
    dedupedWarn('window-test', 'third');
    logWarn.mockClear();

    vi.advanceTimersByTime(61_000);
    dedupedWarn('window-test', 'fourth');

    expect(logWarn).toHaveBeenCalledTimes(1);
    // The fourth call should report that 2 calls were suppressed before it.
    expect(logWarn.mock.calls[0][0]).toMatch(/\+2 suppressed/);
  });

  it('treats different categories independently', () => {
    dedupedWarn('cat-a', 'one');
    dedupedWarn('cat-b', 'two');
    expect(logWarn).toHaveBeenCalledTimes(2);
  });

  it('honors a custom window', () => {
    dedupedWarn('custom-window', 'first', {}, 1_000);
    vi.advanceTimersByTime(500);
    dedupedWarn('custom-window', 'inside-window', {}, 1_000);
    expect(logWarn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(600);
    dedupedWarn('custom-window', 'after-window', {}, 1_000);
    expect(logWarn).toHaveBeenCalledTimes(2);
  });
});
