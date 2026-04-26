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

  it('returns minimal fallback VoiceMap when all parsing fails', async () => {
    vi.mocked(runAgentLoop).mockResolvedValue('garbage');
    vi.mocked(parseJSONSafely).mockReturnValue({ success: false, error: 'err' });
    vi.mocked(structureTextAsJSON).mockRejectedValue(new Error('AI failed'));

    const agent = new VoiceAssignmentAgent();
    const result = await agent.assign({ manifest: MANIFEST });

    // Should not throw — returns a minimal map with defaults
    expect(result.default_narrator_voice).toBe(DEFAULT_NARRATOR_VOICE);
    expect(result.default_male_voice).toBe(DEFAULT_MALE_VOICE);
    expect(result.default_female_voice).toBe(DEFAULT_FEMALE_VOICE);
    expect(result.assignments['NARRATOR']).toBeDefined();
  });

  it('throws when runAgentLoop itself fails', async () => {
    vi.mocked(runAgentLoop).mockRejectedValue(new Error('network timeout'));
    const agent = new VoiceAssignmentAgent();
    await expect(agent.assign({ manifest: MANIFEST })).rejects.toThrow('VoiceAssignmentAgent failed');
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
