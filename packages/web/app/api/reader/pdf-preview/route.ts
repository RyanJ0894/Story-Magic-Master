/**
 * PDF Preview API Route
 *
 * POST /api/reader/pdf-preview
 *
 * Accepts a PDF file via multipart/form-data and returns metadata
 * needed by the reader upload wizard: page count and whether the
 * document is likely scanned (no extractable text → OCR surcharge).
 *
 * Uses unpdf (server-side only) — must not be imported in browser code.
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB — matches parse-screenplay.ts

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

    // Migrated from pdf-parse to unpdf in fix/upload-unpdf — pdf-parse
    // (unmaintained since ~2018) hung indefinitely on certain screenplay
    // exports. unpdf wraps modern pdfjs-dist with Node-friendly defaults.
    const { extractText, getDocumentProxy } = await import('unpdf');
    const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const pdf = await getDocumentProxy(uint8);
    const numpages = pdf.numPages;
    const extracted = await extractText(pdf, { mergePages: true });
    const text = Array.isArray(extracted.text) ? extracted.text.join('\n') : extracted.text;

    log.info('[PDFPreview] Analyzed PDF', {
      userId,
      name: file.name,
      pages: numpages,
      textLength: text.length,
    });

    const charsPerPage = numpages > 0 ? text.length / numpages : 0;
    const needsOCR = charsPerPage < 50;

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
