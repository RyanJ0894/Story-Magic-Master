import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

// POST /api/reader/upload/process - Process uploaded PDF
export async function POST(request: NextRequest) {
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
      console.error('Upload error:', uploadError);
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
      console.error('Project creation error:', projectError);
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
      console.error('Library entry error:', libraryError);
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
      console.error('Job creation error:', jobError);
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
    console.error('Processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    );
  }
}

// Async function to trigger processing (simulated for now)
async function triggerProcessing(
  projectId: string,
  jobId: string,
  fileUrl: string,
  needsOCR: boolean
) {
  // In production, this would:
  // 1. Queue a job to a worker (e.g., Bull, SQS, etc.)
  // 2. The worker would:
  //    a. Download the PDF
  //    b. Extract text (with OCR if needed)
  //    c. Parse screenplay format
  //    d. Call Director service to generate audio
  //    e. Update job status

  // For now, we'll simulate by calling the Director API directly
  // This should be moved to a proper job queue
  const directorUrl = process.env.DIRECTOR_URL || 'http://localhost:22001';

  try {
    // Update job status
    const supabase = await createClient();
    await supabase
      .from('jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    // Simulate processing delay
    // In production, actual PDF processing would happen here
    console.log(`Processing project ${projectId} from ${fileUrl}`);

  } catch (error) {
    console.error('Async processing error:', error);
  }
}
