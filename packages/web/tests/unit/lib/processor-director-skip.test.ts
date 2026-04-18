/**
 * Tests for Director-parse skip logic in processGenerationJob
 *
 * When a project already has a valid directorJson (scenes array),
 * the processor should reuse it instead of calling /generate-scenes again.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks (must precede vi.mock calls) ───────────────────────────────
const { mockPrisma, mockOrchestratorGenerate } = vi.hoisted(() => {
  const mockPrisma = {
    project: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    job: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
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
}));
vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { processGenerationJob } from '@/lib/generation/processor';

// ─── Shared fixtures ──────────────────────────────────────────────────────────
const PROJECT_ID = 'proj-123';
const JOB_ID = 'job-456';
const USER_ID = 'user-789';
const SCRIPT = 'INT. OFFICE - DAY\nALICE\nHello.';

const DIRECTOR_JSON = {
  scenes: [
    {
      scene_id: 'scene-1',
      dialogue: [{ character: 'ALICE', line: 'Hello.' }],
    },
  ],
};

const ORCHESTRATOR_RESULT = {
  audio_urls: [],
  playback_manifest: { total_duration: 10 },
};

function setupCommonMocks() {
  mockPrisma.job.update.mockResolvedValue({});
  mockPrisma.job.findUnique.mockResolvedValue({ status: 'processing' });
  mockPrisma.project.update.mockResolvedValue({});
  mockPrisma.jobLog.create.mockResolvedValue({});
  mockPrisma.$executeRaw.mockResolvedValue(undefined);

  mockOrchestratorGenerate.mockImplementation(async (path: string) => {
    if (path === '/orchestrate') {
      return { ok: true, json: async () => ORCHESTRATOR_RESULT };
    }
    return { ok: true, json: async () => ({ director_json: DIRECTOR_JSON }) };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupCommonMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('processGenerationJob — Director parse skip', () => {
  it('calls /generate-scenes when project has no directorJson', async () => {
    mockPrisma.project.findUnique
      .mockResolvedValueOnce({ directorJson: null })
      .mockResolvedValueOnce({ audioOverrides: [] });

    await processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 1);

    expect(mockOrchestratorGenerate).toHaveBeenCalledWith(
      '/generate-scenes',
      expect.objectContaining({ project_id: PROJECT_ID, script_text: SCRIPT }),
    );
  });

  it('calls /generate-scenes when directorJson has empty scenes', async () => {
    mockPrisma.project.findUnique
      .mockResolvedValueOnce({ directorJson: { scenes: [] } })
      .mockResolvedValueOnce({ audioOverrides: [] });

    await processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 1);

    expect(mockOrchestratorGenerate).toHaveBeenCalledWith(
      '/generate-scenes',
      expect.objectContaining({ project_id: PROJECT_ID }),
    );
  });

  it('skips /generate-scenes when project already has valid directorJson', async () => {
    mockPrisma.project.findUnique
      .mockResolvedValueOnce({ directorJson: DIRECTOR_JSON })
      .mockResolvedValueOnce({ audioOverrides: [] });

    await processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 1);

    const generateScenesCalls = mockOrchestratorGenerate.mock.calls.filter(
      ([path]: [string]) => path === '/generate-scenes',
    );
    expect(generateScenesCalls).toHaveLength(0);
  });

  it('still calls /orchestrate with cached scenes when parse is skipped', async () => {
    mockPrisma.project.findUnique
      .mockResolvedValueOnce({ directorJson: DIRECTOR_JSON })
      .mockResolvedValueOnce({ audioOverrides: [] });

    await processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 1);

    expect(mockOrchestratorGenerate).toHaveBeenCalledWith(
      '/orchestrate',
      expect.objectContaining({ scenes: DIRECTOR_JSON.scenes }),
    );
  });

  it('does NOT re-save directorJson to the project when skipping parse', async () => {
    mockPrisma.project.findUnique
      .mockResolvedValueOnce({ directorJson: DIRECTOR_JSON })
      .mockResolvedValueOnce({ audioOverrides: [] });

    await processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 1);

    const directorSaveCalls = mockPrisma.project.update.mock.calls.filter(
      (args: unknown[]) => {
        const call = args[0] as { data?: Record<string, unknown> };
        return 'directorJson' in (call?.data ?? {});
      },
    );
    expect(directorSaveCalls).toHaveLength(0);
  });

  it('saves directorJson to project after a fresh parse', async () => {
    mockPrisma.project.findUnique
      .mockResolvedValueOnce({ directorJson: null })
      .mockResolvedValueOnce({ audioOverrides: [] });

    await processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 1);

    const directorSaveCalls = mockPrisma.project.update.mock.calls.filter(
      (args: unknown[]) => {
        const call = args[0] as { data?: Record<string, unknown> };
        return 'directorJson' in (call?.data ?? {});
      },
    );
    expect(directorSaveCalls.length).toBeGreaterThan(0);
  });

  it('passes voice overrides to /generate-scenes when provided', async () => {
    mockPrisma.project.findUnique
      .mockResolvedValueOnce({ directorJson: null })
      .mockResolvedValueOnce({ audioOverrides: [] });

    const overrides = { ALICE: 'voice-abc' };
    await processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 1, overrides);

    expect(mockOrchestratorGenerate).toHaveBeenCalledWith(
      '/generate-scenes',
      expect.objectContaining({ voice_overrides: overrides }),
    );
  });
});
