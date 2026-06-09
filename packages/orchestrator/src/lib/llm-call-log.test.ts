/**
 * Tests for the llm_call_log helpers (T3-4 of cost-opt Phase 2).
 *
 * Pins:
 *   - estimateCostUsd does the per-MT math correctly for each priced model
 *   - Missing model returns 0 (deliberate undercount policy)
 *   - Missing token counts treated as 0
 *   - recordLlmCall writes a row with the right shape
 *   - recordLlmCall swallows DB errors without throwing
 *   - LLM_CALL_LOG_DISABLED=true is honored
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));
vi.mock('./prisma.js', () => ({
  prisma: { llmCallLog: { create: mockCreate } },
}));
vi.mock('./logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { estimateCostUsd, recordLlmCall } from './llm-call-log.js';

describe('estimateCostUsd', () => {
  it('Anthropic Sonnet: $3 in / $15 out per MT', () => {
    // 1M input tokens = $3, 100k output tokens = $1.5
    expect(estimateCostUsd('anthropic/claude-sonnet-4-6', 1_000_000, 100_000)).toBeCloseTo(4.5, 5);
  });

  it('Anthropic Haiku: $0.80 in / $4 out per MT', () => {
    expect(estimateCostUsd('anthropic/claude-haiku-4-5', 1_000_000, 250_000)).toBeCloseTo(0.8 + 1.0, 5);
  });

  it('OpenAI gpt-4.1: $10 in / $30 out per MT', () => {
    expect(estimateCostUsd('openai/gpt-4.1', 500_000, 100_000)).toBeCloseTo(5 + 3, 5);
  });

  it('Groq Llama: cheap (~$0.59 in / $0.79 out per MT)', () => {
    const cost = estimateCostUsd('groq/llama-3.3-70b-versatile', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(0.59 + 0.79, 5);
  });

  it('OpenRouter Claude uses same rate as upstream Anthropic', () => {
    const direct = estimateCostUsd('anthropic/claude-sonnet-4-6', 100_000, 50_000);
    const viaOR = estimateCostUsd('openrouter/anthropic/claude-sonnet-4-6', 100_000, 50_000);
    expect(viaOR).toBeCloseTo(direct, 5);
  });

  it('Unknown model returns 0 (deliberate undercount, not invented price)', () => {
    expect(estimateCostUsd('made-up/model', 1_000_000, 1_000_000)).toBe(0);
  });

  it('Missing token counts treated as 0 (no NaN)', () => {
    expect(estimateCostUsd('openai/gpt-4.1', null, null)).toBe(0);
    expect(estimateCostUsd('openai/gpt-4.1', undefined, undefined)).toBe(0);
    // Only output known
    expect(estimateCostUsd('openai/gpt-4.1', null, 1_000_000)).toBeCloseTo(30, 5);
  });

  it('Zero token counts are not NaN (degenerate but valid)', () => {
    expect(estimateCostUsd('openai/gpt-4.1', 0, 0)).toBe(0);
  });
});

describe('recordLlmCall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LLM_CALL_LOG_DISABLED;
  });

  afterEach(() => {
    delete process.env.LLM_CALL_LOG_DISABLED;
  });

  it('writes a row with the expected fields including derived provider + cost', async () => {
    mockCreate.mockResolvedValueOnce({});
    await recordLlmCall({
      projectId: 'proj-1',
      operation: 'director-character-extraction',
      model: 'anthropic/claude-sonnet-4-6',
      inputTokens: 1000,
      outputTokens: 500,
      durationMs: 1234,
      succeeded: true,
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const { data } = mockCreate.mock.calls[0][0];
    expect(data.projectId).toBe('proj-1');
    expect(data.operation).toBe('director-character-extraction');
    expect(data.model).toBe('anthropic/claude-sonnet-4-6');
    expect(data.provider).toBe('anthropic');
    expect(data.inputTokens).toBe(1000);
    expect(data.outputTokens).toBe(500);
    expect(data.durationMs).toBe(1234);
    expect(data.succeeded).toBe(true);
    // 1000 input @ $3/MT + 500 output @ $15/MT
    expect(Number(data.costEstimateUsd)).toBeCloseTo(0.003 + 0.0075, 6);
  });

  it('writes provider=openrouter for openrouter/* models', async () => {
    mockCreate.mockResolvedValueOnce({});
    await recordLlmCall({
      operation: 'op',
      model: 'openrouter/anthropic/claude-sonnet-4-6',
      durationMs: 0,
      succeeded: true,
    });
    expect(mockCreate.mock.calls[0][0].data.provider).toBe('openrouter');
  });

  it('writes a failure row with errorMessage + succeeded=false', async () => {
    mockCreate.mockResolvedValueOnce({});
    await recordLlmCall({
      operation: 'op',
      model: 'anthropic/claude-sonnet-4-6',
      durationMs: 100,
      succeeded: false,
      errorMessage: 'rate limit exceeded',
    });
    const { data } = mockCreate.mock.calls[0][0];
    expect(data.succeeded).toBe(false);
    expect(data.errorMessage).toBe('rate limit exceeded');
  });

  it('swallows DB failures without throwing', async () => {
    mockCreate.mockRejectedValueOnce(new Error('connection refused'));
    await expect(
      recordLlmCall({
        operation: 'op',
        model: 'openai/gpt-4.1',
        durationMs: 0,
        succeeded: true,
      }),
    ).resolves.toBeUndefined();
  });

  it('skips DB call when LLM_CALL_LOG_DISABLED=true', async () => {
    process.env.LLM_CALL_LOG_DISABLED = 'true';
    await recordLlmCall({
      operation: 'op',
      model: 'openai/gpt-4.1',
      durationMs: 0,
      succeeded: true,
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('null/undefined optional fields write as null (not NaN, not "")', async () => {
    mockCreate.mockResolvedValueOnce({});
    await recordLlmCall({
      operation: 'op',
      model: 'openai/gpt-4.1',
      durationMs: 100,
      succeeded: true,
    });
    const { data } = mockCreate.mock.calls[0][0];
    expect(data.projectId).toBeNull();
    expect(data.inputTokens).toBeNull();
    expect(data.outputTokens).toBeNull();
    expect(data.errorMessage).toBeNull();
  });
});
