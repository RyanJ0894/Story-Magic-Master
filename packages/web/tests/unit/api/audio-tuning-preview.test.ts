/**
 * Tests for POST /api/settings/audio-tuning/preview — B-004 from the build plan.
 *
 * Locks in:
 *   1. 400 when the user has no source project with a director_json
 *   2. zod rejects out-of-range tuning values
 *   3. happy path: posts to orchestrator with the chunk_index=0 + audio_tuning
 *      fields and returns the audio URL
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

const mockPrisma = {
  project: { findFirst: vi.fn() },
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: vi.fn(() => Promise.resolve(null)),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { POST } = await import('@/app/api/settings/audio-tuning/preview/route');

const USER_ID = 'user-preview-1';

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/settings/audio-tuning/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin: 'http://localhost:22000' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/settings/audio-tuning/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: USER_ID });
    process.env.SERVICE_SECRET_KEY = 'test-key';
    process.env.ORCHESTRATOR_URL = 'http://orch.test';
  });

  it('returns 401 when the user is not signed in', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(makeRequest({ tuning: { narrationSpeed: 1.05 } }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when the user has no source project with director_json', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);
    const res = await POST(makeRequest({ tuning: { narrationSpeed: 1.05 } }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('NO_SOURCE_PROJECT');
  });

  it('returns 400 when the project has no parsed scenes', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: 'p1',
      directorJson: { scenes: [] },
    });
    const res = await POST(makeRequest({ tuning: { narrationSpeed: 1.05 } }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('NO_SCENES');
  });

  it('rejects an out-of-range narrationSpeed via zod', async () => {
    const res = await POST(makeRequest({ tuning: { narrationSpeed: 2.5 } }));
    expect(res.status).toBe(400);
  });

  it('happy path: dispatches to orchestrator with the right shape and returns audioUrl', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: 'p-source',
      directorJson: {
        project_id: 'p-source',
        scenes: [
          { scene_id: 'scene_001', dialogue: [{ line_id: 'l1', character: 'X', text: 'hi' }] },
          { scene_id: 'scene_002', dialogue: [{ line_id: 'l2', character: 'X', text: 'bye' }] },
        ],
      },
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ audio_urls: ['https://cdn.test/audio.m4a'] }),
    });

    const res = await POST(makeRequest({
      tuning: { musicGainOffsetDb: 3, narrationSpeed: 1.10 },
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.audioUrl).toBe('https://cdn.test/audio.m4a');
    expect(json.data.sceneCount).toBe(1);

    // Orchestrator call: only scene 1, chunk_index=0, audio_tuning forwarded
    expect(mockFetch).toHaveBeenCalledOnce();
    const [orchUrl, fetchOpts] = mockFetch.mock.calls[0];
    expect(orchUrl).toContain('/orchestrate');
    expect(fetchOpts.method).toBe('POST');
    expect((fetchOpts.headers as Record<string, string>)['X-Service-Key']).toBe('test-key');

    const body = JSON.parse(fetchOpts.body);
    expect(body.project_id).toBe('p-source');
    expect(body.scenes).toHaveLength(1);
    expect(body.scenes[0].scene_id).toBe('scene_001');
    expect(body.chunk_index).toBe(0);
    expect(body.audio_tuning).toMatchObject({
      musicGainOffsetDb: 3,
      narrationSpeed: 1.10,
      // Missing patch fields filled from defaults
      ambienceGainOffsetDb: 0,
      sfxGainOffsetDb: 0,
    });
  });

  it('returns 502 when the orchestrator returns non-OK', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: 'p1',
      directorJson: { scenes: [{ scene_id: 's1', dialogue: [] }] },
    });
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Internal error'),
    });

    const res = await POST(makeRequest({ tuning: { narrationSpeed: 1.05 } }));
    expect(res.status).toBe(502);
  });

  it('returns 503 when SERVICE_SECRET_KEY is missing', async () => {
    delete process.env.SERVICE_SECRET_KEY;
    mockPrisma.project.findFirst.mockResolvedValue({
      id: 'p1',
      directorJson: { scenes: [{ scene_id: 's1', dialogue: [] }] },
    });

    const res = await POST(makeRequest({ tuning: { narrationSpeed: 1.05 } }));
    expect(res.status).toBe(503);
  });
});
