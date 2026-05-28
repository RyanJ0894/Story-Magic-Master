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
  });
  afterEach(() => {
    process.env = { ...ORIG };
  });

  it('anthropic → openrouter → openai when OpenRouter key is present', () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test';
    expect(buildFailoverChain('anthropic/claude-sonnet-4-6')).toEqual([
      'openrouter/openai/gpt-4.1',
      'openai/gpt-4.1',
    ]);
  });

  it('anthropic → openai only when OpenRouter key is absent', () => {
    expect(buildFailoverChain('anthropic/claude-sonnet-4-6')).toEqual(['openai/gpt-4.1']);
  });

  it('openrouter → openai when OpenAI key is present', () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    expect(buildFailoverChain('openrouter/openai/gpt-4.1')).toEqual(['openai/gpt-4.1']);
  });

  it('openrouter → empty when OpenAI key is absent', () => {
    expect(buildFailoverChain('openrouter/openai/gpt-4.1')).toEqual([]);
  });

  it('non-failover providers have no fallback', () => {
    expect(buildFailoverChain('openai/gpt-4.1')).toEqual([]);
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
