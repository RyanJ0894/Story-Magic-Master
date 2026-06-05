/**
 * Tests for SceneConstructionAgent (Pass 3)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../lib/llm-client.js', () => ({
  generateStructuredOutput: vi.fn(),
}));

vi.mock('../../lib/logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../prompts/scene-construction-prompt.js', () => ({
  buildSceneConstructionSystemPrompt: vi.fn(() => 'system prompt'),
  buildSceneConstructionUserMessage: vi.fn((text: string) => `parse: ${text}`),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { SceneConstructionAgent } from './scene-construction-agent.js';
import { generateStructuredOutput } from '../../lib/llm-client.js';
import type { VoiceMap } from '../../schemas/voice-map.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROJECT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const VOICE_MAP: VoiceMap = {
  project_id: PROJECT_ID,
  assignments: {
    NARRATOR: { canonical_name: 'NARRATOR', voice_key: 'JBFqnCBsd6RMkjVDRZzb' },
    JOHN: { canonical_name: 'JOHN', voice_key: 'bIHbv24MWmeRgasZH58o', gender: 'Male' },
  },
  default_narrator_voice: 'JBFqnCBsd6RMkjVDRZzb',
  default_male_voice: 'bIHbv24MWmeRgasZH58o',
  default_female_voice: 'cgSgspJ2msm6clMCkdW9',
};

function makeScene(id: string) {
  return {
    scene_id: id,
    mood: 'neutral',
    intensity: 0.5,
    dialogue: [
      { line_id: 'line_001', character: 'JOHN', text: 'Hello.', voice_key: 'bIHbv24MWmeRgasZH58o' },
    ],
  };
}

function makeChunkOutput(sceneIds: string[]) {
  return { scenes: sceneIds.map(makeScene) };
}

// Script with N scenes
function makeScript(sceneCount: number): string {
  return Array.from({ length: sceneCount }, (_, i) =>
    `INT. LOCATION ${i + 1} - DAY\n\nJOHN\nLine ${i + 1}.`
  ).join('\n\n');
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SceneConstructionAgent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all scenes on happy path (single chunk)', async () => {
    vi.mocked(generateStructuredOutput).mockResolvedValue(
      makeChunkOutput(['scene_001', 'scene_002'])
    );
    const agent = new SceneConstructionAgent();
    const result = await agent.construct({
      project_id: PROJECT_ID,
      script_text: makeScript(2),
      voice_map: VOICE_MAP,
    });
    expect(result).toHaveLength(2);
    expect(result[0].scene_id).toBe('scene_001');
  });

  it('concatenates results from multiple chunks in order', async () => {
    // First call returns chunk 0 scenes, second returns chunk 1 scenes
    vi.mocked(generateStructuredOutput)
      .mockResolvedValueOnce(makeChunkOutput(['scene_001']))
      .mockResolvedValueOnce(makeChunkOutput(['scene_002']));

    const agent = new SceneConstructionAgent({ scenesPerChunk: 1 });
    const result = await agent.construct({
      project_id: PROJECT_ID,
      script_text: makeScript(2),
      voice_map: VOICE_MAP,
    });
    expect(result).toHaveLength(2);
    expect(result[0].scene_id).toBe('scene_001');
    expect(result[1].scene_id).toBe('scene_002');
  });

  it('skips failed chunks and continues with successful ones', async () => {
    vi.mocked(generateStructuredOutput)
      .mockResolvedValueOnce(makeChunkOutput(['scene_001']))
      .mockRejectedValueOnce(new Error('chunk 1 failed'))
      .mockResolvedValueOnce(makeChunkOutput(['scene_031']));

    const agent = new SceneConstructionAgent({ scenesPerChunk: 1 });
    // 3 scenes → 3 single-scene chunks
    const result = await agent.construct({
      project_id: PROJECT_ID,
      script_text: makeScript(3),
      voice_map: VOICE_MAP,
    });
    // Only 2 of 3 chunks succeeded
    expect(result).toHaveLength(2);
  });

  it('throws when ALL chunks fail', async () => {
    vi.mocked(generateStructuredOutput).mockRejectedValue(new Error('all failed'));
    const agent = new SceneConstructionAgent({ scenesPerChunk: 1 });
    await expect(
      agent.construct({
        project_id: PROJECT_ID,
        script_text: makeScript(2),
        voice_map: VOICE_MAP,
      })
    ).rejects.toThrow('produced no scenes');
  });

  it('calls generateStructuredOutput once per chunk', async () => {
    vi.mocked(generateStructuredOutput).mockResolvedValue(makeChunkOutput(['scene_001']));
    const agent = new SceneConstructionAgent({ scenesPerChunk: 5 });
    await agent.construct({
      project_id: PROJECT_ID,
      script_text: makeScript(12),
      voice_map: VOICE_MAP,
    });
    // 12 scenes / 5 per chunk = 3 chunks (5 + 5 + 2)
    expect(generateStructuredOutput).toHaveBeenCalledTimes(3);
  });

  it('passes model option to generateStructuredOutput', async () => {
    vi.mocked(generateStructuredOutput).mockResolvedValue(makeChunkOutput(['scene_001']));
    const agent = new SceneConstructionAgent({ model: 'anthropic/claude-sonnet-4-6' });
    await agent.construct({
      project_id: PROJECT_ID,
      script_text: makeScript(1),
      voice_map: VOICE_MAP,
    });
    expect(generateStructuredOutput).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ model: 'anthropic/claude-sonnet-4-6' })
    );
  });

  // ── 30-page scale: concurrency cap ─────────────────────────────────────────
  // A dense 30-page script can produce 6+ chunks (90 scenes / 15 per chunk).
  // Without a concurrency cap all chunks fire simultaneously, saturating the
  // Claude API rate limit and causing cascading 429 failures.
  // With the cap (MAX_CONCURRENT_CHUNKS = 3) at most 3 calls are in-flight at once.

  it('never exceeds MAX_CONCURRENT_CHUNKS simultaneous LLM calls (6-chunk script)', async () => {
    let peakConcurrent = 0;
    let activeCalls = 0;

    vi.mocked(generateStructuredOutput).mockImplementation(async () => {
      activeCalls++;
      peakConcurrent = Math.max(peakConcurrent, activeCalls);
      // Simulate async work — long enough to overlap
      await new Promise((r) => setTimeout(r, 10));
      activeCalls--;
      return makeChunkOutput(['scene_x']);
    });

    // 90 scenes / 15 per chunk = 6 chunks
    const agent = new SceneConstructionAgent({ scenesPerChunk: 15 });
    await agent.construct({
      project_id: PROJECT_ID,
      script_text: makeScript(90),
      voice_map: VOICE_MAP,
    });

    expect(generateStructuredOutput).toHaveBeenCalledTimes(6);
    // Must never have more than 3 active simultaneously (cap)
    expect(peakConcurrent).toBeLessThanOrEqual(3);
    // Must have at least 2 concurrent (proves pLimit isn't accidentally 1/serial)
    expect(peakConcurrent).toBeGreaterThanOrEqual(2);
  });

  it('all 90 scenes present in output after 6-chunk capped run', async () => {
    let callIndex = 0;
    vi.mocked(generateStructuredOutput).mockImplementation(async () => {
      const start = callIndex * 15 + 1;
      const ids = Array.from({ length: 15 }, (_, i) => `scene_${String(start + i).padStart(3, '0')}`);
      callIndex++;
      return makeChunkOutput(ids);
    });

    const agent = new SceneConstructionAgent({ scenesPerChunk: 15 });
    const result = await agent.construct({
      project_id: PROJECT_ID,
      script_text: makeScript(90),
      voice_map: VOICE_MAP,
    });

    expect(result).toHaveLength(90);
  });
});
