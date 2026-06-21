/**
 * Tests for silent audio failure detection in processGenerationJob
 *
 * Issue #15: when the orchestrator returns audio_urls: [null] or [],
 * the job must be marked as failed rather than silently completed with no audio.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const { mockPrisma, mockOrchestratorGenerate } = vi.hoisted(() => {
  const mockPrisma = {
    project: { findUnique: vi.fn(), update: vi.fn() },
    job: { update: vi.fn(), findUnique: vi.fn() },
    jobLog: { create: vi.fn() },
    audioOutput: { create: vi.fn() },
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

import { processGenerationJob } from '@/lib/generation/processor';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PROJECT_ID = 'proj-aaa';
const JOB_ID = 'job-bbb';
const USER_ID = 'user-ccc';
const SCRIPT = 'INT. OFFICE - DAY\nALICE\nHello.';
const DIRECTOR_JSON = {
  scenes: [{ scene_id: 'scene-1', dialogue: [{ character: 'ALICE', line: 'Hello.' }] }],
};

function setupBase() {
  mockPrisma.job.update.mockResolvedValue({});
  mockPrisma.job.findUnique.mockResolvedValue({ status: 'processing' });
  mockPrisma.project.update.mockResolvedValue({});
  mockPrisma.jobLog.create.mockResolvedValue({});
  mockPrisma.$executeRaw.mockResolvedValue(undefined);
  mockPrisma.project.findUnique
    .mockResolvedValueOnce({ directorJson: DIRECTOR_JSON })
    .mockResolvedValueOnce({ audioOverrides: [] });
}

function makeOrchestratorResponse(audioUrls: unknown[]) {
  mockOrchestratorGenerate.mockImplementation(async (path: string) => {
    if (path === '/orchestrate') {
      return {
        ok: true,
        json: async () => ({ audio_urls: audioUrls, playback_manifest: { total: 10 } }),
      };
    }
    return { ok: true, json: async () => ({ director_json: DIRECTOR_JSON }) };
  });
}

function getJobFailCalls() {
  return mockPrisma.job.update.mock.calls.filter(
    (args: unknown[]) => (args[0] as { data?: { status?: string } })?.data?.status === 'failed',
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('processGenerationJob — silent audio failure detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupBase();
  });

  it('marks job failed when audio_urls is [null]', async () => {
    makeOrchestratorResponse([null]);

    await expect(
      processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 1)
    ).rejects.toThrow(/audio generation (failed|completed without)/i);

    expect(getJobFailCalls()).toHaveLength(1);
    const failCall = getJobFailCalls()[0][0] as { data: { error: string } };
    expect(failCall.data.error).toMatch(/audio generation (failed|completed without)/i);
  });

  it('marks job failed when audio_urls is empty array', async () => {
    makeOrchestratorResponse([]);

    await expect(
      processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 1)
    ).rejects.toThrow(/audio generation (failed|completed without)/i);

    expect(getJobFailCalls()).toHaveLength(1);
  });

  it('marks job failed when audio_urls contains only null entries', async () => {
    makeOrchestratorResponse([null, null]);

    await expect(
      processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 1)
    ).rejects.toThrow(/audio generation (failed|completed without)/i);

    expect(getJobFailCalls()).toHaveLength(1);
  });

  it('does NOT fail when audio_urls contains a valid URL', async () => {
    makeOrchestratorResponse(['/audio/proj-aaa/episode.m4a']);

    await processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 1);

    expect(getJobFailCalls()).toHaveLength(0);
    expect(mockPrisma.audioOutput.create).toHaveBeenCalledTimes(1);
  });

  it('creates AudioOutput record for each valid URL, skipping nulls', async () => {
    makeOrchestratorResponse([null, '/audio/proj-aaa/episode.m4a']);

    await processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 1);

    expect(mockPrisma.audioOutput.create).toHaveBeenCalledTimes(1);
    expect(getJobFailCalls()).toHaveLength(0);
  });
});
