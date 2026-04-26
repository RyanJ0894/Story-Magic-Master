/**
 * Tests for /orchestrate route — Sprint 6 BL-013 / BL-016
 *
 * Validates ownership check: authenticated user must own the project.
 * Uses express + node http.request (no supertest dependency).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import http from 'http';
import express from 'express';

// ── hoisted mocks ────────────────────────────────────────────────────────────

const { mockOrchestrate, mockOrchParallel, mockProcessScript, mockPrisma } = vi.hoisted(() => ({
  mockOrchestrate: vi.fn(),
  mockOrchParallel: vi.fn(),
  mockProcessScript: vi.fn(),
  mockPrisma: {
    project: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../orchestrator/pipeline.js', () => ({
  orchestrate: (...args: unknown[]) => mockOrchestrate(...args),
  orchestrateParallel: (...args: unknown[]) => mockOrchParallel(...args),
}));

vi.mock('../director/pipeline.js', () => ({
  processScript: (...args: unknown[]) => mockProcessScript(...args),
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../lib/logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), generation: vi.fn() },
}));

// ── imports after mocks ───────────────────────────────────────────────────────

import router from './orchestrate.js';

// ── helpers ────────────────────────────────────────────────────────────────────

// SceneSchema requires scene_id + dialogue (array); everything else optional.
// DirectorJSONSchema requires project_id to be a valid UUID — use one in tests.
const TEST_PROJECT_ID = '00000000-0000-0000-0000-000000000001';

const VALID_SCENE = {
  scene_id: 's1',
  dialogue: [],
};

const VALID_MANIFEST = { total_duration: 10, scenes: [] };

/**
 * Creates a minimal http server with optional req.user injection.
 * Sends one POST /orchestrate request and returns status + body.
 */
async function post(
  body: unknown,
  userId?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const app = express();
  app.use(express.json());

  // Inject req.user before the router if userId provided
  if (userId) {
    app.use((req, _res, next) => {
      (req as express.Request & { user?: { id: string } }).user = { id: userId };
      next();
    });
  }

  app.use('/', router);

  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      const payload = JSON.stringify(body);

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: '/orchestrate',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            server.close();
            try {
              resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
            } catch (e) {
              reject(e);
            }
          });
        },
      );
      req.on('error', (e) => { server.close(); reject(e); });
      req.write(payload);
      req.end();
    });
    server.on('error', reject);
  });
}

// =============================================================================
// Ownership checks (BL-013)
// =============================================================================

describe('orchestrate: ownership check (BL-013)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 404 when project does not exist', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);

    const { status, body } = await post(
      { project_id: TEST_PROJECT_ID, scenes: [VALID_SCENE] },
      'user-abc',
    );

    expect(status).toBe(404);
    expect(body.status).toBe('error');
    expect(body.message).toMatch(/not found/i);
    expect(mockOrchestrate).not.toHaveBeenCalled();
    expect(mockOrchParallel).not.toHaveBeenCalled();
  });

  it('returns 403 when authenticated user does not own the project', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ userId: 'owner-xyz' });

    const { status, body } = await post(
      { project_id: TEST_PROJECT_ID, scenes: [VALID_SCENE] },
      'attacker-abc',
    );

    expect(status).toBe(403);
    expect(body.status).toBe('error');
    expect(body.message).toMatch(/forbidden/i);
    expect(mockOrchestrate).not.toHaveBeenCalled();
    expect(mockOrchParallel).not.toHaveBeenCalled();
  });

  it('proceeds when authenticated user owns the project', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ userId: 'user-abc' });
    mockOrchParallel.mockResolvedValue({ audio_urls: ['out.m4a'], manifest: VALID_MANIFEST });

    const { status, body } = await post(
      { project_id: TEST_PROJECT_ID, scenes: [VALID_SCENE] },
      'user-abc',
    );

    expect(status).toBe(200);
    expect(body.status).toBe('success');
    expect(mockPrisma.project.findUnique).toHaveBeenCalledWith({
      where: { id: TEST_PROJECT_ID },
      select: { userId: true },
    });
  });

  it('skips ownership check and proceeds when req.user is absent (AUTH_DISABLED)', async () => {
    mockOrchParallel.mockResolvedValue({ audio_urls: [], manifest: VALID_MANIFEST });

    const { status, body } = await post(
      { project_id: TEST_PROJECT_ID, scenes: [VALID_SCENE] },
      // no userId — simulates AUTH_DISABLED / unauthenticated in dev
    );

    expect(status).toBe(200);
    expect(body.status).toBe('success');
    expect(mockPrisma.project.findUnique).not.toHaveBeenCalled();
  });

  it('continues (non-fatal) when DB is unavailable during ownership check', async () => {
    mockPrisma.project.findUnique.mockRejectedValue(new Error('Connection refused'));
    mockOrchParallel.mockResolvedValue({ audio_urls: [], manifest: VALID_MANIFEST });

    const { status, body } = await post(
      { project_id: TEST_PROJECT_ID, scenes: [VALID_SCENE] },
      'user-abc',
    );

    // Should proceed even if DB check fails
    expect(status).toBe(200);
    expect(body.status).toBe('success');
  });
});

// =============================================================================
// Happy path
// =============================================================================

describe('orchestrate: happy path', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 200 with audio_urls when scenes are provided', async () => {
    mockOrchParallel.mockResolvedValue({ audio_urls: ['scene1.m4a'], manifest: VALID_MANIFEST });

    const { status, body } = await post({ project_id: TEST_PROJECT_ID, scenes: [VALID_SCENE] });

    expect(status).toBe(200);
    expect(body.status).toBe('success');
    expect(body.audio_urls).toEqual(['scene1.m4a']);
  });

  it('returns 400 for missing project_id', async () => {
    const { status, body } = await post({ scenes: [VALID_SCENE] });
    expect(status).toBe(400);
    expect(body.status).toBe('error');
  });

  it('returns 500 when orchestration throws', async () => {
    mockOrchParallel.mockRejectedValue(new Error('FFmpeg crash'));

    const { status, body } = await post({ project_id: TEST_PROJECT_ID, scenes: [VALID_SCENE] });

    expect(status).toBe(500);
    expect(body.status).toBe('error');
    expect(body.message).toContain('FFmpeg crash');
  });
});
