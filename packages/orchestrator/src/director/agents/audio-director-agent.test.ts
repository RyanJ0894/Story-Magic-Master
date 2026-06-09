/**
 * Tests for AudioDirectorAgent — model selection contract.
 *
 * Pins the cost-optimized default: audio search is tool-heavy but each per-call
 * decision is shallow, so Haiku 4.5 is the right tradeoff (mirrors PR #179
 * for voice-assignment). These tests make sure a future refactor doesn't
 * silently revert to Sonnet or the old `openai/gpt-4.1` default.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/llm-client.js', () => ({
  runAgentLoop: vi.fn(),
  structureTextAsJSON: vi.fn(),
}));

vi.mock('../../lib/logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../prompts/audio-director-prompt.js', () => ({
  AUDIO_DIRECTOR_SYSTEM_PROMPT: 'Select audio.',
}));

vi.mock('../tools/audio-search.js', () => ({
  searchMusicTool: { description: 'm', inputSchema: {}, execute: vi.fn() },
  searchAmbienceTool: { description: 'a', inputSchema: {}, execute: vi.fn() },
  searchSfxTool: { description: 's', inputSchema: {}, execute: vi.fn() },
  listAudioGroupsTool: { description: 'l', inputSchema: {}, execute: vi.fn() },
  getAudioByIdTool: { description: 'g', inputSchema: {}, execute: vi.fn() },
}));

import { AudioDirectorAgent } from './audio-director-agent.js';
import { runAgentLoop } from '../../lib/llm-client.js';

const DIRECTOR_JSON = JSON.stringify({
  project_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  scenes: [],
});

describe('AudioDirectorAgent model selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runAgentLoop).mockResolvedValue('{"project_id":"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11","scenes":[]}');
  });

  it('uses the constructor-provided model when given', async () => {
    const agent = new AudioDirectorAgent({ model: 'anthropic/claude-sonnet-4-6' });
    await agent.run(DIRECTOR_JSON);
    expect(runAgentLoop).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ model: 'anthropic/claude-sonnet-4-6' }),
    );
  });

  it('falls back to claude-haiku-4-5 as the default model (cost-optimized)', async () => {
    // Module captured DEFAULT_MODEL at import time. Constructing without an
    // explicit `model` must produce a runAgentLoop call with the Haiku default —
    // not Sonnet, and definitely not the old gpt-4.1 fallback.
    const agent = new AudioDirectorAgent();
    await agent.run(DIRECTOR_JSON);

    const callArgs = vi.mocked(runAgentLoop).mock.calls[0][1];
    expect(callArgs.model).toMatch(/haiku/i);
    expect(callArgs.model).not.toMatch(/sonnet|gpt-4/i);
  });
});
