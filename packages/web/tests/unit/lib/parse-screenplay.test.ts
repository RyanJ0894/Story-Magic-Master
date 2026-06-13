/**
 * Tests for lib/upload/parse-screenplay.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock mammoth
const mockExtractRawText = vi.fn();
vi.mock('mammoth', () => ({
  default: { extractRawText: (...args: unknown[]) => mockExtractRawText(...args) },
}));

// Mock unpdf. The implementation does:
//   const { extractText, getDocumentProxy } = await import('unpdf');
//   const pdf = await getDocumentProxy(uint8);
//   const { text } = await extractText(pdf, { mergePages: true });
// mockPdfParse keeps the existing test-handle name from the pdf-parse era —
// existing test cases drive it the same way (mockResolvedValue / never-
// settling for the timeout test).
const mockPdfParse = vi.fn();
vi.mock('unpdf', () => ({
  getDocumentProxy: vi.fn(async (_buf: Uint8Array) => ({ numPages: 1 })),
  extractText: vi.fn(async () => {
    const result = await mockPdfParse();
    return { text: result.text };
  }),
}));

import {
  parseScreenplay,
  parseFountain,
  parseFDX,
  getProjectNameFromFilename,
} from '@/lib/upload/parse-screenplay';

describe('parseScreenplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses a .txt file and returns text content', async () => {
    const text = 'INT. COFFEE SHOP - DAY\n\nSARAH sits alone.';
    const buffer = Buffer.from(text, 'utf-8');

    const result = await parseScreenplay(buffer, 'script.txt');

    expect(result.text).toBe(text);
    expect(result.pageCount).toBe(1);
  });

  it('parses a .md file and returns raw markdown', async () => {
    const md = '# Scene 1\n\n**INT. OFFICE - NIGHT**\n\nA tense standoff.';
    const buffer = Buffer.from(md, 'utf-8');

    const result = await parseScreenplay(buffer, 'script.md');

    expect(result.text).toBe(md);
    expect(result.pageCount).toBe(1);
  });

  it('parses a .docx file using mammoth', async () => {
    const extractedText = 'Extracted text from docx with many words repeated. '.repeat(10);
    mockExtractRawText.mockResolvedValue({ value: extractedText });
    const buffer = Buffer.from('fake-docx-bytes');

    const result = await parseScreenplay(buffer, 'script.docx');

    expect(mockExtractRawText).toHaveBeenCalledWith({ buffer });
    expect(result.text).toBe(extractedText);
  });

  it('parses a .pdf file via unpdf and returns extracted text', async () => {
    const pdfText = 'INT. COURTROOM - DAY\n\nThe judge speaks.';
    mockPdfParse.mockResolvedValue({ text: pdfText });
    const buffer = Buffer.from('fake-pdf-bytes');

    const result = await parseScreenplay(buffer, 'script.pdf');

    // unpdf is called with a Uint8Array view over the buffer — we assert on
    // the textual output rather than the precise argument shape, since
    // getDocumentProxy receives a Uint8Array and extractText receives a
    // document proxy (both mocked).
    expect(mockPdfParse).toHaveBeenCalled();
    expect(result.text).toBe(pdfText);
    expect(result.pageCount).toBe(1);
  });

  it('rejects files larger than 10MB', async () => {
    const bigBuffer = Buffer.alloc(11 * 1024 * 1024);

    await expect(parseScreenplay(bigBuffer, 'huge.txt')).rejects.toThrow(
      /File too large/
    );
  });

  it('rejects unsupported file types', async () => {
    const buffer = Buffer.from('some content');

    await expect(parseScreenplay(buffer, 'file.xlsx')).rejects.toThrow(
      /Unsupported file type/
    );
  });

  it('rejects .jpg files', async () => {
    const buffer = Buffer.from('image');

    await expect(parseScreenplay(buffer, 'photo.jpg')).rejects.toThrow(
      /Unsupported file type/
    );
  });

  it('handles an empty file and returns 0 pages', async () => {
    const buffer = Buffer.from('');

    const result = await parseScreenplay(buffer, 'empty.txt');

    expect(result.text).toBe('');
    expect(result.pageCount).toBe(0);
  });

  it('calculates page count correctly (250 words = 1 page)', async () => {
    const words = Array(250).fill('word').join(' ');
    const buffer = Buffer.from(words, 'utf-8');

    const result = await parseScreenplay(buffer, 'onepage.txt');

    expect(result.pageCount).toBe(1);
  });

  it('calculates page count correctly (500 words = 2 pages)', async () => {
    const words = Array(500).fill('word').join(' ');
    const buffer = Buffer.from(words, 'utf-8');

    const result = await parseScreenplay(buffer, 'twopages.txt');

    expect(result.pageCount).toBe(2);
  });

  it('rounds up partial pages (251 words = 2 pages)', async () => {
    const words = Array(251).fill('word').join(' ');
    const buffer = Buffer.from(words, 'utf-8');

    const result = await parseScreenplay(buffer, 'partial.txt');

    expect(result.pageCount).toBe(2);
  });
});

// =============================================================================
// Fountain parser
// =============================================================================

const FOUNTAIN_BASIC = `INT. COFFEE SHOP - DAY

SARAH sits alone at a corner table.

SARAH
(quietly)
I don't know what I'm doing here.`;

const FOUNTAIN_WITH_TITLE_PAGE = `Title: The Coffee Shop
Author: Jane Doe
Draft date: May 2026

${FOUNTAIN_BASIC}`;

const FOUNTAIN_WITH_NOTES = `INT. OFFICE - NIGHT [[this is a note]]

MICHAEL
We need to talk. /* old deleted line */`;

describe('parseFountain', () => {
  it('returns plain-text content as-is for a basic fountain script', () => {
    const result = parseFountain(FOUNTAIN_BASIC);
    expect(result).toContain('INT. COFFEE SHOP - DAY');
    expect(result).toContain('SARAH');
    expect(result).toContain("I don't know what I'm doing here.");
  });

  it('strips title page metadata block', () => {
    const result = parseFountain(FOUNTAIN_WITH_TITLE_PAGE);
    expect(result).not.toContain('Title: The Coffee Shop');
    expect(result).not.toContain('Author: Jane Doe');
    expect(result).toContain('INT. COFFEE SHOP - DAY');
    expect(result).toContain('SARAH');
  });

  it('strips inline notes [[ ... ]]', () => {
    const result = parseFountain(FOUNTAIN_WITH_NOTES);
    expect(result).not.toContain('[[this is a note]]');
    expect(result).toContain('INT. OFFICE - NIGHT');
  });

  it('strips boneyard block comments /* ... */', () => {
    const result = parseFountain(FOUNTAIN_WITH_NOTES);
    expect(result).not.toContain('/* old deleted line */');
    expect(result).toContain('We need to talk.');
  });

  it('handles CRLF line endings gracefully', () => {
    const crlf = FOUNTAIN_BASIC.replace(/\n/g, '\r\n');
    const result = parseFountain(crlf);
    expect(result).toContain('INT. COFFEE SHOP - DAY');
    expect(result).toContain('SARAH');
  });

  it('returns empty string for empty input', () => {
    expect(parseFountain('')).toBe('');
  });
});

describe('parseScreenplay — .fountain files', () => {
  it('parses a .fountain file and returns extracted text', async () => {
    const buffer = Buffer.from(FOUNTAIN_BASIC, 'utf-8');
    const result = await parseScreenplay(buffer, 'script.fountain');
    expect(result.text).toContain('INT. COFFEE SHOP - DAY');
    expect(result.text).toContain('SARAH');
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
  });

  it('strips title page from .fountain upload', async () => {
    const buffer = Buffer.from(FOUNTAIN_WITH_TITLE_PAGE, 'utf-8');
    const result = await parseScreenplay(buffer, 'myscript.fountain');
    expect(result.text).not.toContain('Author: Jane Doe');
    expect(result.text).toContain('INT. COFFEE SHOP - DAY');
  });
});

// =============================================================================
// FDX parser
// =============================================================================

const FDX_BASIC = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Template="No" Version="3">
  <Content>
    <Paragraph Type="Scene Heading"><Text>INT. COFFEE SHOP - DAY</Text></Paragraph>
    <Paragraph Type="Action"><Text>SARAH sits alone at a corner table.</Text></Paragraph>
    <Paragraph Type="Character"><Text>SARAH</Text></Paragraph>
    <Paragraph Type="Parenthetical"><Text>(quietly)</Text></Paragraph>
    <Paragraph Type="Dialogue"><Text>I don't know what I'm doing here.</Text></Paragraph>
  </Content>
</FinalDraft>`;

const FDX_WITH_ENTITIES = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Template="No" Version="3">
  <Content>
    <Paragraph Type="Action"><Text>Tom &amp; Jerry run. They shout &quot;Stop!&quot;</Text></Paragraph>
    <Paragraph Type="Character"><Text>TOM</Text></Paragraph>
    <Paragraph Type="Dialogue"><Text>Can&apos;t catch me!</Text></Paragraph>
  </Content>
</FinalDraft>`;

const FDX_MULTI_TEXT_NODES = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Template="No" Version="3">
  <Content>
    <Paragraph Type="Dialogue">
      <Text>Hello, </Text>
      <Text Style="Bold">world</Text>
      <Text>.</Text>
    </Paragraph>
  </Content>
</FinalDraft>`;

describe('parseFDX', () => {
  it('extracts scene heading from FDX', () => {
    const result = parseFDX(FDX_BASIC);
    expect(result).toContain('INT. COFFEE SHOP - DAY');
  });

  it('extracts character name from FDX', () => {
    const result = parseFDX(FDX_BASIC);
    expect(result).toContain('SARAH');
  });

  it('extracts dialogue from FDX', () => {
    const result = parseFDX(FDX_BASIC);
    expect(result).toContain("I don't know what I'm doing here.");
  });

  it('decodes XML entities in text content', () => {
    const result = parseFDX(FDX_WITH_ENTITIES);
    expect(result).toContain('Tom & Jerry');
    expect(result).toContain('"Stop!"');
    expect(result).toContain("Can't catch me!");
  });

  it('concatenates multiple Text nodes within a single Paragraph', () => {
    const result = parseFDX(FDX_MULTI_TEXT_NODES);
    expect(result).toContain('Hello, world.');
  });

  it('returns empty string for empty XML input', () => {
    expect(parseFDX('')).toBe('');
  });

  it('handles malformed XML gracefully (no throw)', () => {
    expect(() => parseFDX('<not valid xml')).not.toThrow();
  });
});

describe('parseScreenplay — .fdx files', () => {
  it('parses a .fdx file and returns extracted text', async () => {
    const buffer = Buffer.from(FDX_BASIC, 'utf-8');
    const result = await parseScreenplay(buffer, 'script.fdx');
    expect(result.text).toContain('INT. COFFEE SHOP - DAY');
    expect(result.text).toContain('SARAH');
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
  });

  it('decodes XML entities in .fdx upload', async () => {
    const buffer = Buffer.from(FDX_WITH_ENTITIES, 'utf-8');
    const result = await parseScreenplay(buffer, 'entities.fdx');
    expect(result.text).toContain('Tom & Jerry');
  });
});

// =============================================================================

describe('getProjectNameFromFilename', () => {
  it('strips extension from filename', () => {
    expect(getProjectNameFromFilename('My Script.docx')).toBe('My Script');
  });

  it('handles filenames with multiple dots', () => {
    expect(getProjectNameFromFilename('draft.v2.final.txt')).toBe(
      'draft.v2.final'
    );
  });

  it('strips path components', () => {
    expect(getProjectNameFromFilename('/fake/path/script.md')).toBe('script');
  });

  it('handles filename with no extension', () => {
    expect(getProjectNameFromFilename('README')).toBe('README');
  });
});

describe('parseScreenplay PDF timeout (#chris-2026-06-13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects with a friendly error when pdf-parse hangs past 20s', async () => {
    // Simulate the underlying library never resolving — the exact failure
    // mode chris hit. unpdf's mock-extractText awaits mockPdfParse, so a
    // never-settling promise here propagates through.
    mockPdfParse.mockImplementation(() => new Promise(() => {}));

    const buffer = Buffer.from('%PDF-1.4 fake');
    const parsePromise = parseScreenplay(buffer, 'stuck.pdf');
    // Attach a no-op catch before advancing timers so the rejection
    // doesn't surface as an unhandled error in the microtask queue before
    // expect.rejects gets a chance to attach its own handler.
    parsePromise.catch(() => {});

    // Advance fake timers past the 20s timeout.
    await vi.advanceTimersByTimeAsync(20_000);

    await expect(parsePromise).rejects.toThrow(/timed out after 20s/);
  });

  it('still returns parsed text when pdf-parse completes in time', async () => {
    mockPdfParse.mockResolvedValue({ text: 'INT. KITCHEN — DAY\nANNA enters.' });
    const buffer = Buffer.from('%PDF-1.4 ok');
    const result = await parseScreenplay(buffer, 'ok.pdf');
    expect(result.text).toContain('ANNA');
  });
});
