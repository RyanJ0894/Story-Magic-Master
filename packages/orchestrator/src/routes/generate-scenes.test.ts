/**
 * Tests for generate-scenes route — Sprint 5 BL-008
 *
 * Validates pre-flight char/page limits and happy-path behaviour.
 * Uses express + node http.request (no supertest dependency).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import http from 'http';
import express from 'express';

// ── hoisted mocks ────────────────────────────────────────────────────────────

const { mockProcessScript, mockGetEnv } = vi.hoisted(() => ({
  mockProcessScript: vi.fn(),
  mockGetEnv: vi.fn(),
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

// ── imports after mocks ───────────────────────────────────────────────────────

import router from './generate-scenes.js';

// ── helpers ────────────────────────────────────────────────────────────────────

const DEFAULT_ENV = { MAX_SCRIPT_CHARS: 75_000, MAX_SCRIPT_PAGES: 150 };

const VALID_DIRECTOR_JSON = {
  project_id: 'test-proj',
  scenes: [
    { scene_id: 's1', scene_heading: 'INT. OFFICE - DAY', dialogue: [], audio_cues: [] },
  ],
};

/**
 * Creates a minimal http server with the generate-scenes router and sends one
 * POST request. Returns the response status and parsed JSON body.
 */
async function post(body: unknown, env = DEFAULT_ENV): Promise<{ status: number; body: Record<string, unknown> }> {
  mockGetEnv.mockReturnValue(env);

  const app = express();
  app.use(express.json());
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
              resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
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
      { project_id: 'proj-1', script_text: 'A'.repeat(75_001) }
    );
    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/character limit/i);
    expect(mockProcessScript).not.toHaveBeenCalled();
  });

  it('accepts script at exactly MAX_SCRIPT_CHARS', async () => {
    mockProcessScript.mockResolvedValue({ director_json: VALID_DIRECTOR_JSON, validation_report: {} });
    const { body } = await post(
      { project_id: 'proj-1', script_text: 'A'.repeat(75_000) }
    );
    expect(String(body.message ?? '')).not.toMatch(/character limit/i);
  });

  it('custom MAX_SCRIPT_CHARS is respected', async () => {
    const { status, body } = await post(
      { project_id: 'proj-1', script_text: 'A'.repeat(1_001) },
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
    // 11 pages × 500 chars/page = 5_500 chars → ~11 estimated pages; limit = 10
    const { status, body } = await post(
      { project_id: 'proj-1', script_text: 'A'.repeat(5_500) },
      { MAX_SCRIPT_CHARS: 200_000, MAX_SCRIPT_PAGES: 10 }
    );
    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/page limit/i);
    expect(mockProcessScript).not.toHaveBeenCalled();
  });

  it('accepts script within page limit', async () => {
    mockProcessScript.mockResolvedValue({ director_json: VALID_DIRECTOR_JSON, validation_report: {} });
    // 9 pages × 500 chars = 4_500 chars → ~9 estimated pages ≤ 10
    const { status, body } = await post(
      { project_id: 'proj-1', script_text: 'A'.repeat(4_500) },
      { MAX_SCRIPT_CHARS: 200_000, MAX_SCRIPT_PAGES: 10 }
    );
    expect(String(body.message ?? '')).not.toMatch(/page limit/i);
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
      { project_id: 'proj-1', script_text: 'INT. ROOM - DAY\n\nJOHN\nHi.' }
    );

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.scene_count).toBe(1);
    expect(mockProcessScript).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: 'proj-1' })
    );
  });

  it('returns 400 for missing project_id', async () => {
    const { status, body } = await post({ script_text: 'INT. ROOM - DAY\n\nJOHN\nHi.' });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('returns 500 when processScript throws', async () => {
    mockProcessScript.mockRejectedValue(new Error('LLM timeout'));

    const { status, body } = await post(
      { project_id: 'proj-1', script_text: 'INT. ROOM - DAY\n\nJOHN\nHi.' }
    );

    expect(status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.message).toContain('LLM timeout');
  });
});
