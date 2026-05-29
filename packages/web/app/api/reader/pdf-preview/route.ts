/**
 * PDF Preview API Route
 *
 * POST /api/reader/pdf-preview
 *
 * Accepts a PDF file via multipart/form-data and returns metadata
 * needed by the reader upload wizard: page count and whether the
 * document is likely scanned (no extractable text → OCR surcharge).
 *
 * Uses pdf-parse (server-side only) — must not be imported in browser code.
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB — matches parse-screenplay.ts
// A scanned page averages ~0 extractable chars; a text PDF ~250–400 chars/page.
// Threshold of 50 chars/page catches near-blank text layers from bad exports.
const OCR_CHARS_PER_PAGE_THRESHOLD = 50;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file field' }, { status: 400 });
  }

  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.` },
      { status: 413 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    // Dynamic import prevents pdf-parse from loading its test fixtures at module init.
    const mod = await import('pdf-parse');
    const pdfParse = (typeof mod === 'function' ? mod : (mod.default ?? mod)) as (
      buf: Buffer,
    ) => Promise<{ text: string; numpages: number }>;

    const { text, numpages } = await pdfParse(buffer);

    const needsOCR = text.trim().length < numpages * OCR_CHARS_PER_PAGE_THRESHOLD;

    log.info('[PDFPreview] Analyzed PDF', {
      userId,
      name: file.name,
      pages: numpages,
      textLength: text.length,
      needsOCR,
    });

    return NextResponse.json({
      name: file.name,
      size: file.size,
      pageCount: numpages,
      needsOCR,
    });
  } catch (error) {
    log.error('[PDFPreview] Failed to parse PDF', { userId, error });
    return NextResponse.json(
      { error: 'Failed to read PDF. The file may be corrupted or password-protected.' },
      { status: 422 },
    );
  }
}
