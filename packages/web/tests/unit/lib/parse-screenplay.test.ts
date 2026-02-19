/**
 * Tests for lib/upload/parse-screenplay.ts
 */

import { describe, it, expect, vi } from 'vitest';

// Mock mammoth
const mockExtractRawText = vi.fn();
vi.mock('mammoth', () => ({
  default: { extractRawText: (...args: unknown[]) => mockExtractRawText(...args) },
}));

// Mock pdf-parse
const mockPdfParse = vi.fn();
vi.mock('pdf-parse', () => ({
  default: (...args: unknown[]) => mockPdfParse(...args),
}));

import {
  parseScreenplay,
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

  it('parses a .pdf file using pdf-parse', async () => {
    const pdfText = 'INT. COURTROOM - DAY\n\nThe judge speaks.';
    mockPdfParse.mockResolvedValue({ text: pdfText });
    const buffer = Buffer.from('fake-pdf-bytes');

    const result = await parseScreenplay(buffer, 'script.pdf');

    expect(mockPdfParse).toHaveBeenCalledWith(buffer);
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
