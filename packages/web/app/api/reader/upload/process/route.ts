import { withAuth, errorResponse } from '@/lib/api/middleware';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { log } from '@/lib/logger';
import { orchestratorGenerate } from '@/lib/orchestrator-fetch';
import fs from 'fs';
import path from 'path';

// POST /api/reader/upload/process - Process uploaded PDF
export const POST = withAuth(async (request, { userId, prisma: ctxPrisma }) => {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const name = formData.get('name') as string;
  const needsOCR = formData.get('needsOCR') === 'true';

  if (!file) {
    return errorResponse('File required', 400, { code: 'MISSING_FILE' });
  }

  if (!name) {
    return errorResponse('Name required', 400, { code: 'MISSING_NAME' });
  }

  if (file.type !== 'application/pdf') {
    return errorResponse('Only PDF files accepted', 400, { code: 'INVALID_FILE_TYPE' });
  }

  try {
    // Generate unique project ID
    const projectId = nanoid();

    // Save file to local storage
    const uploadsDir = path.join(process.cwd(), 'uploads', projectId);
    fs.mkdirSync(uploadsDir, { recursive: true });

    // Sanitize filename: strip path traversal sequences, null bytes, and unsafe characters (TD-064)
    const rawName = file.name || 'upload.pdf';
    const baseName = rawName
      .replace(/\0/g, '')                   // strip null bytes
      .replace(/\.\./g, '')                 // strip path traversal
      .replace(/[/\\]/g, '')                // strip directory separators
      .replace(/[<>:"|?*\x00-\x1F]/g, '_') // replace OS-unsafe chars
      .trim() || 'upload.pdf';
    // Ensure the file has a .pdf extension since we only accept PDFs
    const fileName = baseName.endsWith('.pdf') ? baseName : `${baseName}.pdf`;
    const filePath = path.join(uploadsDir, fileName);
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, fileBuffer);

    // Create project record
    const project = await ctxPrisma.project.create({
      data: {
        id: projectId,
        userId,
        name,
        status: 'processing',
      },
    });

    // Add to reader's library
    try {
      await ctxPrisma.readerLibrary.create({
        data: {
          readerId: userId,
          projectId,
          source: 'uploaded',
          status: 'active',
        },
      });
    } catch (libraryError) {
      log.warn('Library entry error', { error: libraryError });
    }

    // Create job record
    const job = await ctxPrisma.job.create({
      data: {
        projectId,
        userId,
        jobType: needsOCR ? 'ocr_extract' : 'pdf_extract',
        status: 'queued',
      },
    });

    // Trigger async processing
    triggerProcessing(projectId, job.id, filePath, needsOCR);

    return NextResponse.json({
      projectId,
      jobId: job.id,
      status: 'processing',
    });
  } catch (error) {
    log.error('Processing error', error);
    return errorResponse('Failed to process upload', 500);
  }
}, { rateLimit: 'strict' });

// Trigger async processing: read PDF from disk, extract text, queue for generation
async function triggerProcessing(
  projectId: string,
  jobId: string,
  filePath: string,
  needsOCR: boolean,
) {
  try {
    // Update job status to processing
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'processing',
        startedAt: new Date(),
        progress: { step: 'downloading', percent: 5, details: 'Reading PDF...' },
      },
    });

    // Read PDF from local disk
    const fileData = fs.readFileSync(filePath);
    const pdfText = fileData.toString('utf-8');

    if (!pdfText || pdfText.trim().length < 50) {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          error: 'Could not extract text from PDF. The file may be scanned/image-based and require OCR.',
          completedAt: new Date(),
        },
      });

      await prisma.project.update({
        where: { id: projectId },
        data: { status: 'failed' },
      });
      return;
    }

    // Update project with extracted text
    const pageCount = Math.max(1, Math.ceil(pdfText.length / 3000));
    await prisma.project.update({
      where: { id: projectId },
      data: {
        scriptText: pdfText,
        pageCount,
        status: 'ready',
      },
    });

    // Update job progress
    await prisma.job.update({
      where: { id: jobId },
      data: {
        progress: { step: 'text_extracted', percent: 20, details: `Extracted ${pageCount} page(s) of text` },
      },
    });

    // Call orchestrator to parse into director JSON
    const response = await orchestratorGenerate('/generate-scenes', {
      project_id: projectId,
      script_text: pdfText,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Scene generation failed: ${errorText}`);
    }

    const result = await response.json();
    const directorJson = result.director_json || result;

    // Save director JSON to project
    await prisma.project.update({
      where: { id: projectId },
      data: { directorJson, status: 'analyzed' },
    });

    // Mark job as completed
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        progress: { step: 'complete', percent: 100, details: 'Script processed successfully' },
      },
    });

    // Cleanup uploaded file
    try {
      fs.unlinkSync(filePath);
      const dir = path.dirname(filePath);
      if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
    } catch {
      // Non-fatal cleanup error
    }

  } catch (error) {
    log.error('Processing error', error);
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown processing error',
        completedAt: new Date(),
      },
    });

    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'failed' },
    });
  }
}
