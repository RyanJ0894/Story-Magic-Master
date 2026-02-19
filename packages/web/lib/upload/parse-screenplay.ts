import mammoth from 'mammoth';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const WORDS_PER_PAGE = 250;
const ALLOWED_EXTENSIONS = ['.txt', '.md', '.docx'] as const;

type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

export interface ParseResult {
  text: string;
  pageCount: number;
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

function sanitizeFilename(filename: string): string {
  // Strip path components and null bytes
  return filename.replace(/[\0]/g, '').replace(/^.*[/\\]/, '');
}

export function getProjectNameFromFilename(filename: string): string {
  const safe = sanitizeFilename(filename);
  const dot = safe.lastIndexOf('.');
  return dot > 0 ? safe.slice(0, dot) : safe;
}

function countPages(text: string): number {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount === 0) return 0;
  return Math.ceil(wordCount / WORDS_PER_PAGE);
}

export async function parseScreenplay(
  buffer: Buffer,
  filename: string
): Promise<ParseResult> {
  const safe = sanitizeFilename(filename);
  const ext = getExtension(safe) as AllowedExtension;

  if (!ALLOWED_EXTENSIONS.includes(ext as AllowedExtension)) {
    throw new Error(
      `Unsupported file type "${ext}". Accepted formats: .txt, .md, .docx`
    );
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(
      `File too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Maximum size is 5MB.`
    );
  }

  let text: string;

  switch (ext) {
    case '.txt':
    case '.md':
      text = buffer.toString('utf-8');
      break;
    case '.docx': {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
      break;
    }
  }

  return {
    text,
    pageCount: countPages(text),
  };
}
