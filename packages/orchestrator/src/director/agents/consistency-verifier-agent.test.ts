/**
 * Tests for ConsistencyVerifierAgent (Phase E core).
 *
 * The verifier itself is an LLM call wrapped with structured-output
 * validation; we mock the LLM and test the orchestration logic:
 *
 *   - verifyScene compacts the voice map to scene-relevant entries only
 *     (token-budget hygiene)
 *   - verifyBatch picks distinct random scenes and aggregates verdicts
 *   - verifyBatch tolerates per-scene failures without abandoning the batch
 *   - source/parse scene-count mismatch logs a warning but doesn't throw
 *   - failures collection contains only verdicts with passed=false
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/llm-client.js', () => ({
  generateStructuredOutput: vi.fn(),
}));

vi.mock('../../lib/logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  verifyScene,
  verifyBatch,
  type Verdict,
} from './consistency-verifier-agent.js';
import { generateStructuredOutput } from '../../lib/llm-client.js';

const PROJECT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

function makeScene(id: string, characters: string[]): unknown {
  return {
    scene_id: id,
    summary: `Scene ${id}`,
    mood: 'neutral',
    intensity: 0.5,
    dialogue: characters.map((c, i) => ({
      character: c,
      voice_key: `voice-${c}`,
      text: `Line ${i} from ${c}`,
    })),
    music: [],
    ambience: [],
    sfx: [],
  };
}

function makeDirector(sceneSpecs: Array<{ id: string; chars: string[] }>): unknown {
  return {
    project_id: PROJECT_ID,
    scenes: sceneSpecs.map((s) => makeScene(s.id, s.chars)),
  };
}

function makeVoiceMap(characters: string[]): unknown {
  const assignments: Record<string, unknown> = {};
  for (const c of characters) {
    assignments[c] = {
      canonical_name: c,
      voice_key: `voice-${c}`,
      voice_name: `${c} Voice`,
      gender: 'Male',
    };
  }
  return {
    project_id: PROJECT_ID,
    assignments,
    default_narrator_voice: 'voice-NARRATOR',
    default_male_voice: 'voice-MALE',
    default_female_voice: 'voice-FEMALE',
  };
}

function makePassingVerdict(sceneId: string): Verdict {
  return {
    scene_id: sceneId,
    passed: true,
    issues: [],
    summary: 'Looks consistent.',
  };
}

function makeFailingVerdict(sceneId: string): Verdict {
  return {
    scene_id: sceneId,
    passed: false,
    issues: [
      {
        field: 'voice',
        severity: 'major',
        description: 'Voice does not fit speech pattern.',
      },
    ],
    summary: 'Voice mismatch.',
  };
}

beforeEach(() => vi.clearAllMocks());

describe('verifyScene', () => {
  it('returns the verdict from the LLM', async () => {
    vi.mocked(generateStructuredOutput).mockResolvedValue(
      makePassingVerdict('001'),
    );
    const verdict = await verifyScene({
      scene: makeScene('001', ['ANNA', 'BEN']) as Parameters<typeof verifyScene>[0]['scene'],
      sourceText: 'ANNA: Hi.\nBEN: Hey.',
      voiceMap: makeVoiceMap(['ANNA', 'BEN', 'CHRIS']) as Parameters<typeof verifyScene>[0]['voiceMap'],
    });
    expect(verdict.scene_id).toBe('001');
    expect(verdict.passed).toBe(true);
  });

  it('compacts the voice map to scene-relevant entries only (token hygiene)', async () => {
    vi.mocked(generateStructuredOutput).mockResolvedValue(makePassingVerdict('001'));
    await verifyScene({
      scene: makeScene('001', ['ANNA']) as Parameters<typeof verifyScene>[0]['scene'],
      sourceText: 'ANNA: Hi.',
      voiceMap: makeVoiceMap(['ANNA', 'BEN', 'CHRIS', 'DOROTHY']) as Parameters<
        typeof verifyScene
      >[0]['voiceMap'],
    });
    // The prompt passed to the LLM should include ANNA but not the
    // other 3 characters who don't appear in this scene.
    const promptArg = vi.mocked(generateStructuredOutput).mock.calls[0][0];
    expect(promptArg).toContain('ANNA');
    expect(promptArg).not.toContain('CHRIS');
    expect(promptArg).not.toContain('DOROTHY');
  });

  it('uses the Haiku-family default model', async () => {
    vi.mocked(generateStructuredOutput).mockResolvedValue(makePassingVerdict('001'));
    await verifyScene({
      scene: makeScene('001', ['ANNA']) as Parameters<typeof verifyScene>[0]['scene'],
      sourceText: 'ANNA: Hi.',
      voiceMap: makeVoiceMap(['ANNA']) as Parameters<typeof verifyScene>[0]['voiceMap'],
    });
    const optionsArg = vi.mocked(generateStructuredOutput).mock.calls[0][1];
    expect(optionsArg.model).toMatch(/haiku/i);
  });
});

describe('verifyBatch', () => {
  it('returns empty result when the director has no scenes', async () => {
    const result = await verifyBatch(
      { project_id: PROJECT_ID, scenes: [] } as Parameters<typeof verifyBatch>[0],
      makeVoiceMap([]) as Parameters<typeof verifyBatch>[1],
      [],
    );
    expect(result.verdicts).toEqual([]);
    expect(result.failures).toEqual([]);
    expect(result.sampledIndexes).toEqual([]);
    expect(generateStructuredOutput).not.toHaveBeenCalled();
  });

  it('samples up to N scenes and aggregates verdicts', async () => {
    const director = makeDirector([
      { id: '001', chars: ['ANNA'] },
      { id: '002', chars: ['BEN'] },
      { id: '003', chars: ['CHRIS'] },
    ]) as Parameters<typeof verifyBatch>[0];
    const voiceMap = makeVoiceMap(['ANNA', 'BEN', 'CHRIS']) as Parameters<typeof verifyBatch>[1];
    const sources = ['ANNA: Hi.', 'BEN: Hey.', 'CHRIS: Hello.'];

    vi.mocked(generateStructuredOutput).mockImplementation(async (prompt) => {
      const match = prompt.match(/SCENE ID: (\S+)/);
      return makePassingVerdict(match ? match[1] : 'unknown');
    });

    const result = await verifyBatch(director, voiceMap, sources, { sampleCount: 3 });
    expect(result.verdicts).toHaveLength(3);
    expect(result.failures).toHaveLength(0);
    expect(result.sampledIndexes).toEqual([0, 1, 2]);
  });

  it('separates failures from passes in the result', async () => {
    const director = makeDirector([
      { id: '001', chars: ['ANNA'] },
      { id: '002', chars: ['BEN'] },
    ]) as Parameters<typeof verifyBatch>[0];
    const voiceMap = makeVoiceMap(['ANNA', 'BEN']) as Parameters<typeof verifyBatch>[1];
    const sources = ['ANNA: Hi.', 'BEN: Hey.'];

    vi.mocked(generateStructuredOutput)
      .mockResolvedValueOnce(makePassingVerdict('001'))
      .mockResolvedValueOnce(makeFailingVerdict('002'));

    const result = await verifyBatch(director, voiceMap, sources, { sampleCount: 2 });
    expect(result.verdicts).toHaveLength(2);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].scene_id).toBe('002');
  });

  it('tolerates a per-scene LLM failure without abandoning the batch', async () => {
    const director = makeDirector([
      { id: '001', chars: ['ANNA'] },
      { id: '002', chars: ['BEN'] },
      { id: '003', chars: ['CHRIS'] },
    ]) as Parameters<typeof verifyBatch>[0];
    const voiceMap = makeVoiceMap(['ANNA', 'BEN', 'CHRIS']) as Parameters<typeof verifyBatch>[1];
    const sources = ['ANNA: Hi.', 'BEN: Hey.', 'CHRIS: Hello.'];

    vi.mocked(generateStructuredOutput)
      .mockResolvedValueOnce(makePassingVerdict('001'))
      .mockRejectedValueOnce(new Error('LLM down'))
      .mockResolvedValueOnce(makePassingVerdict('003'));

    const result = await verifyBatch(director, voiceMap, sources, { sampleCount: 3 });
    // Two scenes succeed, one fails — failing one is dropped, not propagated.
    expect(result.verdicts).toHaveLength(2);
    expect(result.failures).toHaveLength(0);
  });

  it('caps sampleCount at the actual scene count without crashing', async () => {
    const director = makeDirector([
      { id: '001', chars: ['ANNA'] },
      { id: '002', chars: ['BEN'] },
    ]) as Parameters<typeof verifyBatch>[0];
    const voiceMap = makeVoiceMap(['ANNA', 'BEN']) as Parameters<typeof verifyBatch>[1];
    const sources = ['ANNA: Hi.', 'BEN: Hey.'];

    vi.mocked(generateStructuredOutput).mockImplementation(async (prompt) => {
      const match = prompt.match(/SCENE ID: (\S+)/);
      return makePassingVerdict(match ? match[1] : 'unknown');
    });

    const result = await verifyBatch(director, voiceMap, sources, { sampleCount: 100 });
    expect(result.verdicts).toHaveLength(2);
    expect(result.sampledIndexes).toEqual([0, 1]);
  });
});
