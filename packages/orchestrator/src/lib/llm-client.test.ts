/**
 * Tests for runAgentLoop — force-completion and iteration-limit behaviour
 *
 * Key scenarios:
 * - Normal completion (no tool calls on first response) → returns text
 * - Tool calls followed by text response → returns final text
 * - Max iterations exhausted → forced final generation without tools
 * - Force-completion prompt injected at N-2 iterations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the Vercel AI SDK generateText so we can control LLM behaviour
// ---------------------------------------------------------------------------

const mockGenerateText = vi.fn();
vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  generateObject: vi.fn(),
  tool: vi.fn((def: unknown) => def),
}));

vi.mock('@ai-sdk/openai',    () => ({ openai:    vi.fn((m: string) => `openai:${m}`) }));
vi.mock('@ai-sdk/anthropic', () => ({ anthropic: vi.fn((m: string) => `anthropic:${m}`) }));
vi.mock('@ai-sdk/google',    () => ({ google:    vi.fn((m: string) => `google:${m}`) }));
vi.mock('@ai-sdk/groq',      () => ({
  createGroq: vi.fn(() => vi.fn((m: string) => `groq:${m}`)),
}));

vi.mock('./logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { runAgentLoop } = await import('./llm-client.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTextResult(text: string) {
  return {
    text,
    toolCalls: [],
    finishReason: 'stop',
    usage: { totalTokens: 100 },
  };
}

function makeToolCallResult(toolName: string, toolCallId: string, input: Record<string, unknown> = {}) {
  return {
    text: '',
    toolCalls: [{ toolCallId, toolName, input }],
    finishReason: 'tool_calls',
    usage: { totalTokens: 200 },
  };
}

const ECHO_TOOL = {
  description: 'echo tool',
  parameters: {},
  execute: vi.fn().mockResolvedValue({ result: 'tool output' }),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runAgentLoop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ECHO_TOOL.execute.mockResolvedValue({ result: 'tool output' });
  });

  it('returns text immediately when LLM responds with no tool calls', async () => {
    mockGenerateText.mockResolvedValueOnce(makeTextResult('{"scenes":[]}'));

    const result = await runAgentLoop('parse this script', {
      model: 'openai/gpt-4o',
      systemPrompt: 'You are a director.',
      maxIterations: 5,
    });

    expect(result).toBe('{"scenes":[]}');
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it('processes tool calls and returns final text response', async () => {
    mockGenerateText
      .mockResolvedValueOnce(makeToolCallResult('echo', 'tc-1'))
      .mockResolvedValueOnce(makeTextResult('{"scenes":[{"id":1}]}'));

    const result = await runAgentLoop('parse this script', {
      model: 'openai/gpt-4o',
      systemPrompt: 'You are a director.',
      tools: { echo: ECHO_TOOL },
      maxIterations: 5,
    });

    expect(result).toBe('{"scenes":[{"id":1}]}');
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
  });

  it('injects force-completion prompt at maxIterations - 2', async () => {
    // 3 iterations of tool calls, then text on final forced pass
    mockGenerateText
      .mockResolvedValueOnce(makeToolCallResult('echo', 'tc-1'))  // iter 1
      .mockResolvedValueOnce(makeToolCallResult('echo', 'tc-2'))  // iter 2 (N-2 triggers injection)
      .mockResolvedValueOnce(makeToolCallResult('echo', 'tc-3'))  // iter 3
      .mockResolvedValueOnce(makeToolCallResult('echo', 'tc-4'))  // iter 4 (maxIterations reached)
      .mockResolvedValueOnce(makeTextResult('{"forced":true}'));   // forced final pass

    const result = await runAgentLoop('parse', {
      model: 'openai/gpt-4o',
      systemPrompt: 'You are a director.',
      tools: { echo: ECHO_TOOL },
      maxIterations: 4,
    });

    // The forced final pass (call #5) is made without tools
    const lastCall = mockGenerateText.mock.calls[4][0];
    expect(lastCall).not.toHaveProperty('tools');

    expect(result).toBe('{"forced":true}');
  });

  it('returns empty string when forced final pass also produces no text', async () => {
    // Every call (including the forced one) returns tool calls or empty text
    mockGenerateText
      .mockResolvedValueOnce(makeToolCallResult('echo', 'tc-1'))
      .mockResolvedValueOnce(makeTextResult(''));  // forced final: empty

    const result = await runAgentLoop('parse', {
      model: 'openai/gpt-4o',
      systemPrompt: 'You are a director.',
      tools: { echo: ECHO_TOOL },
      maxIterations: 1,
    });

    expect(result).toBe('');
  });

  it('throws when an LLM API error occurs mid-loop', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('API rate limit'));

    await expect(
      runAgentLoop('parse', {
        model: 'openai/gpt-4o',
        systemPrompt: 'You are a director.',
        maxIterations: 3,
      })
    ).rejects.toThrow('API rate limit');
  });

  it('handles unknown tool gracefully and continues', async () => {
    mockGenerateText
      .mockResolvedValueOnce(makeToolCallResult('nonexistent_tool', 'tc-x'))
      .mockResolvedValueOnce(makeTextResult('{"recovered":true}'));

    const result = await runAgentLoop('parse', {
      model: 'openai/gpt-4o',
      systemPrompt: 'You are a director.',
      tools: {},  // no tools registered
      maxIterations: 5,
    });

    expect(result).toBe('{"recovered":true}');
  });

  it('uses maxIterations default of 20 when not specified', async () => {
    mockGenerateText.mockResolvedValueOnce(makeTextResult('done'));

    await runAgentLoop('parse', {
      model: 'openai/gpt-4o',
      systemPrompt: 'You are a director.',
    });

    // Should succeed with one call (no tool iteration needed)
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it('respects maxOutputTokens override for output iterations', async () => {
    // Tool call on iter 1, then maxIterations hit → forced final pass
    mockGenerateText
      .mockResolvedValueOnce(makeToolCallResult('echo', 'tc-1'))
      .mockResolvedValueOnce(makeTextResult('{"result":true}'));

    await runAgentLoop('parse', {
      model: 'openai/gpt-4o',
      systemPrompt: 'You are a director.',
      tools: { echo: ECHO_TOOL },
      maxIterations: 1,
      maxOutputTokens: 8192,  // small cap for groq-style models
    });

    // The forced final pass should use our cap, not 32768
    const forcedCall = mockGenerateText.mock.calls[1][0];
    expect(forcedCall.maxOutputTokens).toBe(8192);
  });

  it('defaults MAX_OUTPUT_TOKENS to 32768 when maxOutputTokens is not specified', async () => {
    mockGenerateText
      .mockResolvedValueOnce(makeToolCallResult('echo', 'tc-1'))
      .mockResolvedValueOnce(makeTextResult('{"result":true}'));

    await runAgentLoop('parse', {
      model: 'openai/gpt-4o',
      systemPrompt: 'You are a director.',
      tools: { echo: ECHO_TOOL },
      maxIterations: 1,
    });

    const forcedCall = mockGenerateText.mock.calls[1][0];
    expect(forcedCall.maxOutputTokens).toBe(32768);
  });
});
