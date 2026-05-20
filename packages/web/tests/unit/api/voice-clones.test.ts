import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// =============================================================================
// Mocks
// =============================================================================

const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth() }));

const mockPrisma = {
  voiceClone: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

const mockValidateCsrf = vi.fn(() => null);
vi.mock('@/lib/csrf', () => ({ validateCsrf: (...args: unknown[]) => mockValidateCsrf(...args) }));

vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { GET, POST } = await import('@/app/api/voices/clones/route');
const { DELETE } = await import('@/app/api/voices/clones/[id]/route');

// =============================================================================
// Helpers
// =============================================================================

const USER_ID = 'user_test_abc';

function makeRequest(method: string, formData?: FormData): NextRequest {
  return new NextRequest('http://localhost/api/voices/clones', {
    method,
    body: formData,
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('GET /api/voices/clones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ userId: USER_ID });
  });

  it('returns clones for the authenticated user', async () => {
    const clones = [
      { id: 'uuid-1', name: 'My Voice', elevenLabsVoiceId: 'el_abc123', createdAt: new Date() },
    ];
    mockPrisma.voiceClone.findMany.mockResolvedValue(clones);

    const res = await GET(makeRequest('GET'), {} as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.clones).toHaveLength(1);
    expect(mockPrisma.voiceClone.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID } })
    );
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockReturnValue({ userId: null });
    const res = await GET(makeRequest('GET'), {} as never);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/voices/clones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ userId: USER_ID });
    mockValidateCsrf.mockReturnValue(null);
  });

  it('rejects when user has reached the 5-clone limit', async () => {
    mockPrisma.voiceClone.count.mockResolvedValue(5);

    const form = new FormData();
    form.append('name', 'New Voice');
    form.append('file', new Blob(['audio'], { type: 'audio/mpeg' }), 'sample.mp3');

    const res = await POST(makeRequest('POST', form), {} as never);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/Maximum/);
  });

  it('returns 400 when name is missing', async () => {
    mockPrisma.voiceClone.count.mockResolvedValue(0);

    const form = new FormData();
    form.append('name', ' ');
    form.append('file', new Blob(['audio'], { type: 'audio/mpeg' }), 'sample.mp3');

    const res = await POST(makeRequest('POST', form), {} as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 when file is missing', async () => {
    mockPrisma.voiceClone.count.mockResolvedValue(0);

    const form = new FormData();
    form.append('name', 'My Voice');

    const res = await POST(makeRequest('POST', form), {} as never);
    expect(res.status).toBe(400);
  });

  it('returns 503 when ELEVENLABS_API_KEY is not set', async () => {
    mockPrisma.voiceClone.count.mockResolvedValue(0);
    const original = process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;

    const form = new FormData();
    form.append('name', 'My Voice');
    form.append('file', new Blob(['audio'], { type: 'audio/mpeg' }), 'sample.mp3');

    const res = await POST(makeRequest('POST', form), {} as never);
    expect(res.status).toBe(503);

    process.env.ELEVENLABS_API_KEY = original;
  });

  it('creates a clone and returns 201 on success', async () => {
    mockPrisma.voiceClone.count.mockResolvedValue(0);
    process.env.ELEVENLABS_API_KEY = 'test_key';

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ voice_id: 'el_newvoice' }),
    });

    const created = { id: 'uuid-new', name: 'My Voice', elevenLabsVoiceId: 'el_newvoice', createdAt: new Date() };
    mockPrisma.voiceClone.create.mockResolvedValue(created);

    const form = new FormData();
    form.append('name', 'My Voice');
    form.append('file', new Blob(['audio'], { type: 'audio/mpeg' }), 'sample.mp3');

    const res = await POST(makeRequest('POST', form), {} as never);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.clone.elevenLabsVoiceId).toBe('el_newvoice');
    expect(mockPrisma.voiceClone.create).toHaveBeenCalled();
  });

  it('returns 502 when ElevenLabs API call fails', async () => {
    mockPrisma.voiceClone.count.mockResolvedValue(0);
    process.env.ELEVENLABS_API_KEY = 'test_key';

    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => 'Unprocessable audio',
    });

    const form = new FormData();
    form.append('name', 'My Voice');
    form.append('file', new Blob(['audio'], { type: 'audio/mpeg' }), 'sample.mp3');

    const res = await POST(makeRequest('POST', form), {} as never);
    expect(res.status).toBe(502);
  });
});

// =============================================================================

describe('DELETE /api/voices/clones/[id]', () => {
  const CLONE_ID = 'clone-uuid-001';
  const EL_VOICE_ID = 'el_abc123';

  function makeDeleteRequest(): NextRequest {
    return new NextRequest(`http://localhost/api/voices/clones/${CLONE_ID}`, {
      method: 'DELETE',
    });
  }

  function makeRouteContext() {
    return { params: Promise.resolve({ id: CLONE_ID }) };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ userId: USER_ID });
    mockValidateCsrf.mockReturnValue(null);
  });

  it('returns 404 when clone does not belong to the user', async () => {
    mockPrisma.voiceClone.findFirst.mockResolvedValue(null);

    const res = await DELETE(makeDeleteRequest(), makeRouteContext() as never);
    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockReturnValue({ userId: null });
    const res = await DELETE(makeDeleteRequest(), makeRouteContext() as never);
    expect(res.status).toBe(401);
  });

  it('deletes from ElevenLabs and Prisma on success', async () => {
    mockPrisma.voiceClone.findFirst.mockResolvedValue({
      id: CLONE_ID,
      elevenLabsVoiceId: EL_VOICE_ID,
    });
    process.env.ELEVENLABS_API_KEY = 'test_key';
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    mockPrisma.voiceClone.delete.mockResolvedValue({});

    const res = await DELETE(makeDeleteRequest(), makeRouteContext() as never);

    expect(res.status).toBe(204);
    expect(mockFetch).toHaveBeenCalledWith(
      `https://api.elevenlabs.io/v1/voices/${EL_VOICE_ID}`,
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(mockPrisma.voiceClone.delete).toHaveBeenCalledWith({ where: { id: CLONE_ID } });
  });

  it('still deletes from Prisma when ElevenLabs returns 404 (voice already gone)', async () => {
    mockPrisma.voiceClone.findFirst.mockResolvedValue({
      id: CLONE_ID,
      elevenLabsVoiceId: EL_VOICE_ID,
    });
    process.env.ELEVENLABS_API_KEY = 'test_key';
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    mockPrisma.voiceClone.delete.mockResolvedValue({});

    const res = await DELETE(makeDeleteRequest(), makeRouteContext() as never);

    // 404 from ElevenLabs is tolerated — voice was already removed
    expect(res.status).toBe(204);
    expect(mockPrisma.voiceClone.delete).toHaveBeenCalled();
  });

  it('returns 502 when ElevenLabs delete fails with non-404 error', async () => {
    mockPrisma.voiceClone.findFirst.mockResolvedValue({
      id: CLONE_ID,
      elevenLabsVoiceId: EL_VOICE_ID,
    });
    process.env.ELEVENLABS_API_KEY = 'test_key';
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'Server error' });

    const res = await DELETE(makeDeleteRequest(), makeRouteContext() as never);

    expect(res.status).toBe(502);
    // Prisma delete should NOT be called — EL failed
    expect(mockPrisma.voiceClone.delete).not.toHaveBeenCalled();
  });

  it('deletes from Prisma only when no ElevenLabs API key is configured', async () => {
    mockPrisma.voiceClone.findFirst.mockResolvedValue({
      id: CLONE_ID,
      elevenLabsVoiceId: EL_VOICE_ID,
    });
    const orig = process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
    mockPrisma.voiceClone.delete.mockResolvedValue({});

    const res = await DELETE(makeDeleteRequest(), makeRouteContext() as never);

    expect(res.status).toBe(204);
    expect(mockFetch).not.toHaveBeenCalled();
    process.env.ELEVENLABS_API_KEY = orig;
  });
});
