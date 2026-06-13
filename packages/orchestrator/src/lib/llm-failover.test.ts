/**
 * Tests for the LLM failover primitives (buildFailoverChain + isFailoverableError).
 *
 * These gate production resilience: runAgentLoop and generateStructuredOutput
 * advance through the chain only on provider-side failures (billing/rate-limit/
 * overload), and must NOT retry client errors (400/401) that fail everywhere.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildFailoverChain, isFailoverableError } from './llm-client.js';

describe('buildFailoverChain', () => {
  const ORIG = { ...process.env };
  beforeEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });
  afterEach(() => {
    process.env = { ...ORIG };
  });

  // T3-3 (#186 follow-up): the OpenRouter slot now routes Claude THROUGH
  // OpenRouter (keeping quality + cost aligned), not OpenAI. Previously the
  // slot was `openrouter/openai/gpt-4.1` which was just GPT-4.1 in disguise.
  it('anthropic → openrouter-Claude → openai when both keys present', () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test';
    process.env.OPENAI_API_KEY = 'sk-test';
    expect(buildFailoverChain('anthropic/claude-sonnet-4-6')).toEqual([
      'openrouter/anthropic/claude-sonnet-4-6',
      'openai/gpt-4.1',
    ]);
  });

  it('anthropic → openrouter-Claude only when OpenAI key is absent', () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test';
    expect(buildFailoverChain('anthropic/claude-sonnet-4-6')).toEqual([
      'openrouter/anthropic/claude-sonnet-4-6',
    ]);
  });

  it('anthropic → openai only when OpenRouter key is absent', () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    expect(buildFailoverChain('anthropic/claude-sonnet-4-6')).toEqual(['openai/gpt-4.1']);
  });

  it('anthropic → empty when neither key is set (Anthropic-only deployment)', () => {
    expect(buildFailoverChain('anthropic/claude-sonnet-4-6')).toEqual([]);
  });

  it('relief valve preserves the EXACT same Claude model (Haiku stays Haiku)', () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test';
    expect(buildFailoverChain('anthropic/claude-haiku-4-5')).toEqual([
      'openrouter/anthropic/claude-haiku-4-5',
    ]);
    expect(buildFailoverChain('anthropic/claude-opus-4-6')).toEqual([
      'openrouter/anthropic/claude-opus-4-6',
    ]);
  });

  it('openrouter → openai when OpenAI key is present', () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    expect(buildFailoverChain('openrouter/openai/gpt-4.1')).toEqual(['openai/gpt-4.1']);
  });

  it('openrouter → empty when OpenAI key is absent', () => {
    expect(buildFailoverChain('openrouter/openai/gpt-4.1')).toEqual([]);
  });

  // #215: OpenAI primaries previously returned [] — when the OpenAI key
  // was quota-exhausted, the AI SDK retried 3× and threw, with no fallback.
  // Ryan saw "Loads and loads" of the same error in logs. Same chain shape
  // as anthropic, just inverted: relief valve via OpenRouter, last resort
  // via direct Anthropic.
  describe('openai primary failover (#215)', () => {
    it('openai → openrouter-Claude → anthropic when both keys present', () => {
      process.env.OPENROUTER_API_KEY = 'sk-or-test';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      expect(buildFailoverChain('openai/gpt-4o')).toEqual([
        'openrouter/anthropic/claude-sonnet-4-6',
        'anthropic/claude-sonnet-4-6',
      ]);
    });

    it('openai → openrouter-Claude only when Anthropic key is absent', () => {
      process.env.OPENROUTER_API_KEY = 'sk-or-test';
      expect(buildFailoverChain('openai/gpt-4o')).toEqual([
        'openrouter/anthropic/claude-sonnet-4-6',
      ]);
    });

    it('openai → anthropic only when OpenRouter key is absent', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      expect(buildFailoverChain('openai/gpt-4o')).toEqual([
        'anthropic/claude-sonnet-4-6',
      ]);
    });

    it('openai → empty when neither relief key is set (OpenAI-only deployment)', () => {
      expect(buildFailoverChain('openai/gpt-4o')).toEqual([]);
    });
  });

  it('non-failover providers have no fallback', () => {
    expect(buildFailoverChain('groq/llama-3.3-70b-versatile')).toEqual([]);
    expect(buildFailoverChain('google/gemini-1.5-pro')).toEqual([]);
  });
});

describe('isFailoverableError', () => {
  it('true for Anthropic billing / credit exhaustion messages', () => {
    expect(isFailoverableError(new Error('Your credit balance is too low'))).toBe(true);
    expect(isFailoverableError(new Error('insufficient_credits'))).toBe(true);
    expect(isFailoverableError(new Error('billing hard limit reached'))).toBe(true);
  });

  it('true for rate-limit / overload phrasing', () => {
    expect(isFailoverableError(new Error('rate limit exceeded'))).toBe(true);
    expect(isFailoverableError(new Error('Too Many Requests'))).toBe(true);
    expect(isFailoverableError(new Error('the model is overloaded'))).toBe(true);
  });

  it('true for provider HTTP status codes in the message', () => {
    expect(isFailoverableError(new Error('Request failed with status 429'))).toBe(true);
    expect(isFailoverableError(new Error('529 overloaded'))).toBe(true);
    expect(isFailoverableError(new Error('payment required (402)'))).toBe(true);
  });

  it('true when statusCode property is 402/429/529 (AI SDK APICallError)', () => {
    expect(isFailoverableError(Object.assign(new Error('x'), { statusCode: 402 }))).toBe(true);
    expect(isFailoverableError(Object.assign(new Error('x'), { statusCode: 429 }))).toBe(true);
    expect(isFailoverableError(Object.assign(new Error('x'), { statusCode: 529 }))).toBe(true);
  });

  it('false for client errors that fail on every provider', () => {
    expect(isFailoverableError(new Error('400 bad request'))).toBe(false);
    expect(isFailoverableError(new Error('401 unauthorized'))).toBe(false);
    expect(isFailoverableError(Object.assign(new Error('x'), { statusCode: 400 }))).toBe(false);
    expect(isFailoverableError(new Error('context length exceeded'))).toBe(false);
  });

  it('false for non-Error values', () => {
    expect(isFailoverableError('rate limit')).toBe(false);
    expect(isFailoverableError(null)).toBe(false);
    expect(isFailoverableError(undefined)).toBe(false);
  });
});
