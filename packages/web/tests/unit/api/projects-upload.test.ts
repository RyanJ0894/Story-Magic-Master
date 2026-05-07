/**
 * Tests for Projects Upload API Route
 *
 * POST /api/projects/upload - Upload a screenplay file and create a project
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Clerk auth
const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

// Mock Prisma
const mockPrisma = {
  project: {
    create: vi.fn(),
  },
};
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Mock CSRF validation
const mockValidateCsrf = vi.fn(() => null);
vi.mock('@/lib/csrf', () => ({
  validateCsrf: (...args: unknown[]) => mockValidateCsrf(...args),
}));

// Mock parseScreenplay
const mockParseScreenplay = vi.fn();
vi.mock('@/lib/upload/parse-screenplay', () => ({
  parseScreenplay: (...args: unknown[]) => mockParseScreenplay(...args),
  getProjectNameFromFilename: (filename: string) => {
    const safe = filename.replace(/[\0]/g, '').replace(/^.*[/\\]/, '');
    const dot = safe.lastIndexOf('.');
    return dot > 0 ? safe.slice(0, dot) : safe;
  },
}));

// Mock createProject service
const mockCreateProject = vi.fn();
vi.mock('@/lib/services/projects', () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
}));

// Import after mocks
const { POST } = await import('@/app/api/projects/upload/route');

// =============================================================================
// Helpers
// =============================================================================

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';

function createFormDataRequest(
  fields: Record<string, string | File>,
  headers: Record<string, string> = {}
): NextRequest {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }

  return new NextRequest('http://localhost:22000/api/projects/upload', {
    method: 'POST',
    headers: {
      origin: 'http://localhost:22000',
      ...headers,
    },
    body: formData,
  });
}

function createFile(
  content: string,
  name: string,
  type: string
): File {
  return new File([content], name, { type });
}

// =============================================================================
// Tests
// =============================================================================

describe('POST /api/projects/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: 'user_test123' });
    mockValidateCsrf.mockReturnValue(null);
    mockParseScreenplay.mockResolvedValue({
      text: 'INT. OFFICE - DAY\n\nA scene.',
      pageCount: 1,
    });
    mockCreateProject.mockResolvedValue({
      id: PROJECT_ID,
      name: 'My Script',
      pageCount: 1,
    });
  });

  it('creates a project from a .txt file upload', async () => {
    const file = createFile('INT. OFFICE - DAY\n\nA scene.', 'script.txt', 'text/plain');
    const request = createFormDataRequest({ file, name: 'My Script' });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe(PROJECT_ID);
    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.anything(),
      'user_test123',
      expect.objectContaining({ name: 'My Script', pageCount: 1 })
    );
  });

  it('creates a project from a .md file upload', async () => {
    const file = createFile('# Scene 1\n\nDialogue.', 'screenplay.md', 'text/markdown');
    const request = createFormDataRequest({ file });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe(PROJECT_ID);
  });

  it('creates a project from a .docx file upload', async () => {
    const file = createFile(
      'fake-docx',
      'screenplay.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    const request = createFormDataRequest({ file });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe(PROJECT_ID);
  });

  it('rejects request with no file', async () => {
    const request = createFormDataRequest({ name: 'No File' });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('MISSING_FILE');
  });

  it('creates a project from a .pdf file upload', async () => {
    const file = createFile('fake-pdf', 'screenplay.pdf', 'application/pdf');
    const request = createFormDataRequest({ file });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe(PROJECT_ID);
  });

  it('rejects unsupported file types', async () => {
    const file = createFile('spreadsheet', 'doc.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const request = createFormDataRequest({ file });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('UNSUPPORTED_TYPE');
  });

  it('returns parse error when parseScreenplay throws', async () => {
    mockParseScreenplay.mockRejectedValue(new Error('File too large (6.0MB). Maximum size is 5MB.'));
    const file = createFile('x', 'big.txt', 'text/plain');
    const request = createFormDataRequest({ file });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('PARSE_ERROR');
    expect(data.error).toContain('File too large');
  });

  it('uses filename as project name when name is not provided', async () => {
    const file = createFile('Content here.', 'My Great Script.txt', 'text/plain');
    const request = createFormDataRequest({ file });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.anything(),
      'user_test123',
      expect.objectContaining({ name: 'My Great Script' })
    );
  });

  it('returns 401 when user is not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const file = createFile('text', 'script.txt', 'text/plain');
    const request = createFormDataRequest({ file });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it('allows .md files sent with text/plain mime type', async () => {
    // Browsers often send text/plain for .md files
    const file = createFile('# Markdown', 'script.md', 'text/plain');
    const request = createFormDataRequest({ file });

    const response = await POST(request);

    expect(response.status).toBe(201);
  });

  it('creates a project from a .fountain file upload', async () => {
    const file = createFile(
      'INT. COFFEE SHOP - DAY\n\nSARAH sits alone.',
      'script.fountain',
      'text/plain'
    );
    const request = createFormDataRequest({ file });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe(PROJECT_ID);
    expect(mockParseScreenplay).toHaveBeenCalledWith(expect.any(Buffer), 'script.fountain');
  });

  it('creates a project from a .fdx file upload', async () => {
    const file = createFile(
      '<FinalDraft><Content><Paragraph Type="Scene Heading"><Text>INT. OFFICE - DAY</Text></Paragraph></Content></FinalDraft>',
      'script.fdx',
      'application/xml'
    );
    const request = createFormDataRequest({ file });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe(PROJECT_ID);
    expect(mockParseScreenplay).toHaveBeenCalledWith(expect.any(Buffer), 'script.fdx');
  });
});
