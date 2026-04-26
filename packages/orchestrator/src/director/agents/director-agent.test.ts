/**
 * Tests for DirectorAgent
 *
 * process()        — multi-pass pipeline: mocks the 3 sub-agents
 * legacyProcess()  — single-pass fallback: mocks runAgentLoop + parseJSONSafely
 * run()            — raw legacy loop: mocks runAgentLoop
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks — vi.hoisted() runs BEFORE vi.mock() factories ─────────────
// Class constructor mocks must be declared here so the factory closures see them.

const {
  mockExtract,
  mockAssign,
  mockConstruct,
} = vi.hoisted(() => ({
  mockExtract: vi.fn(),
  mockAssign: vi.fn(),
  mockConstruct: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../../lib/llm-client.js', () => ({
  runAgentLoop: vi.fn(),
  structureTextAsJSON: vi.fn(),
}));

vi.mock('../../lib/logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), generation: vi.fn() },
}));

vi.mock('../prompts/director-prompt.js', () => ({
  DIRECTOR_SYSTEM_PROMPT: 'You are a director agent.',
}));

vi.mock('../tools/voice-search.js', () => ({
  searchVoicesTool: { description: 'search voices', inputSchema: {}, execute: vi.fn() },
  getVoiceByIdTool: { description: 'get voice', inputSchema: {}, execute: vi.fn() },
  listVoiceLabelsTool: { description: 'list labels', inputSchema: {}, execute: vi.fn() },
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

// Sub-agent class mocks — use vi.hoisted() values so factories close over the
// same vi.fn() references that tests configure in beforeEach.
// NOTE: Vitest v4 requires `function` keyword (not arrow) for constructor mocks.
vi.mock('./character-extraction-agent.js', () => ({
  CharacterExtractionAgent: vi.fn().mockImplementation(function () { return { extract: mockExtract }; }),
}));

vi.mock('./voice-assignment-agent.js', () => ({
  VoiceAssignmentAgent: vi.fn().mockImplementation(function () { return { assign: mockAssign }; }),
}));

vi.mock('./scene-construction-agent.js', () => ({
  SceneConstructionAgent: vi.fn().mockImplementation(function () { return { construct: mockConstruct }; }),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { DirectorAgent } from './director-agent.js';
import { runAgentLoop, structureTextAsJSON } from '../../lib/llm-client.js';
import { parseJSONSafely, extractJSON, repairJSON } from '../../lib/json-repair.js';
import { resetUsedVoices } from '../tools/voice-search.js';
import { CharacterExtractionAgent } from './character-extraction-agent.js';
import { VoiceAssignmentAgent } from './voice-assignment-agent.js';
import { SceneConstructionAgent } from './scene-construction-agent.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROJECT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function makeValidDirectorJSON() {
  return {
    project_id: PROJECT_ID,
    scenes: [
      {
        scene_id: 'scene_001',
        dialogue: [
          { line_id: 'line_001', character: 'JOHN', text: 'Hello there.', voice_key: 'voice_john_abc' },
        ],
      },
    ],
  };
}

function makeValidDirectorJSONString() {
  return JSON.stringify(makeValidDirectorJSON());
}

function makeManifest() {
  return {
    project_id: PROJECT_ID,
    characters: [
      { name: 'NARRATOR', canonical_name: 'NARRATOR', aliases: [], description: 'Narrator', is_narrator: true },
      { name: 'JOHN', canonical_name: 'JOHN', aliases: [], gender: 'Male', description: 'Hero', is_narrator: false },
    ],
  };
}

function makeVoiceMap() {
  return {
    project_id: PROJECT_ID,
    assignments: {
      NARRATOR: { canonical_name: 'NARRATOR', voice_key: 'JBFqnCBsd6RMkjVDRZzb' },
      JOHN: { canonical_name: 'JOHN', voice_key: 'bIHbv24MWmeRgasZH58o', gender: 'Male' },
    },
    default_narrator_voice: 'JBFqnCBsd6RMkjVDRZzb',
    default_male_voice: 'bIHbv24MWmeRgasZH58o',
    default_female_voice: 'cgSgspJ2msm6clMCkdW9',
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// process() — multi-pass pipeline
// ═════════════════════════════════════════════════════════════════════════════

describe('DirectorAgent.process() — multi-pass pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-set constructor implementations after clearing (clearAllMocks can reset them)
    vi.mocked(CharacterExtractionAgent).mockImplementation(function () { return { extract: mockExtract } as any; });
    vi.mocked(VoiceAssignmentAgent).mockImplementation(function () { return { assign: mockAssign } as any; });
    vi.mocked(SceneConstructionAgent).mockImplementation(function () { return { construct: mockConstruct } as any; });
    // Default: all 3 passes succeed
    mockExtract.mockResolvedValue(makeManifest());
    mockAssign.mockResolvedValue(makeVoiceMap());
    mockConstruct.mockResolvedValue(makeValidDirectorJSON().scenes);
  });

  it('returns valid DirectorJSON by orchestrating the 3 sub-agents', async () => {
    const agent = new DirectorAgent();
    const result = await agent.process({ project_id: PROJECT_ID, script_text: 'INT. OFFICE - DAY\nJOHN\nHello.' });

    expect(result.project_id).toBe(PROJECT_ID);
    expect(Array.isArray(result.scenes)).toBe(true);
    expect(result.scenes[0].scene_id).toBe('scene_001');
  });

  it('calls extract, assign, and construct in order', async () => {
    const agent = new DirectorAgent();
    await agent.process({ project_id: PROJECT_ID, script_text: 'script' });

    expect(mockExtract).toHaveBeenCalledOnce();
    expect(mockAssign).toHaveBeenCalledOnce();
    expect(mockConstruct).toHaveBeenCalledOnce();
  });

  it('instantiates sub-agents with the configured model', async () => {
    const agent = new DirectorAgent({ model: 'anthropic/claude-sonnet-4-6' });
    await agent.process({ project_id: PROJECT_ID, script_text: 'script' });

    expect(CharacterExtractionAgent).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'anthropic/claude-sonnet-4-6' })
    );
    expect(VoiceAssignmentAgent).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'anthropic/claude-sonnet-4-6' })
    );
    expect(SceneConstructionAgent).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'anthropic/claude-sonnet-4-6' })
    );
  });

  it('passes scenesPerChunk option to SceneConstructionAgent', async () => {
    const agent = new DirectorAgent({ scenesPerChunk: 5 });
    await agent.process({ project_id: PROJECT_ID, script_text: 'script' });

    expect(SceneConstructionAgent).toHaveBeenCalledWith(
      expect.objectContaining({ scenesPerChunk: 5 })
    );
  });

  it('falls back to legacyProcess when CharacterExtractionAgent throws', async () => {
    mockExtract.mockRejectedValue(new Error('extraction failed'));
    vi.mocked(runAgentLoop).mockResolvedValue(makeValidDirectorJSONString());
    vi.mocked(parseJSONSafely).mockReturnValue({ success: true, data: makeValidDirectorJSON() });

    const agent = new DirectorAgent();
    const result = await agent.process({ project_id: PROJECT_ID, script_text: 'script' });

    expect(runAgentLoop).toHaveBeenCalled();
    expect(result.scenes).toHaveLength(1);
  });

  it('passes the VoiceMap returned by Pass 2 into Pass 3', async () => {
    const specificVoiceMap = {
      ...makeVoiceMap(),
      default_narrator_voice: 'SPECIFIC_NARRATOR_VOICE',
    };
    mockAssign.mockResolvedValue(specificVoiceMap);

    const agent = new DirectorAgent();
    await agent.process({ project_id: PROJECT_ID, script_text: 'script' });

    expect(mockConstruct).toHaveBeenCalledWith(
      expect.objectContaining({ voice_map: specificVoiceMap })
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// legacyProcess() — single-pass fallback
// ═════════════════════════════════════════════════════════════════════════════

describe('DirectorAgent.legacyProcess()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns valid DirectorJSON on happy path', async () => {
    vi.mocked(runAgentLoop).mockResolvedValue(makeValidDirectorJSONString());
    vi.mocked(parseJSONSafely).mockReturnValue({ success: true, data: makeValidDirectorJSON() });

    const agent = new DirectorAgent();
    const result = await agent.legacyProcess({ project_id: PROJECT_ID, script_text: 'SCRIPT' });

    expect(result.project_id).toBe(PROJECT_ID);
    expect(result.scenes).toHaveLength(1);
  });

  it('uses structureTextAsJSON fallback when initial JSON parse fails', async () => {
    const fixedData = makeValidDirectorJSON();
    vi.mocked(runAgentLoop).mockResolvedValue('bad json %%%');
    vi.mocked(parseJSONSafely).mockReturnValue({ success: false, error: 'Unexpected token' });
    vi.mocked(structureTextAsJSON).mockResolvedValue(fixedData);

    const agent = new DirectorAgent();
    const result = await agent.legacyProcess({ project_id: PROJECT_ID, script_text: 'SCRIPT' });

    expect(structureTextAsJSON).toHaveBeenCalled();
    expect(result.scenes).toHaveLength(1);
  });

  it('falls back to extractJSON + repairJSON when structureTextAsJSON also fails', async () => {
    const rawJson = makeValidDirectorJSONString();
    vi.mocked(runAgentLoop).mockResolvedValue(rawJson);
    vi.mocked(parseJSONSafely).mockReturnValue({ success: false, error: 'Parse error' });
    vi.mocked(structureTextAsJSON).mockRejectedValue(new Error('Structured output failed'));
    vi.mocked(extractJSON).mockReturnValue(rawJson);
    vi.mocked(repairJSON).mockReturnValue(rawJson);

    const agent = new DirectorAgent();
    const result = await agent.legacyProcess({ project_id: PROJECT_ID, script_text: 'SCRIPT' });

    expect(extractJSON).toHaveBeenCalled();
    expect(result.scenes).toHaveLength(1);
  });

  it('throws when all JSON fallbacks fail', async () => {
    vi.mocked(runAgentLoop).mockResolvedValue('garbage %%%');
    vi.mocked(parseJSONSafely).mockReturnValue({ success: false, error: 'err' });
    vi.mocked(structureTextAsJSON).mockRejectedValue(new Error('AI failed'));
    vi.mocked(extractJSON).mockReturnValue(null);

    const agent = new DirectorAgent();
    await expect(
      agent.legacyProcess({ project_id: PROJECT_ID, script_text: 'SCRIPT' })
    ).rejects.toThrow(/Failed to parse JSON from DirectorAgent/);
  });

  it('throws on schema validation failure when schema fix also fails', async () => {
    const invalidData = { project_id: PROJECT_ID, scenes: 'not-an-array' };
    vi.mocked(runAgentLoop).mockResolvedValue(JSON.stringify(invalidData));
    vi.mocked(parseJSONSafely).mockReturnValue({ success: true, data: invalidData });
    vi.mocked(structureTextAsJSON).mockRejectedValue(new Error('Schema fix failed'));

    const agent = new DirectorAgent();
    await expect(
      agent.legacyProcess({ project_id: PROJECT_ID, script_text: 'SCRIPT' })
    ).rejects.toThrow(/DirectorAgent output failed schema validation/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// run() — raw legacy agent loop
// ═════════════════════════════════════════════════════════════════════════════

describe('DirectorAgent.run()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls resetUsedVoices before the agent loop', async () => {
    vi.mocked(runAgentLoop).mockResolvedValue(makeValidDirectorJSONString());
    const agent = new DirectorAgent();
    await agent.run({ project_id: PROJECT_ID, script_text: 'SCRIPT' });
    expect(resetUsedVoices).toHaveBeenCalledOnce();
  });

  it('passes model and maxIterations to runAgentLoop', async () => {
    vi.mocked(runAgentLoop).mockResolvedValue('{}');
    const agent = new DirectorAgent({ model: 'anthropic/claude-sonnet-4-6', maxIterations: 5 });
    await agent.run({ project_id: PROJECT_ID, script_text: 'SCRIPT' });

    expect(runAgentLoop).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ model: 'anthropic/claude-sonnet-4-6', maxIterations: 5 })
    );
  });

  it('propagates runAgentLoop errors', async () => {
    vi.mocked(runAgentLoop).mockRejectedValue(new Error('LLM timeout'));
    const agent = new DirectorAgent();
    await expect(
      agent.run({ project_id: PROJECT_ID, script_text: 'SCRIPT' })
    ).rejects.toThrow('LLM timeout');
  });

  it('returns raw text from runAgentLoop unchanged', async () => {
    const rawText = 'some raw text output';
    vi.mocked(runAgentLoop).mockResolvedValue(rawText);
    const agent = new DirectorAgent();
    const result = await agent.run({ project_id: PROJECT_ID, script_text: 'SCRIPT' });
    expect(result).toBe(rawText);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Token budget warning — BL-009
// ═════════════════════════════════════════════════════════════════════════════

describe('DirectorAgent token budget warning (BL-009)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does NOT warn for scripts under 160K chars', async () => {
    mockExtract.mockResolvedValue(makeManifest());
    mockAssign.mockResolvedValue(makeVoiceMap());
    mockConstruct.mockResolvedValue(makeValidDirectorJSON().scenes);

    const { log } = await import('../../lib/logger.js');
    const warnSpy = vi.mocked(log.warn);

    const agent = new DirectorAgent();
    const shortScript = 'A'.repeat(100_000); // 100K chars — well under threshold
    await agent.process({ project_id: PROJECT_ID, script_text: shortScript });

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('token-budget'),
      expect.anything()
    );
  });

  it('emits a warning log for scripts over 160K chars', async () => {
    mockExtract.mockResolvedValue(makeManifest());
    mockAssign.mockResolvedValue(makeVoiceMap());
    mockConstruct.mockResolvedValue(makeValidDirectorJSON().scenes);

    const { log } = await import('../../lib/logger.js');
    const warnSpy = vi.mocked(log.warn);

    const agent = new DirectorAgent();
    const longScript = 'A'.repeat(161_000); // 161K chars — over threshold
    await agent.process({ project_id: PROJECT_ID, script_text: longScript });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('token-budget'),
      expect.objectContaining({
        scriptLength: 161_000,
        tokenBudgetWarnChars: 160_000,
      })
    );
  });

  it('includes estimated token count in the warning', async () => {
    mockExtract.mockResolvedValue(makeManifest());
    mockAssign.mockResolvedValue(makeVoiceMap());
    mockConstruct.mockResolvedValue(makeValidDirectorJSON().scenes);

    const { log } = await import('../../lib/logger.js');
    const warnSpy = vi.mocked(log.warn);

    const agent = new DirectorAgent();
    await agent.process({ project_id: PROJECT_ID, script_text: 'A'.repeat(200_000) });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ estimatedInputTokens: 50_000 }) // 200_000 / 4
    );
  });
});
