/**
 * Tests for DirectorAgent
 * Validates script parsing, voice assignment, JSON repair, and schema validation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks - declared before any import that triggers module load
// ---------------------------------------------------------------------------

vi.mock('../../lib/llm-client.js', () => ({
  runAgentLoop: vi.fn(),
  structureTextAsJSON: vi.fn(),
}));

vi.mock('../../lib/logger.js', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    generation: vi.fn(),
  },
}));

vi.mock('../prompts/director-prompt.js', () => ({
  DIRECTOR_SYSTEM_PROMPT: 'You are a director agent.',
}));

vi.mock('../tools/voice-search.js', () => ({
  searchVoicesTool: { description: 'search voices', parameters: {}, execute: vi.fn() },
  getVoiceByIdTool: { description: 'get voice', parameters: {}, execute: vi.fn() },
  listVoiceLabelsTool: { description: 'list labels', parameters: {}, execute: vi.fn() },
  resetUsedVoices: vi.fn(),
}));

vi.mock('../../lib/json-repair.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/json-repair.js')>();
  return {
    ...actual,
    extractJSON: vi.fn((s: string) => s),
    repairJSON: vi.fn((s: string) => s),
    parseJSONSafely: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { DirectorAgent } from './director-agent.js';
import { runAgentLoop, structureTextAsJSON } from '../../lib/llm-client.js';
import { parseJSONSafely, extractJSON, repairJSON } from '../../lib/json-repair.js';
import { resetUsedVoices } from '../tools/voice-search.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function makeValidDirectorJSON() {
  return {
    project_id: PROJECT_ID,
    scenes: [
      {
        scene_id: 'scene_001',
        dialogue: [
          {
            line_id: 'line_001',
            character: 'JOHN',
            text: 'Hello there.',
            voice_key: 'voice_john_abc',
          },
        ],
      },
    ],
  };
}

function makeValidDirectorJSONString() {
  return JSON.stringify(makeValidDirectorJSON());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DirectorAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns valid DirectorJSON with scenes array on happy path', async () => {
    const jsonStr = makeValidDirectorJSONString();
    vi.mocked(runAgentLoop).mockResolvedValue(jsonStr);
    vi.mocked(parseJSONSafely).mockReturnValue({ success: true, data: makeValidDirectorJSON() });

    const agent = new DirectorAgent();
    const result = await agent.process({ project_id: PROJECT_ID, script_text: 'INT. OFFICE - DAY\nJOHN\nHello there.' });

    expect(result).toBeDefined();
    expect(result.project_id).toBe(PROJECT_ID);
    expect(Array.isArray(result.scenes)).toBe(true);
    expect(result.scenes).toHaveLength(1);
    expect(result.scenes[0].scene_id).toBe('scene_001');
  });

  it('calls resetUsedVoices before each run', async () => {
    const jsonStr = makeValidDirectorJSONString();
    vi.mocked(runAgentLoop).mockResolvedValue(jsonStr);
    vi.mocked(parseJSONSafely).mockReturnValue({ success: true, data: makeValidDirectorJSON() });

    const agent = new DirectorAgent();
    await agent.process({ project_id: PROJECT_ID, script_text: 'SOME SCRIPT' });

    expect(resetUsedVoices).toHaveBeenCalledOnce();
  });

  it('passes model and maxIterations options to runAgentLoop', async () => {
    const jsonStr = makeValidDirectorJSONString();
    vi.mocked(runAgentLoop).mockResolvedValue(jsonStr);
    vi.mocked(parseJSONSafely).mockReturnValue({ success: true, data: makeValidDirectorJSON() });

    const agent = new DirectorAgent({ model: 'anthropic/claude-sonnet-4-6', maxIterations: 5 });
    await agent.process({ project_id: PROJECT_ID, script_text: 'SCRIPT' });

    expect(runAgentLoop).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ model: 'anthropic/claude-sonnet-4-6', maxIterations: 5 })
    );
  });

  it('uses structureTextAsJSON fallback when initial JSON parse fails', async () => {
    const badJson = 'Here is the director output: { malformed }';
    const fixedData = makeValidDirectorJSON();

    vi.mocked(runAgentLoop).mockResolvedValue(badJson);
    vi.mocked(parseJSONSafely).mockReturnValue({ success: false, error: 'Unexpected token' });
    vi.mocked(structureTextAsJSON).mockResolvedValue(fixedData);

    const agent = new DirectorAgent();
    const result = await agent.process({ project_id: PROJECT_ID, script_text: 'SCRIPT' });

    expect(structureTextAsJSON).toHaveBeenCalled();
    expect(result.scenes).toHaveLength(1);
  });

  it('falls back to extractJSON + repairJSON when structureTextAsJSON also fails', async () => {
    const badJson = '{"project_id":"' + PROJECT_ID + '","scenes":[{"scene_id":"scene_001","dialogue":[{"line_id":"l1","character":"A","text":"Hi","voice_key":"v1"}]}]}';
    vi.mocked(runAgentLoop).mockResolvedValue(badJson);
    vi.mocked(parseJSONSafely).mockReturnValue({ success: false, error: 'Parse error' });
    vi.mocked(structureTextAsJSON).mockRejectedValue(new Error('Structured output failed'));
    vi.mocked(extractJSON).mockReturnValue(badJson);
    vi.mocked(repairJSON).mockReturnValue(badJson);

    const agent = new DirectorAgent();
    const result = await agent.process({ project_id: PROJECT_ID, script_text: 'SCRIPT' });

    expect(extractJSON).toHaveBeenCalledWith(badJson);
    expect(repairJSON).toHaveBeenCalled();
    expect(result.scenes).toHaveLength(1);
  });

  it('throws when all JSON parsing fallbacks fail', async () => {
    vi.mocked(runAgentLoop).mockResolvedValue('totally unparseable garbage %%%');
    vi.mocked(parseJSONSafely).mockReturnValue({ success: false, error: 'Unexpected token' });
    vi.mocked(structureTextAsJSON).mockRejectedValue(new Error('AI failed'));
    vi.mocked(extractJSON).mockReturnValue(null);

    const agent = new DirectorAgent();

    await expect(
      agent.process({ project_id: PROJECT_ID, script_text: 'SCRIPT' })
    ).rejects.toThrow(/Failed to parse JSON from DirectorAgent/);
  });

  it('validates result against DirectorJSONSchema and throws on invalid structure', async () => {
    // Missing required `scenes` array — schema validation should fail
    const invalidData = { project_id: PROJECT_ID, scenes: 'not-an-array' };
    vi.mocked(runAgentLoop).mockResolvedValue(JSON.stringify(invalidData));
    vi.mocked(parseJSONSafely).mockReturnValue({ success: true, data: invalidData });
    // structureTextAsJSON is called as the schema-fix fallback — make it fail too
    vi.mocked(structureTextAsJSON).mockRejectedValue(new Error('Schema fix failed'));

    const agent = new DirectorAgent();

    await expect(
      agent.process({ project_id: PROJECT_ID, script_text: 'SCRIPT' })
    ).rejects.toThrow(/DirectorAgent output failed schema validation/);
  });

  it('handles empty scenes array gracefully', async () => {
    const emptyScenes = { project_id: PROJECT_ID, scenes: [] };
    vi.mocked(runAgentLoop).mockResolvedValue(JSON.stringify(emptyScenes));
    vi.mocked(parseJSONSafely).mockReturnValue({ success: true, data: emptyScenes });

    const agent = new DirectorAgent();
    const result = await agent.process({ project_id: PROJECT_ID, script_text: '(silence)' });

    expect(result.scenes).toHaveLength(0);
  });

  it('uses structureTextAsJSON as schema-fix fallback when parsed data fails Zod validation', async () => {
    const invalidData = { project_id: PROJECT_ID }; // missing `scenes`
    const fixedData = makeValidDirectorJSON();

    vi.mocked(runAgentLoop).mockResolvedValue(JSON.stringify(invalidData));
    vi.mocked(parseJSONSafely).mockReturnValue({ success: true, data: invalidData });
    vi.mocked(structureTextAsJSON).mockResolvedValue(fixedData);

    const agent = new DirectorAgent();
    const result = await agent.process({ project_id: PROJECT_ID, script_text: 'SCRIPT' });

    expect(structureTextAsJSON).toHaveBeenCalled();
    expect(result.scenes).toHaveLength(1);
  });

  it('propagates runAgentLoop errors directly', async () => {
    vi.mocked(runAgentLoop).mockRejectedValue(new Error('LLM timeout'));

    const agent = new DirectorAgent();

    await expect(
      agent.process({ project_id: PROJECT_ID, script_text: 'SCRIPT' })
    ).rejects.toThrow('LLM timeout');
  });
});
