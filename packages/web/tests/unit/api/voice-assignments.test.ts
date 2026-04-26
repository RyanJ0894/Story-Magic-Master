/**
 * Tests for Voice Assignments + Workflow Mode + Audio Overrides API Routes
 *
 * GET /PUT /api/projects/[id]/voice-assignments
 * GET /POST /api/projects/[id]/workflow-mode
 * GET /PUT  /api/projects/[id]/audio-overrides
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

const mockPrisma = {
  project: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

const mockValidateCsrf = vi.fn(() => null);
vi.mock('@/lib/csrf', () => ({
  validateCsrf: (...args: unknown[]) => mockValidateCsrf(...args),
}));

vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

const { GET: getVoiceAssignments, PUT: putVoiceAssignments } = await import(
  '@/app/api/projects/[id]/voice-assignments/route'
);
const { GET: getWorkflowMode, POST: postWorkflowMode } = await import(
  '@/app/api/projects/[id]/workflow-mode/route'
);
const { GET: getAudioOverrides, PUT: putAudioOverrides } = await import(
  '@/app/api/projects/[id]/audio-overrides/route'
);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'user_test123';

const MOCK_PROJECT = {
  id: PROJECT_ID,
  userId: USER_ID,
  voiceAssignments: [{ character_name: 'NARRATOR', voice_id: 'abc123', voice_name: 'George' }],
  audioOverrides: [],
  preferredWorkflowMode: 'automatic',
  currentRunNumber: 1,
};

function makeRequest(
  method: string,
  body?: Record<string, unknown>,
): NextRequest {
  return new NextRequest(`http://localhost/api/projects/${PROJECT_ID}/voice-assignments`, {
    method,
    headers: { 'Content-Type': 'application/json', origin: 'http://localhost:22000' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeParams() {
  return { params: Promise.resolve({ id: PROJECT_ID }) };
}

// ── Shared auth setup helper ──────────────────────────────────────────────────

function setupAuth() {
  mockAuth.mockReturnValue({ userId: USER_ID });
  mockPrisma.project.findFirst.mockResolvedValue(MOCK_PROJECT);
}

// =============================================================================
// Voice Assignments
// =============================================================================

describe('GET /api/projects/[id]/voice-assignments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  it('returns voice assignments for authorized user', async () => {
    mockPrisma.project.findFirst
      .mockResolvedValueOnce(MOCK_PROJECT) // withProjectAuth ownership check
      .mockResolvedValueOnce(MOCK_PROJECT); // route handler

    const req = makeRequest('GET');
    const res = await getVoiceAssignments(req, makeParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.assignments).toHaveLength(1);
    expect(data.assignments[0].character_name).toBe('NARRATOR');
  });

  it('returns empty array when no assignments saved', async () => {
    mockPrisma.project.findFirst
      .mockResolvedValueOnce(MOCK_PROJECT)
      .mockResolvedValueOnce({ ...MOCK_PROJECT, voiceAssignments: null });

    const req = makeRequest('GET');
    const res = await getVoiceAssignments(req, makeParams());
    const data = await res.json();

    expect(data.assignments).toEqual([]);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockReturnValue({ userId: null });
    mockPrisma.project.findFirst.mockResolvedValue(null);

    const req = makeRequest('GET');
    const res = await getVoiceAssignments(req, makeParams());

    expect(res.status).toBe(401);
  });

  it('returns 404 when project not owned by user', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);

    const req = makeRequest('GET');
    const res = await getVoiceAssignments(req, makeParams());

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/projects/[id]/voice-assignments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  it('saves voice assignments and returns success', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(MOCK_PROJECT);
    mockPrisma.project.update.mockResolvedValue(MOCK_PROJECT);

    const assignments = [
      { character_name: 'JOHN', voice_id: 'xyz789', voice_name: 'Will', user_selected: true, locked: false },
    ];
    const req = makeRequest('PUT', { assignments });
    const res = await putVoiceAssignments(req, makeParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.assignments).toHaveLength(1);
    expect(mockPrisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PROJECT_ID } })
    );
  });

  it('returns 400 for invalid schema — missing voice_id', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(MOCK_PROJECT);

    const req = makeRequest('PUT', {
      assignments: [{ character_name: 'JOHN' }], // missing voice_id, voice_name
    });
    const res = await putVoiceAssignments(req, makeParams());

    expect(res.status).toBe(400);
  });

  it('returns 500 when DB update throws', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(MOCK_PROJECT);
    mockPrisma.project.update.mockRejectedValue(new Error('DB error'));

    const assignments = [
      { character_name: 'JOHN', voice_id: 'xyz789', voice_name: 'Will' },
    ];
    const req = makeRequest('PUT', { assignments });
    const res = await putVoiceAssignments(req, makeParams());

    expect(res.status).toBe(500);
  });
});

// =============================================================================
// Workflow Mode
// =============================================================================

describe('GET /api/projects/[id]/workflow-mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  it('returns workflow mode for project', async () => {
    mockPrisma.project.findFirst
      .mockResolvedValueOnce(MOCK_PROJECT) // withProjectAuth
      .mockResolvedValueOnce(MOCK_PROJECT); // route handler

    const req = makeRequest('GET');
    const res = await getWorkflowMode(req, makeParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.preferredMode).toBe('automatic');
    expect(data.currentRunNumber).toBe(1);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockReturnValue({ userId: null });
    mockPrisma.project.findFirst.mockResolvedValue(null);

    const req = makeRequest('GET');
    const res = await getWorkflowMode(req, makeParams());

    expect(res.status).toBe(401);
  });
});

describe('POST /api/projects/[id]/workflow-mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  it('updates workflow mode to fine_tuned', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(MOCK_PROJECT);
    mockPrisma.project.update.mockResolvedValue({ ...MOCK_PROJECT, preferredWorkflowMode: 'fine_tuned' });

    const req = makeRequest('POST', { mode: 'fine_tuned' });
    const res = await postWorkflowMode(req, makeParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.mode).toBe('fine_tuned');
  });

  it('rejects invalid mode value', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(MOCK_PROJECT);

    const req = makeRequest('POST', { mode: 'invalid_mode' });
    const res = await postWorkflowMode(req, makeParams());

    expect(res.status).toBe(400);
  });

  it('accepts automatic mode', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(MOCK_PROJECT);
    mockPrisma.project.update.mockResolvedValue(MOCK_PROJECT);

    const req = makeRequest('POST', { mode: 'automatic' });
    const res = await postWorkflowMode(req, makeParams());

    expect(res.status).toBe(200);
  });
});

// =============================================================================
// Audio Overrides
// =============================================================================

describe('GET /api/projects/[id]/audio-overrides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  it('returns audio overrides for project', async () => {
    const overrides = [
      {
        scene_id: 'scene_001',
        category: 'music',
        cue_index: 0,
        track_id: 'track_abc',
        file: 'music/m_tense_01.mp3',
        title: 'Tense Strings',
        user_selected: true,
        locked: true,
      },
    ];
    mockPrisma.project.findFirst
      .mockResolvedValueOnce(MOCK_PROJECT)
      .mockResolvedValueOnce({ ...MOCK_PROJECT, audioOverrides: overrides });

    const req = makeRequest('GET');
    const res = await getAudioOverrides(req, makeParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.overrides).toHaveLength(1);
    expect(data.overrides[0].scene_id).toBe('scene_001');
  });

  it('returns empty array when no overrides', async () => {
    mockPrisma.project.findFirst
      .mockResolvedValueOnce(MOCK_PROJECT)
      .mockResolvedValueOnce({ ...MOCK_PROJECT, audioOverrides: null });

    const req = makeRequest('GET');
    const res = await getAudioOverrides(req, makeParams());
    const data = await res.json();

    expect(data.overrides).toEqual([]);
  });
});

describe('PUT /api/projects/[id]/audio-overrides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  it('saves audio overrides and returns success', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(MOCK_PROJECT);
    mockPrisma.project.update.mockResolvedValue(MOCK_PROJECT);

    const overrides = [
      {
        scene_id: 'scene_001',
        category: 'music',
        cue_index: 0,
        track_id: 'track_abc',
        file: 'music/m_tense_01.mp3',
        title: 'Tense Strings',
        user_selected: true,
        locked: false,
      },
    ];
    const req = makeRequest('PUT', { overrides });
    const res = await putAudioOverrides(req, makeParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.overrides).toHaveLength(1);
  });

  it('rejects invalid category', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(MOCK_PROJECT);

    const req = makeRequest('PUT', {
      overrides: [
        { scene_id: 's1', category: 'invalid', cue_index: 0, track_id: 't1', file: 'f.mp3', title: 'T' },
      ],
    });
    const res = await putAudioOverrides(req, makeParams());

    expect(res.status).toBe(400);
  });

  it('returns 500 when DB update throws', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(MOCK_PROJECT);
    mockPrisma.project.update.mockRejectedValue(new Error('DB error'));

    const req = makeRequest('PUT', {
      overrides: [
        { scene_id: 's1', category: 'sfx', cue_index: 0, track_id: 't1', file: 'sfx/bang.mp3', title: 'Bang' },
      ],
    });
    const res = await putAudioOverrides(req, makeParams());

    expect(res.status).toBe(500);
  });
});
