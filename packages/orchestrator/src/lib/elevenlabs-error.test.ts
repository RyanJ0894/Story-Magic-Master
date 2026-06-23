/**
 * Tests for the ElevenLabs error classifier (#378).
 *
 * Pins every sub-type the retry layer + Sentry tags depend on. If any
 * test in this file goes red, observability into ElevenLabs failures
 * regresses — we'd be back to "429" as an opaque blob.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { classifyElevenLabsError, parseRetryAfter } from './elevenlabs-error.js';

vi.mock('./logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('classifyElevenLabsError — 429 sub-types', () => {
  it('classifies structured system_busy as system_busy (no concurrency hint)', () => {
    const r = classifyElevenLabsError(429, JSON.stringify({
      detail: { status: 'system_busy', message: 'System is currently overloaded' },
    }));
    expect(r.kind).toBe('system_busy');
    expect(r.shouldLowerConcurrency).toBe(false);
    expect(r.matchedToken).toBe('system_busy');
  });

  it('classifies too_many_concurrent_requests with concurrency hint', () => {
    const r = classifyElevenLabsError(429, JSON.stringify({
      detail: { status: 'too_many_concurrent_requests', message: 'cap reached' },
    }));
    expect(r.kind).toBe('too_many_concurrent_requests');
    // Critical: this is the ONE kind that says "operator action: lower
    // TTS_CONCURRENCY". If this flips off, we lose the actionable signal
    // that distinguishes our architecture from their infra.
    expect(r.shouldLowerConcurrency).toBe(true);
  });

  it('classifies rate_limit_exceeded (minute-window) without concurrency hint', () => {
    const r = classifyElevenLabsError(429, JSON.stringify({
      detail: { status: 'rate_limit_exceeded', message: 'per-minute cap hit' },
    }));
    expect(r.kind).toBe('rate_limit_exceeded');
    expect(r.shouldLowerConcurrency).toBe(false);
  });

  it('classifies legacy "too_many_requests" token as rate_limit_exceeded', () => {
    const r = classifyElevenLabsError(429, JSON.stringify({
      detail: { status: 'too_many_requests' },
    }));
    expect(r.kind).toBe('rate_limit_exceeded');
  });
});

describe('classifyElevenLabsError — quota & billing', () => {
  it('classifies HTTP 402 as quota_exceeded regardless of body', () => {
    const r = classifyElevenLabsError(402, '');
    expect(r.kind).toBe('quota_exceeded');
  });

  it('classifies 429 with "quota_exceeded" token in body as quota_exceeded', () => {
    const r = classifyElevenLabsError(429, JSON.stringify({
      detail: { status: 'quota_exceeded', message: 'monthly cap reached' },
    }));
    expect(r.kind).toBe('quota_exceeded');
  });

  it('classifies "insufficient_quota" in body as quota_exceeded', () => {
    // OpenAI-style token sometimes proxied through other layers.
    const r = classifyElevenLabsError(429, JSON.stringify({
      detail: 'insufficient_quota: you have exhausted your character budget',
    }));
    expect(r.kind).toBe('quota_exceeded');
  });
});

describe('classifyElevenLabsError — voice not found', () => {
  it('classifies 404 with voice_not_found token as voice_not_found', () => {
    const r = classifyElevenLabsError(404, JSON.stringify({
      detail: { status: 'voice_not_found', message: 'A voice for the voice_id xxx was not found.' },
    }));
    expect(r.kind).toBe('voice_not_found');
    expect(r.shouldLowerConcurrency).toBe(false);
  });

  it('classifies legacy string detail "Voice not found" as voice_not_found', () => {
    const r = classifyElevenLabsError(404, JSON.stringify({
      detail: 'Voice not found',
    }));
    expect(r.kind).toBe('voice_not_found');
  });
});

describe('classifyElevenLabsError — upstream 5xx', () => {
  it('classifies bare 500 as upstream_5xx', () => {
    const r = classifyElevenLabsError(500, 'Internal Server Error');
    expect(r.kind).toBe('upstream_5xx');
  });

  it('classifies 502 / 503 / 504 the same way', () => {
    for (const status of [502, 503, 504]) {
      expect(classifyElevenLabsError(status, '').kind).toBe('upstream_5xx');
    }
  });

  it('5xx with structured body still classifies as upstream_5xx', () => {
    // ElevenLabs sometimes returns 500 with their own JSON; the operator
    // action is still the same (ride it out), so 5xx wins over body parse.
    const r = classifyElevenLabsError(500, JSON.stringify({ detail: { status: 'something_else' } }));
    expect(r.kind).toBe('upstream_5xx');
  });
});

describe('classifyElevenLabsError — unknown shapes', () => {
  it('falls through to "unknown" on HTML response body (CDN error page)', () => {
    const r = classifyElevenLabsError(429, '<!DOCTYPE html><html><title>524: Timeout</title></html>');
    expect(r.kind).toBe('unknown');
  });

  it('falls through to "unknown" on empty body for 4xx', () => {
    const r = classifyElevenLabsError(400, '');
    expect(r.kind).toBe('unknown');
  });

  it('does NOT throw on unparseable JSON', () => {
    // Garbage in, structured out — no exceptions allowed in the hot path.
    expect(() => classifyElevenLabsError(429, '{not valid json}')).not.toThrow();
  });
});

describe('parseRetryAfter — decimal seconds', () => {
  it('parses integer seconds', () => {
    expect(parseRetryAfter('30')).toBe(30_000);
  });

  it('parses fractional seconds', () => {
    expect(parseRetryAfter('1.5')).toBe(1500);
  });

  it('caps at maxCapMs (default 30s)', () => {
    expect(parseRetryAfter('3600')).toBe(30_000);
  });

  it('honors custom cap', () => {
    expect(parseRetryAfter('120', 60_000)).toBe(60_000);
  });

  it('returns 0 for "0" (immediately retryable)', () => {
    expect(parseRetryAfter('0')).toBe(0);
  });

  it('returns null for negative numbers', () => {
    expect(parseRetryAfter('-5')).toBeNull();
  });
});

describe('parseRetryAfter — HTTP-date', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('parses RFC-7231 IMF-fixdate ahead of now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-22T08:00:00Z'));
    const result = parseRetryAfter('Mon, 22 Jun 2026 08:00:15 GMT');
    expect(result).toBe(15_000);
  });

  it('returns 0 for a date in the past', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-22T08:00:00Z'));
    expect(parseRetryAfter('Mon, 22 Jun 2026 07:59:00 GMT')).toBe(0);
  });

  it('caps far-future dates at maxCapMs', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-22T08:00:00Z'));
    expect(parseRetryAfter('Mon, 22 Jun 2027 08:00:00 GMT')).toBe(30_000);
  });
});

describe('parseRetryAfter — edge cases', () => {
  it('returns null for null header', () => {
    expect(parseRetryAfter(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseRetryAfter('')).toBeNull();
  });

  it('returns null for whitespace-only', () => {
    expect(parseRetryAfter('   ')).toBeNull();
  });

  it('returns null for nonsense', () => {
    expect(parseRetryAfter('not-a-date-or-number')).toBeNull();
  });
});
