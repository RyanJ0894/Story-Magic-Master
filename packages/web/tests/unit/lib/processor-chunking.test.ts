/**
 * Tests for chunked generation in processGenerationJob (Sprint K)
 *
 * Verifies that long scripts (many scenes) are split into segments and each
 * segment is sent as a separate /orchestrate call. Verifies segment status
 * updates and firstAudioUrl progressive-playback behaviour.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SCENES_PER_CHUNK, FIRST_CHUNK_SCENES } from '@/lib/generation/chunk-script';

const { mockPrisma, mockOrchestratorGenerate } = vi.hoisted(() => {
  const mockPrisma = {
    project: { findUnique: vi.fn(), update: vi.fn() },
    job: { update: vi.fn(), findUnique: vi.fn() },
    jobLog: { create: vi.fn() },
    audioOutput: { create: vi.fn() },
    profile: { findUnique: vi.fn() },
    $executeRaw: vi.fn(),
  };
  const mockOrchestratorGenerate = vi.fn();
  return { mockPrisma, mockOrchestratorGenerate };
});

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/orchestrator-fetch', () => ({
  orchestratorGenerate: (...args: unknown[]) => mockOrchestratorGenerate(...args),
  // No-op the deploy-window guard — tests don't exercise the real orchestrator.
  waitForOrchestratorReady: vi.fn().mockResolvedValue(undefined),
  isTransientOrchestratorError: vi.fn().mockReturnValue(false),
  OrchestratorUnreachableError: class extends Error { constructor(msg: string) { super(msg); this.name = 'OrchestratorUnreachableError'; } },
}));
vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/webhooks/deliver', () => ({ dispatchWebhooks: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/human-review/trigger', () => ({ triggerHumanReviewIfPurchased: vi.fn().mockResolvedValue(undefined) }));

import { processGenerationJob } from '@/lib/generation/processor';

const PROJECT_ID = 'proj-chunk-test';
const JOB_ID = 'job-chunk-test';
const USER_ID = 'user-chunk-test';
const SCRIPT = 'INT. OFFICE - DAY\nJOHN\nHello.';

function makeScenes(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    scene_id: `scene-${i}`,
    dialogue: [{ character: 'JOHN', line: `Line ${i}` }],
  }));
}

function makeOrchestratorSuccess(audioUrl: string) {
  return {
    ok: true,
    json: async () => ({
      audio_urls: [audioUrl],
      playback_manifest: { total_duration: 120 },
    }),
  };
}

function setupMocks(sceneCount: number) {
  const scenes = makeScenes(sceneCount);

  mockPrisma.job.update.mockResolvedValue({});
  mockPrisma.job.findUnique.mockResolvedValue({ status: 'processing' });
  mockPrisma.project.findUnique
    .mockResolvedValueOnce({ directorJson: { scenes }, directorNotes: null })
    .mockResolvedValueOnce({ audioOverrides: [] });
  mockPrisma.project.update.mockResolvedValue({});
  mockPrisma.jobLog.create.mockResolvedValue({});
  mockPrisma.audioOutput.create.mockResolvedValue({});
  mockPrisma.$executeRaw.mockResolvedValue(undefined);

  let chunkIndex = 0;
  mockOrchestratorGenerate.mockImplementation(async (path: string) => {
    if (path === '/orchestrate') {
      const url = `https://storage.example.com/audio/chunk-${chunkIndex++}.m4a`;
      return makeOrchestratorSuccess(url);
    }
    if (path === '/stitch-segments') {
      return { ok: true, json: async () => ({ status: 'success', audio_url: 'https://storage.example.com/audio/episode.m4a' }) };
    }
    return { ok: true, json: async () => ({ director_json: { scenes } }) };
  });

  return scenes;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('processGenerationJob — chunked generation (Sprint K)', () => {
  it('sends one /orchestrate call for a script that fits in FIRST_CHUNK_SCENES (single chunk)', async () => {
    // 2026-06-22: chunking now uses FIRST_CHUNK_SCENES (small first chunk)
    // for everything above that threshold. Scripts ≤ FIRST_CHUNK_SCENES
    // collapse back to a single chunk.
    setupMocks(FIRST_CHUNK_SCENES);

    await processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 3);

    const orchestrateCalls = mockOrchestratorGenerate.mock.calls.filter(
      ([path]: [string]) => path === '/orchestrate',
    );
    expect(orchestrateCalls).toHaveLength(1);
  });

  it('sends multiple /orchestrate calls for a long script', async () => {
    // 2026-06-22: FIRST_CHUNK_SCENES + SCENES_PER_CHUNK * 2 + 3 should
    // produce [FIRST_CHUNK_SCENES, SCENES_PER_CHUNK, SCENES_PER_CHUNK, 3]
    // = 4 chunks. Test just asserts >1 to stay resilient to future
    // chunking tweaks.
    const sceneCount = FIRST_CHUNK_SCENES + SCENES_PER_CHUNK * 2 + 3;
    setupMocks(sceneCount);

    await processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 40);

    const orchestrateCalls = mockOrchestratorGenerate.mock.calls.filter(
      ([path]: [string]) => path === '/orchestrate',
    );
    expect(orchestrateCalls.length).toBeGreaterThan(1);
  });

  it("each orchestrate call receives only that chunk's scenes (small first chunk + standard rest)", async () => {
    // 2026-06-22: With FIRST_CHUNK_SCENES=2 and SCENES_PER_CHUNK=7,
    // 12 scenes → [2, 7, 3]. Test the first two chunks' shape.
    const sceneCount = FIRST_CHUNK_SCENES + SCENES_PER_CHUNK + 3;
    const scenes = setupMocks(sceneCount);

    await processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 25);

    const orchestrateCalls = mockOrchestratorGenerate.mock.calls.filter(
      ([path]: [string]) => path === '/orchestrate',
    );

    // Chunk 0: scenes 0..FIRST_CHUNK_SCENES-1
    const firstChunkScenes = (orchestrateCalls[0][1] as { scenes: typeof scenes }).scenes;
    expect(firstChunkScenes).toHaveLength(FIRST_CHUNK_SCENES);
    expect(firstChunkScenes[0]).toEqual(scenes[0]);

    // Chunk 1: SCENES_PER_CHUNK scenes starting from FIRST_CHUNK_SCENES
    const secondChunkScenes = (orchestrateCalls[1][1] as { scenes: typeof scenes }).scenes;
    expect(secondChunkScenes).toHaveLength(SCENES_PER_CHUNK);
    expect(secondChunkScenes[0]).toEqual(scenes[FIRST_CHUNK_SCENES]);
  });

  it('sets firstAudioUrl on the job after the first chunk completes', async () => {
    setupMocks(SCENES_PER_CHUNK + 3); // 2 chunks

    await processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 25);

    // Find the job.update call that sets firstAudioUrl
    const jobUpdates = mockPrisma.job.update.mock.calls as Array<[{ data: Record<string, unknown> }]>;
    const firstAudioUpdate = jobUpdates.find(([args]) => args?.data?.firstAudioUrl != null);
    expect(firstAudioUpdate).toBeDefined();
    expect(typeof firstAudioUpdate![0].data.firstAudioUrl).toBe('string');
    expect((firstAudioUpdate![0].data.firstAudioUrl as string)).toContain('.m4a');
  });

  it('writes segment status updates to the job for each chunk', async () => {
    const sceneCount = SCENES_PER_CHUNK + 5;
    setupMocks(sceneCount);

    await processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 25);

    const jobUpdates = mockPrisma.job.update.mock.calls as Array<[{ data: Record<string, unknown> }]>;
    const segmentUpdates = jobUpdates.filter(([args]) => args?.data?.segments != null);
    // At least 2 updates (one per chunk)
    expect(segmentUpdates.length).toBeGreaterThanOrEqual(2);
  });

  // 2026-06-25: Peter caught a 72-page run that "completed" with only 6/50
  // segments rendered (got to page 17 of 72). The original partial-success
  // policy was wrong for that case. New rule: if MAJORITY of chunks fail,
  // throw instead of silently shipping a sliver of the script. Tests below
  // pin the new boundary at >50% via PARTIAL_FAIL_RATIO (default 0.5).

  it('throws when MAJORITY of chunks fail (Peter 2026-06-24 regression guard)', async () => {
    // Make a script that produces multiple chunks, then fail all but the first.
    // The actual chunk count depends on FIRST_CHUNK_SCENES + SCENES_PER_CHUNK
    // arithmetic, so the assertion regex is loose on the ratio digits — what
    // matters is that the throw fires when >50% of chunks fail.
    const scenes = makeScenes(FIRST_CHUNK_SCENES + SCENES_PER_CHUNK * 3 + 3);

    mockPrisma.job.update.mockResolvedValue({});
    mockPrisma.job.findUnique.mockResolvedValue({ status: 'processing' });
    mockPrisma.project.findUnique
      .mockResolvedValueOnce({ directorJson: { scenes }, directorNotes: null })
      .mockResolvedValueOnce({ audioOverrides: [] });
    mockPrisma.project.update.mockResolvedValue({});
    mockPrisma.jobLog.create.mockResolvedValue({});
    mockPrisma.$executeRaw.mockResolvedValue(undefined);

    let callCount = 0;
    mockOrchestratorGenerate.mockImplementation(async (path: string) => {
      if (path === '/orchestrate') {
        callCount++;
        // Only the first chunk succeeds; everything else fails. With 4+
        // chunks total, 3+ failures = >50% → must throw.
        if (callCount > 1) {
          return { ok: false, text: async () => 'TTS timeout' };
        }
        return makeOrchestratorSuccess(`https://storage.example.com/audio/chunk-${callCount}.m4a`);
      }
      return { ok: true, json: async () => ({ director_json: { scenes } }) };
    });

    await expect(
      processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 25),
    ).rejects.toThrow(/\d+\/\d+ segments succeeded/i);
  });

  it('honors PARTIAL_FAIL_RATIO env override (operator can tune at runtime)', async () => {
    // With PARTIAL_FAIL_RATIO=0.01, even a single chunk failure triggers a
    // throw — confirms the env override path is active.
    const prev = process.env.PARTIAL_FAIL_RATIO;
    process.env.PARTIAL_FAIL_RATIO = '0.01';
    try {
      const scenes = makeScenes(FIRST_CHUNK_SCENES + SCENES_PER_CHUNK * 3 + 3);

      mockPrisma.job.update.mockResolvedValue({});
      mockPrisma.job.findUnique.mockResolvedValue({ status: 'processing' });
      mockPrisma.project.findUnique
        .mockResolvedValueOnce({ directorJson: { scenes }, directorNotes: null })
        .mockResolvedValueOnce({ audioOverrides: [] });
      mockPrisma.project.update.mockResolvedValue({});
      mockPrisma.jobLog.create.mockResolvedValue({});
      mockPrisma.$executeRaw.mockResolvedValue(undefined);

      let callCount = 0;
      mockOrchestratorGenerate.mockImplementation(async (path: string) => {
        if (path === '/orchestrate') {
          callCount++;
          // First N-1 succeed, last fails — a tiny ratio that the default
          // 0.5 threshold would tolerate, but our 0.01 override rejects.
          if (callCount >= 4) {
            return { ok: false, text: async () => 'TTS timeout' };
          }
          return makeOrchestratorSuccess(`https://storage.example.com/audio/chunk-${callCount}.m4a`);
        }
        return { ok: true, json: async () => ({ director_json: { scenes } }) };
      });

      await expect(
        processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 25),
      ).rejects.toThrow(/\d+\/\d+ segments succeeded/i);
    } finally {
      if (prev === undefined) delete process.env.PARTIAL_FAIL_RATIO;
      else process.env.PARTIAL_FAIL_RATIO = prev;
    }
  });

  it('still completes successfully when one chunk fails (partial audio)', async () => {
    const scenes = makeScenes(SCENES_PER_CHUNK + 3);

    mockPrisma.job.update.mockResolvedValue({});
    mockPrisma.job.findUnique.mockResolvedValue({ status: 'processing' });
    mockPrisma.project.findUnique
      .mockResolvedValueOnce({ directorJson: { scenes }, directorNotes: null })
      .mockResolvedValueOnce({ audioOverrides: [] });
    mockPrisma.project.update.mockResolvedValue({});
    mockPrisma.jobLog.create.mockResolvedValue({});
    mockPrisma.audioOutput.create.mockResolvedValue({});
    mockPrisma.$executeRaw.mockResolvedValue(undefined);

    let callCount = 0;
    mockOrchestratorGenerate.mockImplementation(async (path: string) => {
      if (path === '/orchestrate') {
        callCount++;
        // Second chunk fails
        if (callCount === 2) {
          return { ok: false, text: async () => 'TTS timeout' };
        }
        return makeOrchestratorSuccess(`https://storage.example.com/audio/chunk-${callCount}.m4a`);
      }
      return { ok: true, json: async () => ({ director_json: { scenes } }) };
    });

    // Should not throw — partial audio is acceptable
    await expect(
      processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 25)
    ).resolves.not.toThrow();
  });

  it('throws when ALL chunks fail (no audio produced)', async () => {
    const scenes = makeScenes(SCENES_PER_CHUNK + 3);

    mockPrisma.job.update.mockResolvedValue({});
    mockPrisma.job.findUnique.mockResolvedValue({ status: 'processing' });
    mockPrisma.project.findUnique
      .mockResolvedValueOnce({ directorJson: { scenes }, directorNotes: null })
      .mockResolvedValueOnce({ audioOverrides: [] });
    mockPrisma.project.update.mockResolvedValue({});
    mockPrisma.jobLog.create.mockResolvedValue({});
    mockPrisma.$executeRaw.mockResolvedValue(undefined);

    mockOrchestratorGenerate.mockImplementation(async (path: string) => {
      if (path === '/orchestrate') {
        return { ok: false, text: async () => 'TTS timeout' };
      }
      return { ok: true, json: async () => ({ director_json: { scenes } }) };
    });

    // All segments fail → job should fail with clear error
    await expect(
      processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 25)
    ).rejects.toThrow(/audio generation failed/i);

    const jobFailUpdate = (mockPrisma.job.update.mock.calls as Array<[{ data: Record<string, unknown> }]>)
      .find(([args]) => args?.data?.status === 'failed');
    expect(jobFailUpdate).toBeDefined();
  });
});
