/**
 * Tests for isTransientOrchestratorError — the classifier the queue worker
 * uses to decide whether a failed job is retryable.
 *
 * Pins the #320 (2026-06-17) addition: ElevenLabs 5xx and 429 are
 * transient, so the worker retries the whole job after backoff instead
 * of marking it terminally failed.
 */

import { describe, it, expect } from 'vitest';
import { isTransientOrchestratorError } from '@/lib/orchestrator-fetch';

describe('isTransientOrchestratorError', () => {
  describe('network-level', () => {
    it('treats TypeError (DNS/ECONNREFUSED) as transient', () => {
      expect(isTransientOrchestratorError(new TypeError('fetch failed'))).toBe(true);
    });

    it('treats fetch failed message as transient', () => {
      expect(isTransientOrchestratorError(new Error('fetch failed'))).toBe(true);
    });

    it('treats AbortError as transient', () => {
      const ab = Object.assign(new DOMException('aborted', 'AbortError'));
      expect(isTransientOrchestratorError(ab)).toBe(true);
    });
  });

  describe('HTTP status — own services', () => {
    it('502 / 503 / 504 / 408 are transient', () => {
      expect(isTransientOrchestratorError(new Error('HTTP 502 Bad Gateway'))).toBe(true);
      expect(isTransientOrchestratorError(new Error('HTTP 503 Service Unavailable'))).toBe(true);
      expect(isTransientOrchestratorError(new Error('HTTP 504 Gateway Timeout'))).toBe(true);
      expect(isTransientOrchestratorError(new Error('HTTP 408 Request Timeout'))).toBe(true);
    });

    it('400 / 401 / 403 / 404 are NOT transient', () => {
      expect(isTransientOrchestratorError(new Error('HTTP 400 Bad Request'))).toBe(false);
      expect(isTransientOrchestratorError(new Error('HTTP 401 Unauthorized'))).toBe(false);
      expect(isTransientOrchestratorError(new Error('HTTP 404 Not Found'))).toBe(false);
    });
  });

  describe('#320 — ElevenLabs upstream TTS provider errors', () => {
    it('treats "ElevenLabs TTS failed 500" as transient', () => {
      const msg = 'Orchestrator returned: ElevenLabs TTS failed 500: {"message":"internal_server_error"}';
      expect(isTransientOrchestratorError(new Error(msg))).toBe(true);
    });

    it('treats 502 / 503 / 504 ElevenLabs failures as transient', () => {
      expect(isTransientOrchestratorError(new Error('ElevenLabs TTS failed 502'))).toBe(true);
      expect(isTransientOrchestratorError(new Error('ElevenLabs TTS failed 503'))).toBe(true);
      expect(isTransientOrchestratorError(new Error('ElevenLabs TTS failed 504'))).toBe(true);
    });

    it('treats ElevenLabs 429 as transient (rate limiting)', () => {
      expect(isTransientOrchestratorError(new Error('ElevenLabs TTS failed 429: rate limited'))).toBe(true);
    });

    it('is case-insensitive (msg.toLowerCase())', () => {
      expect(isTransientOrchestratorError(new Error('elevenlabs tts failed 500'))).toBe(true);
      expect(isTransientOrchestratorError(new Error('ELEVENLABS TTS FAILED 503'))).toBe(true);
    });

    it('does NOT treat ElevenLabs 401 (bad API key) as transient', () => {
      expect(isTransientOrchestratorError(new Error('ElevenLabs TTS failed 401: Unauthorized'))).toBe(false);
    });

    it('does NOT treat ElevenLabs 402 (billing) as transient', () => {
      expect(isTransientOrchestratorError(new Error('ElevenLabs account billing issue (402)'))).toBe(false);
    });
  });

  describe('unrelated errors', () => {
    it('treats arbitrary strings as non-transient', () => {
      expect(isTransientOrchestratorError(new Error('some other failure'))).toBe(false);
    });

    it('treats non-Error values as non-transient', () => {
      expect(isTransientOrchestratorError('a string')).toBe(false);
      expect(isTransientOrchestratorError(null)).toBe(false);
      expect(isTransientOrchestratorError(undefined)).toBe(false);
      expect(isTransientOrchestratorError({ message: 'fetch failed' })).toBe(false);
    });
  });
});
