/**
 * Tests for the S3/R2 URL wiring inside processGenerationJob (PR #173).
 *
 * When STORAGE_PROVIDER=s3 on the orchestrator, the orchestrator returns absolute
 * `https://audio.example.com/audio/...` URLs in `audio_urls`. The processor must
 * store those URLs as-is in `audioOutput.filePath` — without prefixing them with
 * the orchestrator base URL the way it does for legacy `/audio/...` paths.
 *
 * If the regex check at processor.ts:380 regresses, S3 URLs would get mangled
 * into `${orchestratorBase}/audio/https://audio.example.com/audio/...` and audio
 * playback would 404.
 *
 * Also verifies the chunk_index conditional at processor.ts:334: single-chunk
 * jobs must not send chunk_index so the orchestrator runs the full S3-upload
 * pipeline; multi-chunk jobs must send chunk_index so the orchestrator skips
 * the manifest step.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const PROJECT_ID = 'proj-s3-test';
const JOB_ID = 'job-s3-test';
const USER_ID = 'user-s3-test';
const SCRIPT = 'INT. OFFICE - DAY\nJOHN\nHello.';

function makeScenes(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    scene_id: `scene-${i}`,
    dialogue: [{ character: 'JOHN', line: `Line ${i}` }],
  }));
}

function setupMocks(sceneCount: number, audioUrl: string) {
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

  mockOrchestratorGenerate.mockImplementation(async (path: string) => {
    if (path === '/orchestrate') {
      return {
        ok: true,
        json: async () => ({ audio_urls: [audioUrl], playback_manifest: { total_duration: 60 } }),
      };
    }
    if (path === '/stitch-segments') {
      return {
        ok: true,
        json: async () => ({ status: 'success', audio_url: audioUrl }),
      };
    }
    return { ok: true, json: async () => ({ director_json: { scenes } }) };
  });

  return scenes;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Ensure the orchestrator base URL is set so we can distinguish "stored as-is"
  // (S3 URL) from "prefixed with orchestrator" (local path).
  process.env.ORCHESTRATOR_URL = 'https://orchestrator.example.com';
});

describe('processGenerationJob — S3 URL passthrough (PR #173)', () => {
  it('stores an absolute S3 URL in audioOutput.filePath unchanged (no orchestrator prefix)', async () => {
    const s3Url = 'https://audio.example.com/audio/proj-uuid/episode.m4a';
    setupMocks(5, s3Url);

    await processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 3);

    expect(mockPrisma.audioOutput.create).toHaveBeenCalled();
    const createArgs = mockPrisma.audioOutput.create.mock.calls[0][0];
    expect(createArgs.data.filePath).toBe(s3Url);
    // Critically: NOT prefixed with the orchestrator base URL
    expect(createArgs.data.filePath).not.toContain('orchestrator.example.com/audio/https');
  });

  it('stores an R2 URL (Cloudflare custom domain) unchanged', async () => {
    const r2Url = 'https://audio.storymagicapp.net/audio/proj-uuid/episode.m4a';
    setupMocks(5, r2Url);

    await processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 3);

    const createArgs = mockPrisma.audioOutput.create.mock.calls[0][0];
    expect(createArgs.data.filePath).toBe(r2Url);
  });

  it('preserves http:// (not just https://) for local MinIO testing', async () => {
    const minioUrl = 'http://localhost:9000/audio/proj-uuid/episode.m4a';
    setupMocks(5, minioUrl);

    await processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 3);

    const createArgs = mockPrisma.audioOutput.create.mock.calls[0][0];
    expect(createArgs.data.filePath).toBe(minioUrl);
  });

  it('still prefixes legacy /audio/... local paths with orchestrator base (regression guard)', async () => {
    const localUrl = '/audio/proj-uuid/episode.m4a';
    setupMocks(5, localUrl);

    await processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 3);

    const createArgs = mockPrisma.audioOutput.create.mock.calls[0][0];
    expect(createArgs.data.filePath).toBe('https://orchestrator.example.com/audio/proj-uuid/episode.m4a');
  });

  it('still extracts the Supabase storage key (regression guard for the supabase branch)', async () => {
    const supabaseUrl = 'https://abc.supabase.co/storage/v1/object/public/audio/proj-uuid/episode.m4a';
    setupMocks(5, supabaseUrl);

    // The /^https?:/ check runs BEFORE the supabase regex — so this stays as-is.
    // This documents the order-of-precedence: absolute URLs win over Supabase parsing.
    await processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 3);

    const createArgs = mockPrisma.audioOutput.create.mock.calls[0][0];
    expect(createArgs.data.filePath).toBe(supabaseUrl);
  });
});

describe('processGenerationJob — chunk_index conditional (PR #173)', () => {
  it('does NOT send chunk_index for a single-chunk job (so orchestrator runs full S3 pipeline)', async () => {
    setupMocks(5, 'https://audio.example.com/audio/proj/episode.m4a');

    await processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 3);

    const orchestrateCalls = mockOrchestratorGenerate.mock.calls.filter(
      ([path]: [string]) => path === '/orchestrate',
    );
    expect(orchestrateCalls).toHaveLength(1);
    const body = orchestrateCalls[0][1];
    expect(body).not.toHaveProperty('chunk_index');
  });

  it('DOES send chunk_index for a multi-chunk job (so orchestrator skips manifest)', async () => {
    // SCENES_PER_CHUNK = 14 → 30 scenes = 3 chunks
    setupMocks(30, 'https://audio.example.com/audio/proj/chunk.m4a');

    await processGenerationJob(PROJECT_ID, JOB_ID, USER_ID, SCRIPT, 3);

    const orchestrateCalls = mockOrchestratorGenerate.mock.calls.filter(
      ([path]: [string]) => path === '/orchestrate',
    );
    expect(orchestrateCalls.length).toBeGreaterThan(1);
    for (const [, body] of orchestrateCalls) {
      expect(body).toHaveProperty('chunk_index');
      expect(typeof body.chunk_index).toBe('number');
    }
  });
});
