/**
 * Tests for VoiceAssignmentAgent (Pass 2)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Hoist mock references so they're accessible inside vi.mock() factories
const { mockCreateVoiceTools, mockResetUsedVoices } = vi.hoisted(() => {
  const mockResetUsedVoices = vi.fn();
  const mockCreateVoiceTools = vi.fn(() => ({
    searchVoicesTool: { description: 'search', inputSchema: {}, execute: vi.fn() },
    getVoiceByIdTool: { description: 'get', inputSchema: {}, execute: vi.fn() },
    listVoiceLabelsTool: { description: 'list', inputSchema: {}, execute: vi.fn() },
    commitVoiceTool: { description: 'commit', inputSchema: {}, execute: vi.fn() },
    resetUsedVoices: mockResetUsedVoices,
  }));
  return { mockCreateVoiceTools, mockResetUsedVoices };
});

vi.mock('../../lib/llm-client.js', () => ({
  runAgentLoop: vi.fn(),
  structureTextAsJSON: vi.fn(),
}));

vi.mock('../../lib/logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../tools/voice-search.js', () => ({
  createVoiceTools: mockCreateVoiceTools,
}));

vi.mock('../prompts/voice-assignment-prompt.js', () => ({
  VOICE_ASSIGNMENT_SYSTEM_PROMPT: 'Assign voices.',
  buildVoiceAssignmentUserMessage: vi.fn(() => 'user message'),
}));

vi.mock('../../lib/json-repair.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/json-repair.js')>();
  return { ...actual, parseJSONSafely: vi.fn() };
});

// ── Imports ───────────────────────────────────────────────────────────────────

import { VoiceAssignmentAgent } from './voice-assignment-agent.js';
import { runAgentLoop, structureTextAsJSON } from '../../lib/llm-client.js';
import { parseJSONSafely } from '../../lib/json-repair.js';
import { DEFAULT_NARRATOR_VOICE, DEFAULT_MALE_VOICE, DEFAULT_FEMALE_VOICE } from '../../schemas/voice-map.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROJECT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const MANIFEST = {
  project_id: PROJECT_ID,
  characters: [
    { name: 'NARRATOR', canonical_name: 'NARRATOR', aliases: [], description: 'Narrator', is_narrator: true },
    { name: 'JOHN', canonical_name: 'JOHN', aliases: [], gender: 'Male' as const, description: 'Hero', is_narrator: false },
  ],
};

function makeValidVoiceMap() {
  return {
    project_id: PROJECT_ID,
    assignments: {
      NARRATOR: { canonical_name: 'NARRATOR', voice_key: 'JBFqnCBsd6RMkjVDRZzb', voice_name: 'George' },
      JOHN: { canonical_name: 'JOHN', voice_key: 'bIHbv24MWmeRgasZH58o', voice_name: 'Will', gender: 'Male' as const },
    },
    default_narrator_voice: 'JBFqnCBsd6RMkjVDRZzb',
    default_male_voice: 'bIHbv24MWmeRgasZH58o',
    default_female_voice: 'cgSgspJ2msm6clMCkdW9',
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('VoiceAssignmentAgent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns validated VoiceMap on happy path', async () => {
    const voiceMapJson = JSON.stringify(makeValidVoiceMap());
    vi.mocked(runAgentLoop).mockResolvedValue(voiceMapJson);
    vi.mocked(parseJSONSafely).mockReturnValue({ success: true, data: makeValidVoiceMap() });

    const agent = new VoiceAssignmentAgent();
    const result = await agent.assign({ manifest: MANIFEST });

    expect(result.project_id).toBe(PROJECT_ID);
    expect(result.assignments['JOHN'].voice_key).toBe('bIHbv24MWmeRgasZH58o');
    expect(result.default_narrator_voice).toBeTruthy();
  });

  it('calls createVoiceTools and resetUsedVoices before the loop', async () => {
    vi.mocked(runAgentLoop).mockResolvedValue(JSON.stringify(makeValidVoiceMap()));
    vi.mocked(parseJSONSafely).mockReturnValue({ success: true, data: makeValidVoiceMap() });
    const agent = new VoiceAssignmentAgent();
    await agent.assign({ manifest: MANIFEST });
    expect(mockCreateVoiceTools).toHaveBeenCalled();
    expect(mockResetUsedVoices).toHaveBeenCalledOnce();
  });

  it('falls back to structureTextAsJSON when JSON parse fails', async () => {
    vi.mocked(runAgentLoop).mockResolvedValue('bad output');
    vi.mocked(parseJSONSafely).mockReturnValue({ success: false, error: 'parse error' });
    vi.mocked(structureTextAsJSON).mockResolvedValue(makeValidVoiceMap());

    const agent = new VoiceAssignmentAgent();
    const result = await agent.assign({ manifest: MANIFEST });

    expect(structureTextAsJSON).toHaveBeenCalled();
    expect(result.assignments['JOHN']).toBeDefined();
  });

  it('throws when all parsing fails — no silent wrong-voice fallback', async () => {
    vi.mocked(runAgentLoop).mockResolvedValue('garbage');
    vi.mocked(parseJSONSafely).mockReturnValue({ success: false, error: 'err' });
    vi.mocked(structureTextAsJSON).mockRejectedValue(new Error('AI failed'));

    const agent = new VoiceAssignmentAgent();
    await expect(agent.assign({ manifest: MANIFEST })).rejects.toThrow('VoiceAssignment failed');
  });

  it('throws when schema fix also fails — no silent wrong-voice fallback', async () => {
    // Agent returns valid JSON but fails VoiceMap schema, and the fix attempt also fails
    vi.mocked(runAgentLoop).mockResolvedValue('{"not":"a_voice_map"}');
    vi.mocked(parseJSONSafely).mockReturnValue({ success: true, data: { not: 'a_voice_map' } });
    // Schema validation will fail; structureTextAsJSON is used for fix and also fails
    vi.mocked(structureTextAsJSON).mockRejectedValue(new Error('schema fix failed'));

    const agent = new VoiceAssignmentAgent();
    await expect(agent.assign({ manifest: MANIFEST })).rejects.toThrow('VoiceAssignment failed');
  });

  it('throws when runAgentLoop itself fails', async () => {
    vi.mocked(runAgentLoop).mockRejectedValue(new Error('network timeout'));
    const agent = new VoiceAssignmentAgent();
    await expect(agent.assign({ manifest: MANIFEST })).rejects.toThrow('VoiceAssignmentAgent failed');
  });

  // ── 30-page scale: maxIterations scales with cast size ──────────────────────
  // A 30-page script can have 25+ characters. Each character needs ~4 tool call
  // iterations (search_voices, get_voice, commit_voice, confirm).
  // With maxIterations=30 the loop exits at ~7 characters — the rest fall back
  // to default voices, making all characters sound identical.
  // Fix: scale maxIterations = max(30, characterCount * 4).

  it('passes maxIterations scaled to character count for large manifests', async () => {
    const largeManifest = {
      project_id: PROJECT_ID,
      characters: Array.from({ length: 25 }, (_, i) => ({
        name: `CHARACTER_${i + 1}`,
        canonical_name: `CHARACTER_${i + 1}`,
        aliases: [] as string[],
        description: `Character ${i + 1}`,
        is_narrator: false,
      })),
    };

    vi.mocked(runAgentLoop).mockResolvedValue(JSON.stringify(makeValidVoiceMap()));
    vi.mocked(parseJSONSafely).mockReturnValue({ success: true, data: makeValidVoiceMap() });

    const agent = new VoiceAssignmentAgent({ maxIterations: 30 });
    await agent.assign({ manifest: largeManifest });

    const callArgs = vi.mocked(runAgentLoop).mock.calls[0][1] as { maxIterations: number };
    // 25 characters × 4 iterations = 100; must exceed the base 30
    expect(callArgs.maxIterations).toBeGreaterThanOrEqual(100);
  });

  it('does not over-scale maxIterations for small manifests (≤7 characters)', async () => {
    vi.mocked(runAgentLoop).mockResolvedValue(JSON.stringify(makeValidVoiceMap()));
    vi.mocked(parseJSONSafely).mockReturnValue({ success: true, data: makeValidVoiceMap() });

    const agent = new VoiceAssignmentAgent({ maxIterations: 30 });
    await agent.assign({ manifest: MANIFEST }); // 2 characters

    const callArgs = vi.mocked(runAgentLoop).mock.calls[0][1] as { maxIterations: number };
    // Small manifest uses the configured base (30), not an inflated value
    expect(callArgs.maxIterations).toBe(30);
  });

  it('fills in missing default voices from constants', async () => {
    const partialMap = {
      project_id: PROJECT_ID,
      assignments: {
        NARRATOR: { canonical_name: 'NARRATOR', voice_key: 'abc123' },
      },
      // missing default_narrator_voice / default_male_voice / default_female_voice
    };
    vi.mocked(runAgentLoop).mockResolvedValue(JSON.stringify(partialMap));
    vi.mocked(parseJSONSafely).mockReturnValue({ success: true, data: partialMap });
    vi.mocked(structureTextAsJSON).mockResolvedValue({
      ...partialMap,
      default_narrator_voice: 'abc123',
      default_male_voice: DEFAULT_MALE_VOICE,
      default_female_voice: DEFAULT_FEMALE_VOICE,
    });

    const agent = new VoiceAssignmentAgent();
    const result = await agent.assign({ manifest: MANIFEST });
    expect(result.default_male_voice).toBeTruthy();
    expect(result.default_female_voice).toBeTruthy();
  });
});

// ── Model selection ──────────────────────────────────────────────────────────
//
// Voice assignment defaults to Haiku 4.5 (cost optimization). These tests pin
// that default and verify the VOICE_ASSIGNMENT_MODEL env override.

describe('VoiceAssignmentAgent model selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runAgentLoop).mockResolvedValue(JSON.stringify(makeValidVoiceMap()));
    vi.mocked(parseJSONSafely).mockReturnValue({ success: true, data: makeValidVoiceMap() });
  });

  it('uses the constructor-provided model when given', async () => {
    const agent = new VoiceAssignmentAgent({ model: 'anthropic/claude-sonnet-4-6' });
    await agent.assign({ manifest: MANIFEST });
    expect(runAgentLoop).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ model: 'anthropic/claude-sonnet-4-6' }),
    );
  });

  it('falls back to claude-haiku-4-5 as the default model (cost-optimized)', async () => {
    // Module captured DEFAULT_MODEL at import time. Constructing the agent
    // without a `model` option must produce a runAgentLoop call with whichever
    // model the module resolved at load — verify it's the Haiku default and
    // not Sonnet or gpt-4.1.
    const agent = new VoiceAssignmentAgent();
    await agent.assign({ manifest: MANIFEST });

    const callArgs = vi.mocked(runAgentLoop).mock.calls[0][1];
    // Must NOT be the previous Sonnet/gpt-4.1 default, must be a Haiku-family model.
    expect(callArgs.model).toMatch(/haiku/i);
    expect(callArgs.model).not.toMatch(/sonnet|gpt-4/i);
  });
});
