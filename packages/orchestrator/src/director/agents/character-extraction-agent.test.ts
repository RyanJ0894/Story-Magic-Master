/**
 * Tests for CharacterExtractionAgent (Pass 1)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../lib/llm-client.js', () => ({
  generateStructuredOutput: vi.fn(),
}));

vi.mock('../../lib/logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../prompts/character-extraction-prompt.js', () => ({
  CHARACTER_EXTRACTION_SYSTEM_PROMPT: 'Extract characters.',
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { CharacterExtractionAgent } from './character-extraction-agent.js';
import { generateStructuredOutput } from '../../lib/llm-client.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROJECT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function makeManifest(extraChars: object[] = []) {
  return {
    project_id: PROJECT_ID,
    characters: [
      {
        name: 'NARRATOR',
        canonical_name: 'NARRATOR',
        aliases: [],
        description: 'Narrator voice',
        is_narrator: true,
      },
      {
        name: 'JOHN',
        canonical_name: 'JOHN',
        aliases: [],
        gender: 'Male',
        age: 40,
        description: 'Detective',
        sample_dialogue: "I've seen worse.",
        is_narrator: false,
      },
      ...extraChars,
    ],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CharacterExtractionAgent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns validated CharacterManifest on happy path', async () => {
    vi.mocked(generateStructuredOutput).mockResolvedValue(makeManifest());
    const agent = new CharacterExtractionAgent();
    const result = await agent.extract({ project_id: PROJECT_ID, script_text: 'INT. OFFICE - DAY\nJOHN\nHello.' });
    expect(result.project_id).toBe(PROJECT_ID);
    expect(result.characters).toHaveLength(2);
    expect(result.characters.find((c) => c.is_narrator)).toBeDefined();
  });

  it('injects project_id if model omits it', async () => {
    const withoutId = { characters: makeManifest().characters };
    vi.mocked(generateStructuredOutput).mockResolvedValue(withoutId);
    const agent = new CharacterExtractionAgent();
    const result = await agent.extract({ project_id: PROJECT_ID, script_text: 'script' });
    expect(result.project_id).toBe(PROJECT_ID);
  });

  it('injects a NARRATOR entry if model omits it', async () => {
    const noNarrator = {
      project_id: PROJECT_ID,
      characters: [{ name: 'JOHN', canonical_name: 'JOHN', aliases: [], description: 'Hero', is_narrator: false }],
    };
    vi.mocked(generateStructuredOutput).mockResolvedValue(noNarrator);
    const agent = new CharacterExtractionAgent();
    const result = await agent.extract({ project_id: PROJECT_ID, script_text: 'script' });
    const narrator = result.characters.find((c) => c.is_narrator);
    expect(narrator).toBeDefined();
    expect(narrator?.name).toBe('NARRATOR');
  });

  it('throws when generateStructuredOutput fails', async () => {
    vi.mocked(generateStructuredOutput).mockRejectedValue(new Error('LLM timeout'));
    const agent = new CharacterExtractionAgent();
    await expect(
      agent.extract({ project_id: PROJECT_ID, script_text: 'script' })
    ).rejects.toThrow('CharacterExtractionAgent failed');
  });

  it('throws when schema validation fails and cannot be fixed', async () => {
    // Return an object missing `characters`
    vi.mocked(generateStructuredOutput).mockResolvedValue({ project_id: PROJECT_ID });
    const agent = new CharacterExtractionAgent();
    await expect(
      agent.extract({ project_id: PROJECT_ID, script_text: 'script' })
    ).rejects.toThrow(/schema validation/);
  });

  it('passes model option to generateStructuredOutput', async () => {
    vi.mocked(generateStructuredOutput).mockResolvedValue(makeManifest());
    const agent = new CharacterExtractionAgent({ model: 'anthropic/claude-sonnet-4-6' });
    await agent.extract({ project_id: PROJECT_ID, script_text: 'script' });
    expect(generateStructuredOutput).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ model: 'anthropic/claude-sonnet-4-6' })
    );
  });
});
