/**
 * Tests for generate-scenes route — Sprint 5 BL-008 / Sprint 6 BL-013 / BL-016
 *
 * Validates pre-flight char/page limits, ownership check, and happy-path behaviour.
 * Uses express + node http.request (no supertest dependency).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import http from 'http';
import express from 'express';

// ── hoisted mocks ────────────────────────────────────────────────────────────

const { mockProcessScript, mockGetEnv, mockPrisma, mockCheckAIProviders } = vi.hoisted(() => ({
  mockProcessScript: vi.fn(),
  mockGetEnv: vi.fn(),
  mockPrisma: {
    project: {
      findUnique: vi.fn(),
    },
  },
  mockCheckAIProviders: vi.fn(),
}));

vi.mock('../director/pipeline.js', () => ({
  processScript: (...args: unknown[]) => mockProcessScript(...args),
}));

vi.mock('../lib/logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), generation: vi.fn() },
}));

vi.mock('../lib/env.js', () => ({
  getEnv: (...args: unknown[]) => mockGetEnv(...args),
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../lib/ai-health.js', () => ({
  checkAIProviders: (...args: unknown[]) => mockCheckAIProviders(...args),
}));

// ── imports after mocks ───────────────────────────────────────────────────────

import router from './generate-scenes.js';

// ── helpers ────────────────────────────────────────────────────────────────────

const DEFAULT_ENV = {
  MAX_SCRIPT_CHARS: 75_000,
  MAX_SCRIPT_PAGES: 150,
  DIRECTOR_MODEL: 'anthropic/claude-sonnet-4-6',
  DIRECTOR_MODEL_ADVANCED: 'anthropic/claude-opus-4-6',
};

// GenerateScenesRequestSchema requires project_id to be a valid UUID since the
// hotfix that closed the migration-0040 raw-SQL drift. Use a stable test UUID.
const TEST_PROJECT_ID = '11111111-1111-4111-8111-111111111111';

const VALID_DIRECTOR_JSON = {
  project_id: TEST_PROJECT_ID,
  scenes: [
    { scene_id: 's1', scene_heading: 'INT. OFFICE - DAY', dialogue: [], audio_cues: [] },
  ],
};

/**
 * Creates a minimal http server with the generate-scenes router and sends one
 * POST request. Returns the response status and parsed JSON body.
 */
async function post(
  body: unknown,
  env = DEFAULT_ENV,
  userId?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  mockGetEnv.mockReturnValue(env);
  mockCheckAIProviders.mockResolvedValue({ canProceed: true, results: [], blockedBy: [] });

  const app = express();
  app.use(express.json());

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
        { hostname: '127.0.0.1', port, path: '/generate-scenes', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            server.close();
            try {
              // SSE responses: extract the last `data:` event; plain JSON for fast
              // pre-flight error paths (400/403/404/422/503) returned before the
              // SSE headers flush. Same pattern as orchestrate.test.ts's post()
              // helper after PR #394.
              const lastData = data.split('\n').filter(l => l.startsWith('data: ')).at(-1)?.slice(6).trim();
              resolve({ status: res.statusCode ?? 0, body: JSON.parse(lastData ?? data) });
            } catch (e) {
              reject(e);
            }
          });
        }
      );
      req.on('error', (e) => { server.close(); reject(e); });
      req.write(payload);
      req.end();
    });
    server.on('error', reject);
  });
}

// =============================================================================
// Pre-flight — char limit (BL-008)
// =============================================================================

describe('generate-scenes pre-flight: char limit', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 when script exceeds MAX_SCRIPT_CHARS', async () => {
    const { status, body } = await post(
      { project_id: TEST_PROJECT_ID, script_text: 'A'.repeat(75_001) }
    );
    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/character limit/i);
    expect(mockProcessScript).not.toHaveBeenCalled();
  });

  it('accepts script at exactly MAX_SCRIPT_CHARS', async () => {
    mockProcessScript.mockResolvedValue({ director_json: VALID_DIRECTOR_JSON, validation_report: {} });
    const { body } = await post(
      { project_id: TEST_PROJECT_ID, script_text: 'A'.repeat(75_000) }
    );
    expect(String(body.message ?? '')).not.toMatch(/character limit/i);
  });

  it('custom MAX_SCRIPT_CHARS is respected', async () => {
    const { status, body } = await post(
      { project_id: TEST_PROJECT_ID, script_text: 'A'.repeat(1_001) },
      { MAX_SCRIPT_CHARS: 1_000, MAX_SCRIPT_PAGES: 150 }
    );
    expect(status).toBe(400);
    expect(body.message).toMatch(/character limit/i);
  });
});

// =============================================================================
// Pre-flight — page limit (BL-008)
// =============================================================================

describe('generate-scenes pre-flight: page limit', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 when estimated page count exceeds MAX_SCRIPT_PAGES', async () => {
    // Real screenplay density: ~2,200 chars/page.
    // 11 pages × 2,200 chars/page = 24,200 chars → ~11 estimated pages; limit = 10.
    const { status, body } = await post(
      { project_id: TEST_PROJECT_ID, script_text: 'A'.repeat(24_200) },
      { MAX_SCRIPT_CHARS: 200_000, MAX_SCRIPT_PAGES: 10 }
    );
    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/page limit/i);
    expect(mockProcessScript).not.toHaveBeenCalled();
  });

  it('accepts script within page limit', async () => {
    mockProcessScript.mockResolvedValue({ director_json: VALID_DIRECTOR_JSON, validation_report: {} });
    // 9 pages × 2,200 chars = 19,800 chars → ~9 estimated pages ≤ 10
    const { status, body } = await post(
      { project_id: TEST_PROJECT_ID, script_text: 'A'.repeat(19_800) },
      { MAX_SCRIPT_CHARS: 200_000, MAX_SCRIPT_PAGES: 10 }
    );
    expect(String(body.message ?? '')).not.toMatch(/page limit/i);
    expect(mockProcessScript).toHaveBeenCalledTimes(1);
  });

  it('a real 30-page script (66K chars) is estimated as ~30 pages, not ~132', async () => {
    // Before fix: Math.ceil(66_000 / 500) = 132 pages — triggers a false block
    // at MAX_SCRIPT_PAGES=150 on any script over ~75 pages of real content.
    // After fix: Math.ceil(66_000 / 2_200) = 30 pages — correctly passes a 30-page limit.
    mockProcessScript.mockResolvedValue({ director_json: VALID_DIRECTOR_JSON, validation_report: {} });
    const thirtyPageScript = 'A'.repeat(66_000);
    const { status, body } = await post(
      { project_id: TEST_PROJECT_ID, script_text: thirtyPageScript },
      { MAX_SCRIPT_CHARS: 200_000, MAX_SCRIPT_PAGES: 35 }, // 35-page limit → 30-page script must pass
    );
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockProcessScript).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// Happy path
// =============================================================================

describe('generate-scenes happy path', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls processScript and returns 200 with scene_count', async () => {
    mockProcessScript.mockResolvedValue({ director_json: VALID_DIRECTOR_JSON, validation_report: {} });

    const { status, body } = await post(
      { project_id: TEST_PROJECT_ID, script_text: 'INT. ROOM - DAY\n\nJOHN\nHi.' }
    );

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.scene_count).toBe(1);
    expect(mockProcessScript).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: TEST_PROJECT_ID }),
      expect.objectContaining({ directorModel: expect.any(String) })
    );
  });

  // PR δ (2026-06-24): regression guard for the SSE conversion. The wire
  // format must be `text/event-stream` once we're past the fast pre-flight
  // error paths, and the response body must include at least one `data:`
  // event whose payload contains `director_json`. If anyone "cleans up" the
  // SSE setup to plain JSON, this lights up before prod regresses to the
  // 300 s Render-proxy timeout that caused the 2026-06-24 04:56:32 incident.
  it('emits SSE on the long-running path with the result as a final data event', async () => {
    mockProcessScript.mockResolvedValue({ director_json: VALID_DIRECTOR_JSON, validation_report: {} });

    // Raw HTTP probe so we can inspect headers + body shape directly (the
    // `post()` helper hides the wire format by parsing the last data event).
    mockGetEnv.mockReturnValue(DEFAULT_ENV);
    mockCheckAIProviders.mockResolvedValue({ canProceed: true, results: [], blockedBy: [] });

    const app = express();
    app.use(express.json());
    app.use('/', router);

    const result = await new Promise<{ contentType: string; raw: string }>((resolve, reject) => {
      const server = http.createServer(app);
      server.listen(0, () => {
        const { port } = server.address() as { port: number };
        const payload = JSON.stringify({ project_id: TEST_PROJECT_ID, script_text: 'INT. ROOM - DAY\n\nJOHN\nHi.' });
        const req = http.request(
          { hostname: '127.0.0.1', port, path: '/generate-scenes', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
          (res) => {
            let data = '';
            res.on('data', (c) => { data += c; });
            res.on('end', () => {
              server.close();
              resolve({ contentType: String(res.headers['content-type'] ?? ''), raw: data });
            });
          },
        );
        req.on('error', (e) => { server.close(); reject(e); });
        req.write(payload);
        req.end();
      });
    });

    // Content-Type must be text/event-stream — that's the load-bearing
    // header that tells the web-side wrapper to consume SSE.
    expect(result.contentType).toContain('text/event-stream');
    // Body must contain at least one `data:` event with the director_json.
    const dataLines = result.raw.split('\n').filter((l) => l.startsWith('data: '));
    expect(dataLines.length).toBeGreaterThan(0);
    const lastEvent = JSON.parse(dataLines.at(-1)!.slice('data: '.length).trim());
    expect(lastEvent.director_json).toBeDefined();
  });

  it('returns 400 for missing project_id', async () => {
    const { status, body } = await post({ script_text: 'INT. ROOM - DAY\n\nJOHN\nHi.' });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('returns 200 with error body when processScript throws', async () => {
    // PR δ (SSE conversion): once SSE headers are flushed, the HTTP status is
    // always 200 — errors are conveyed in the final `data:` event body with
    // `status: 'error'`. The web-side `orchestratorFetch` wrapper maps that
    // to a synthetic HTTP 500 Response so existing callers see the prior
    // contract. Same pattern as orchestrate.test.ts after PR #394.
    mockProcessScript.mockRejectedValue(new Error('LLM timeout'));

    const { status, body } = await post(
      { project_id: TEST_PROJECT_ID, script_text: 'INT. ROOM - DAY\n\nJOHN\nHi.' }
    );

    expect(status).toBe(200);
    expect(body.status).toBe('error');
    expect(body.success).toBe(false);
    expect(body.message).toContain('LLM timeout');
  });
});

// =============================================================================
// Ownership check (BL-013 / BL-016)
// =============================================================================

describe('generate-scenes: ownership check (BL-013)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 404 when project does not exist', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);

    const { status, body } = await post(
      { project_id: TEST_PROJECT_ID, script_text: 'INT. ROOM - DAY' },
      DEFAULT_ENV,
      'user-abc',
    );

    expect(status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/not found/i);
    expect(mockProcessScript).not.toHaveBeenCalled();
  });

  it('returns 403 when authenticated user does not own the project', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ userId: 'owner-xyz' });

    const { status, body } = await post(
      { project_id: TEST_PROJECT_ID, script_text: 'INT. ROOM - DAY' },
      DEFAULT_ENV,
      'attacker-abc',
    );

    expect(status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/forbidden/i);
    expect(mockProcessScript).not.toHaveBeenCalled();
  });

  it('proceeds when authenticated user owns the project', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ userId: 'user-abc' });
    mockProcessScript.mockResolvedValue({ director_json: VALID_DIRECTOR_JSON, validation_report: {} });

    const { status, body } = await post(
      { project_id: TEST_PROJECT_ID, script_text: 'INT. ROOM - DAY' },
      DEFAULT_ENV,
      'user-abc',
    );

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockPrisma.project.findUnique).toHaveBeenCalledWith({
      where: { id: TEST_PROJECT_ID },
      select: { userId: true },
    });
  });

  it('skips ownership check when req.user is absent (AUTH_DISABLED / dev)', async () => {
    mockProcessScript.mockResolvedValue({ director_json: VALID_DIRECTOR_JSON, validation_report: {} });

    const { status, body } = await post(
      { project_id: TEST_PROJECT_ID, script_text: 'INT. ROOM - DAY' },
      DEFAULT_ENV,
      // no userId
    );

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockPrisma.project.findUnique).not.toHaveBeenCalled();
  });

  it('continues (non-fatal) when DB is unavailable during ownership check', async () => {
    mockPrisma.project.findUnique.mockRejectedValue(new Error('Connection refused'));
    mockProcessScript.mockResolvedValue({ director_json: VALID_DIRECTOR_JSON, validation_report: {} });

    const { status, body } = await post(
      { project_id: TEST_PROJECT_ID, script_text: 'INT. ROOM - DAY' },
      DEFAULT_ENV,
      'user-abc',
    );

    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});
