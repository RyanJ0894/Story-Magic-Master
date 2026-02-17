import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { validateCsrf } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/api/rate-limit';
import { log } from '@/lib/logger';
import fs from 'fs';
import path from 'path';

// POST /api/reader/upload/process - Process uploaded PDF
export async function POST(request: NextRequest) {
  // Rate limit: strict (5/min) — expensive processing pipeline
  const ip = getClientIp(request);
  const limited = await rateLimit(`upload:${ip}`, 'strict');
  if (limited) return limited;

  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const name = formData.get('name') as string;
  const needsOCR = formData.get('needsOCR') === 'true';

  if (!file) {
    return NextResponse.json({ error: 'File required' }, { status: 400 });
  }

  if (!name) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 });
  }

  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files accepted' }, { status: 400 });
  }

  try {
    // Generate unique project ID
    const projectId = nanoid();

    // Save file to local storage
    const uploadsDir = path.join(process.cwd(), 'uploads', projectId);
    fs.mkdirSync(uploadsDir, { recursive: true });

    const fileName = file.name;
    const filePath = path.join(uploadsDir, fileName);
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, fileBuffer);

    // Create project record
    const project = await prisma.project.create({
      data: {
        id: projectId,
        userId,
        name,
        status: 'processing',
      },
    });

    // Add to reader's library
    try {
      await prisma.readerLibrary.create({
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
    const job = await prisma.job.create({
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
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    );
  }
}

// Trigger async processing: read PDF from disk, extract text, queue for generation
async function triggerProcessing(
  projectId: string,
  jobId: string,
  filePath: string,
  needsOCR: boolean,
) {
  const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:22002';

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
    const serviceKey = process.env.SERVICE_SECRET_KEY;
    const response = await fetch(`${orchestratorUrl}/generate-scenes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(serviceKey && { 'X-Service-Key': serviceKey }),
      },
      body: JSON.stringify({
        project_id: projectId,
        script_text: pdfText,
      }),
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
