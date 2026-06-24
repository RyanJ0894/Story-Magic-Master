/**
 * Sanity-tests for the undici dispatcher init module.
 *
 * The actual undici behavior is tested by undici upstream — we just pin the
 * env-var contract so a future refactor can't silently drop the bump.
 *
 * Ryan's 77-page director call on 2026-06-24 failed three times at ~26 min
 * each because Node's default `headersTimeout` of 300_000 ms (5 min)
 * aborted Sonnet's response stream before it had a chance to start. The
 * module sets a 15-min default; the test guards the threshold.
 */

import { describe, it, expect } from 'vitest';
import {
  undiciDispatcherInitialized,
  UNDICI_HEADERS_TIMEOUT_MS,
  UNDICI_BODY_TIMEOUT_MS,
} from './undici-dispatcher.js';

describe('undici-dispatcher', () => {
  it('runs its side effect on import', () => {
    expect(undiciDispatcherInitialized).toBe(true);
  });

  it('uses defaults well above undici stock 300_000 ms so big LLM prompts have headroom', () => {
    // The 5 min default is what killed Ryan's run. 15 min default leaves
    // room for Sonnet on a 100-page prompt; we accept overrides via env.
    expect(UNDICI_HEADERS_TIMEOUT_MS).toBeGreaterThanOrEqual(900_000);
    expect(UNDICI_BODY_TIMEOUT_MS).toBeGreaterThanOrEqual(900_000);
  });
});
