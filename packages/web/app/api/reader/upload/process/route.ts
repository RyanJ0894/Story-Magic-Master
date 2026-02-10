import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { validateCsrf } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/api/rate-limit';
import { log } from '@/lib/logger';

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

  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Upload file to Supabase storage
    const fileName = `${projectId}/${file.name}`;
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from('scripts')
      .upload(fileName, fileBuffer, {
        contentType: 'application/pdf',
      });

    if (uploadError) {
      log.error('Upload error', uploadError);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('scripts')
      .getPublicUrl(fileName);

    // Create project record
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        id: projectId,
        user_id: user.id,
        name,
        status: 'processing',
        source_type: 'reader_upload',
        source_url: publicUrl,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (projectError) {
      log.error('Project creation error', projectError);
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    // Add to reader's library
    const { error: libraryError } = await supabase
      .from('reader_library')
      .insert({
        reader_id: user.id,
        project_id: projectId,
        source: 'uploaded',
        status: 'active',
      });

    if (libraryError) {
      log.warn('Library entry error', { error: libraryError });
    }

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        project_id: projectId,
        user_id: user.id,
        job_type: needsOCR ? 'ocr_extract' : 'pdf_extract',
        status: 'queued',
        metadata: {
          needsOCR,
          fileName: file.name,
          fileSize: file.size,
        },
      })
      .select()
      .single();

    if (jobError) {
      log.error('Job creation error', jobError);
      return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
    }

    // Trigger async processing (in production, this would queue a job)
    triggerProcessing(projectId, job.id, publicUrl, needsOCR);

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

// Trigger async processing: download PDF, extract text, queue for generation
async function triggerProcessing(
  projectId: string,
  jobId: string,
  fileUrl: string,
  needsOCR: boolean
) {
  const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:22002';

  try {
    const supabase = await createClient();

    // Update job status to processing
    await supabase
      .from('jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        progress: { step: 'downloading', percent: 5, details: 'Downloading PDF...' },
      })
      .eq('id', jobId);

    // Download PDF from Supabase storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('scripts')
      .download(`${projectId}/${fileUrl.split('/').pop()}`);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download PDF: ${downloadError?.message}`);
    }

    // Extract text by sending to orchestrator's /generate-scenes endpoint
    // The orchestrator accepts script_text - we need to extract text from PDF first
    // For now, use a basic text extraction approach
    const pdfText = await fileData.text();

    if (!pdfText || pdfText.trim().length < 50) {
      await supabase
        .from('jobs')
        .update({
          status: 'failed',
          error: 'Could not extract text from PDF. The file may be scanned/image-based and require OCR.',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      await supabase
        .from('projects')
        .update({ status: 'failed' })
        .eq('id', projectId);
      return;
    }

    // Update project with extracted text
    const pageCount = Math.max(1, Math.ceil(pdfText.length / 3000));
    await supabase
      .from('projects')
      .update({
        script_text: pdfText,
        page_count: pageCount,
        status: 'ready',
      })
      .eq('id', projectId);

    // Update job progress
    await supabase
      .from('jobs')
      .update({
        progress: { step: 'text_extracted', percent: 20, details: `Extracted ${pageCount} page(s) of text` },
      })
      .eq('id', jobId);

    // Call orchestrator to parse into director JSON
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    const response = await fetch(`${orchestratorUrl}/generate-scenes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
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
    await supabase
      .from('projects')
      .update({ director_json: directorJson, status: 'analyzed' })
      .eq('id', projectId);

    // Mark job as completed
    await supabase
      .from('jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        progress: { step: 'complete', percent: 100, details: 'Script processed successfully' },
      })
      .eq('id', jobId);

  } catch (error) {
    log.error('Processing error', error);
    const supabase = await createClient();
    await supabase
      .from('jobs')
      .update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown processing error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    await supabase
      .from('projects')
      .update({ status: 'failed' })
      .eq('id', projectId);
  }
}
