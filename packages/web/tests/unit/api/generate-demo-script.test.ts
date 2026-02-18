/**
 * Tests for Generate Demo Script API Route
 *
 * POST /api/generate-demo-script - Generate a short demo screenplay
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// =============================================================================
// Mocks
// =============================================================================

const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {},
}));

vi.mock('@/lib/csrf', () => ({
  validateCsrf: vi.fn(() => null),
}));

vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: vi.fn(() => Promise.resolve(null)),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('@/lib/logger', () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const mockCreate = vi.fn();
vi.mock('openai', () => ({
  default: class {
    chat = {
      completions: {
        create: (...args: unknown[]) => mockCreate(...args),
      },
    };
  },
}));

// Import after mocks
const { POST } = await import('@/app/api/generate-demo-script/route');

// =============================================================================
// Helpers
// =============================================================================

function createRequest(
  url: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
  } = {},
): NextRequest {
  const init: RequestInit = {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      origin: 'http://localhost:22000',
    },
  };
  if (options.body) {
    init.body = JSON.stringify(options.body);
  }
  return new NextRequest(url, init);
}

// =============================================================================
// Setup
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: 'user_test123' });
  process.env.OPENAI_API_KEY = 'sk-test-key';
});

// =============================================================================
// POST /api/generate-demo-script
// =============================================================================

describe('POST /api/generate-demo-script', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const req = createRequest('http://localhost:22000/api/generate-demo-script', {
      body: { prompt: 'A cowboy walks into a bar' },
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe('AUTH_REQUIRED');
  });

  it('returns 400 when prompt is missing', async () => {
    const req = createRequest('http://localhost:22000/api/generate-demo-script', {
      body: {},
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when prompt is empty string', async () => {
    const req = createRequest('http://localhost:22000/api/generate-demo-script', {
      body: { prompt: '' },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 400 when prompt exceeds 500 characters', async () => {
    const req = createRequest('http://localhost:22000/api/generate-demo-script', {
      body: { prompt: 'x'.repeat(501) },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 500 when OPENAI_API_KEY is not configured', async () => {
    delete process.env.OPENAI_API_KEY;

    // Need to re-import since the key is read at module level
    // Instead, mock the create to throw an auth error
    mockCreate.mockRejectedValue(new Error('API key not set'));

    const req = createRequest('http://localhost:22000/api/generate-demo-script', {
      body: { prompt: 'A detective in 1920s Chicago' },
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('generates script and title successfully', async () => {
    // First call: script generation
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: 'FADE IN:\n\nINT. BAR - NIGHT\n\nA cowboy walks in...',
          },
        },
      ],
    });
    // Second call: title generation
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: 'The Last Saloon',
          },
        },
      ],
    });

    const req = createRequest('http://localhost:22000/api/generate-demo-script', {
      body: { prompt: 'A cowboy walks into a bar' },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.script).toBe('FADE IN:\n\nINT. BAR - NIGHT\n\nA cowboy walks in...');
    expect(data.title).toBe('The Last Saloon');
    expect(data.description).toBe('A cowboy walks into a bar');
  });

  it('returns default title when title generation returns empty', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'FADE IN: ...' } }],
    });
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '' } }],
    });

    const req = createRequest('http://localhost:22000/api/generate-demo-script', {
      body: { prompt: 'A short scene' },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.title).toBe('Untitled Scene');
  });

  it('returns 500 when OpenAI call fails', async () => {
    mockCreate.mockRejectedValue(new Error('Rate limit exceeded'));

    const req = createRequest('http://localhost:22000/api/generate-demo-script', {
      body: { prompt: 'A detective story' },
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Failed to generate script');
  });
});
