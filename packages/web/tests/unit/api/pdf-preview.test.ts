// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth() }));

vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// pdf-parse mock — returns controlled numpages + text
const mockPdfParse = vi.fn();
vi.mock('pdf-parse', () => ({ default: (...args: unknown[]) => mockPdfParse(...args) }));

// ── Import after mocks ────────────────────────────────────────────────────────

const { POST } = await import('@/app/api/reader/pdf-preview/route');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(file?: File): Request {
  if (!file) {
    return new Request('http://localhost/api/reader/pdf-preview', { method: 'POST' });
  }
  const form = new FormData();
  form.append('file', file);
  return new Request('http://localhost/api/reader/pdf-preview', { method: 'POST', body: form });
}

function makePdf(name = 'test.pdf', sizeBytes = 50_000): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type: 'application/pdf' });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/reader/pdf-preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: 'user_123' });
    mockPdfParse.mockResolvedValue({ text: 'INT. SCENE 1\n'.repeat(80), numpages: 10 });
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(makeRequest(makePdf()));
    expect(res.status).toBe(401);
  });

  it('returns 400 when no file field is present', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/form data|file/i);
  });

  it('returns correct page count from pdf-parse', async () => {
    mockPdfParse.mockResolvedValue({ text: 'Some text'.repeat(100), numpages: 42 });
    const res = await POST(makeRequest(makePdf()));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pageCount).toBe(42);
  });

  it('returns needsOCR false for text-rich PDF', async () => {
    // 250+ chars per page → well above the 50 char/page threshold
    mockPdfParse.mockResolvedValue({
      text: 'A'.repeat(250 * 10),
      numpages: 10,
    });
    const res = await POST(makeRequest(makePdf()));
    const data = await res.json();
    expect(data.needsOCR).toBe(false);
  });

  it('returns needsOCR true for scanned PDF (no extractable text)', async () => {
    mockPdfParse.mockResolvedValue({ text: '', numpages: 10 });
    const res = await POST(makeRequest(makePdf()));
    const data = await res.json();
    expect(data.needsOCR).toBe(true);
  });

  it('returns name and size from the uploaded file', async () => {
    const file = makePdf('screenplay.pdf', 12_345);
    const res = await POST(makeRequest(file));
    const data = await res.json();
    expect(data.name).toBe('screenplay.pdf');
    expect(data.size).toBe(12_345);
  });

  it('returns 413 for files over 10MB', async () => {
    const bigFile = makePdf('big.pdf', 11 * 1024 * 1024);
    const res = await POST(makeRequest(bigFile));
    expect(res.status).toBe(413);
  });

  it('returns 400 for non-PDF file type', async () => {
    const txtFile = new File(['hello'], 'script.txt', { type: 'text/plain' });
    const form = new FormData();
    form.append('file', txtFile);
    const req = new Request('http://localhost/api/reader/pdf-preview', {
      method: 'POST',
      body: form,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/pdf/i);
  });

  it('returns 422 when pdf-parse throws (corrupted file)', async () => {
    mockPdfParse.mockRejectedValue(new Error('Invalid PDF structure'));
    const res = await POST(makeRequest(makePdf()));
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error).toMatch(/corrupted|password/i);
  });
});
