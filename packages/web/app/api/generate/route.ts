import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCsrf } from '@/lib/csrf';

// =============================================================================
// Constants
// =============================================================================
const MAX_SCRIPT_LENGTH = 500000; // 500KB max script size
const MAX_PAGE_COUNT = 150; // Max pages per generation

// =============================================================================
// Input Validation Schemas
// =============================================================================
const GenerateRequestSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
  jobId: z.string().uuid('Invalid job ID format'),
});

// =============================================================================
// Input Sanitization
// =============================================================================
function sanitizeScriptText(text: string): string {
  // Remove potential prompt injection patterns
  // These patterns attempt to override system prompts or inject instructions
  const dangerousPatterns = [
    /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions|prompts)/gi,
    /disregard\s+(all\s+)?(previous|above|prior)/gi,
    /system\s*:\s*/gi,
    /\[INST\]/gi,
    /\[\/INST\]/gi,
    /<<SYS>>/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,
  ];

  let sanitized = text;
  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, '[REMOVED]');
  }

  return sanitized;
}

function validateScriptContent(text: string): { valid: boolean; error?: string } {
  if (!text || typeof text !== 'string') {
    return { valid: false, error: 'Script text is required' };
  }

  if (text.length > MAX_SCRIPT_LENGTH) {
    return { valid: false, error: `Script exceeds maximum length of ${MAX_SCRIPT_LENGTH} characters` };
  }

  if (text.trim().length < 50) {
    return { valid: false, error: 'Script is too short (minimum 50 characters)' };
  }

  return { valid: true };
}

// Helper to log progress with timestamp
function logProgress(jobId: string, step: string, message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Job ${jobId.slice(0, 8)}] [${step}] ${message}`);
}

// Background job processor - runs after response is sent
async function processGenerationJob(
  projectId: string,
  jobId: string,
  userId: string,
  scriptText: string,
  pageCount: number,
  accessToken: string | undefined
) {
  // Use service role client for background processing (not tied to user session)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(`[Job ${jobId}] Missing required environment variables:`, {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!serviceRoleKey,
    });
    throw new Error('Server configuration error: Missing Supabase credentials');
  }

  const supabase = createServiceClient(supabaseUrl, serviceRoleKey);

  const updateJobProgress = async (step: string, percent: number, details?: string) => {
    const progressData = {
      step,
      percent,
      details: details || '',
      updated_at: new Date().toISOString(),
    };
    logProgress(jobId, step, `${percent}% - ${details || 'Processing...'}`);
    await supabase
      .from('jobs')
      .update({ progress: progressData })
      .eq('id', jobId);
  };

  try {
    // Step 1: Start processing
    await supabase
      .from('jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    await updateJobProgress('initializing', 5, 'Starting generation pipeline...');

    // Step 2: Call Director Agent to parse script
    await updateJobProgress('parsing', 10, 'Parsing script and assigning voices...');

    const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:22002';
    logProgress(jobId, 'parsing', `Calling orchestrator at ${orchestratorUrl}/generate-scenes`);

    const directorResponse = await fetch(`${orchestratorUrl}/generate-scenes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
      },
      body: JSON.stringify({
        project_id: projectId,
        script_text: scriptText,
      }),
    });

    if (!directorResponse.ok) {
      const errorBody = await directorResponse.text();
      logProgress(jobId, 'parsing', `Director Agent error: ${errorBody}`);
      throw new Error(`Director Agent failed: ${errorBody}`);
    }

    const directorResponse_json = await directorResponse.json();
    const directorJson = directorResponse_json.director_json || directorResponse_json;

    const sceneCount = directorJson.scenes?.length || 0;
    const lineCount = directorJson.scenes?.reduce((acc: number, s: { dialogue?: unknown[] }) => acc + (s.dialogue?.length || 0), 0) || 0;

    await updateJobProgress('parsing_complete', 25, `Parsed ${sceneCount} scenes, ${lineCount} lines`);

    // Save director JSON to project
    await supabase
      .from('projects')
      .update({ director_json: directorJson })
      .eq('id', projectId);

    // Step 3: Call Orchestrator to generate audio
    await updateJobProgress('generating_audio', 30, 'Generating TTS audio for all dialogue...');
    logProgress(jobId, 'generating_audio', `Calling orchestrator at ${orchestratorUrl}/orchestrate with ${sceneCount} scenes`);

    const orchestratorResponse = await fetch(`${orchestratorUrl}/orchestrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
      },
      body: JSON.stringify({
        project_id: projectId,
        scenes: directorJson.scenes || [],
      }),
    });

    if (!orchestratorResponse.ok) {
      const errorBody = await orchestratorResponse.text();
      logProgress(jobId, 'generating_audio', `Orchestrator error: ${errorBody}`);
      throw new Error(`Orchestrator failed: ${errorBody}`);
    }

    const orchestratorResult = await orchestratorResponse.json();
    await updateJobProgress('mixing', 75, 'Mixing audio tracks...');

    // Step 4: Store audio output records
    await updateJobProgress('uploading', 85, 'Uploading final audio...');

    const audioUrls = orchestratorResult.audio_urls || [];
    const manifest = orchestratorResult.playback_manifest;

    for (const audioUrl of audioUrls) {
      if (!audioUrl) continue;
      const fileName = audioUrl.split('/').pop() || 'output.mp3';
      const pathMatch = audioUrl.match(/\/storage\/v1\/object\/public\/(.+)$/);
      const filePath = pathMatch ? pathMatch[1] : `audio/${projectId}/${fileName}`;
      await supabase
        .from('audio_outputs')
        .insert({
          project_id: projectId,
          job_id: jobId,
          file_name: fileName,
          file_path: filePath,
          duration_seconds: manifest?.total_duration || null,
          format: fileName.endsWith('.m4a') ? 'm4a' : 'mp3',
        });
    }

    // Step 5: Increment usage
    await updateJobProgress('finalizing', 95, 'Finalizing and updating usage...');

    await supabase.rpc('increment_usage', {
      p_user_id: userId,
      p_pages: pageCount,
    });

    // Step 6: Mark job as completed
    const completionTime = new Date().toISOString();
    await supabase
      .from('jobs')
      .update({
        status: 'completed',
        completed_at: completionTime,
        progress: { step: 'done', percent: 100, details: 'Generation complete!', updated_at: completionTime },
        result: orchestratorResult,
      })
      .eq('id', jobId);

    await supabase
      .from('projects')
      .update({ status: 'completed' })
      .eq('id', projectId);

    logProgress(jobId, 'done', 'Generation completed successfully!');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logProgress(jobId, 'error', `Generation failed: ${errorMessage}`);

    await supabase
      .from('jobs')
      .update({
        status: 'failed',
        error: errorMessage,
        progress: { step: 'failed', percent: 0, details: errorMessage, updated_at: new Date().toISOString() },
      })
      .eq('id', jobId);

    await supabase
      .from('projects')
      .update({ status: 'failed' })
      .eq('id', projectId);
  }
}

export async function POST(request: Request) {
  // CSRF protection - validate origin header
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({
      error: 'CSRF validation failed',
      code: 'CSRF_ERROR',
    }, { status: 403 });
  }

  const supabase = await createClient();

  // Verify user is authenticated and get session for API calls
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({
      error: 'Unauthorized',
      code: 'AUTH_REQUIRED',
    }, { status: 401 });
  }

  // Get session token for orchestrator API calls
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  // Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON',
    }, { status: 400 });
  }

  const parseResult = GenerateRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({
      error: 'Invalid request parameters',
      code: 'VALIDATION_ERROR',
      details: parseResult.error.flatten().fieldErrors,
    }, { status: 400 });
  }

  const { projectId, jobId } = parseResult.data;

  // Fetch project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({
      error: 'Project not found',
      code: 'PROJECT_NOT_FOUND',
    }, { status: 404 });
  }

  // Validate script content
  const scriptValidation = validateScriptContent(project.script_text);
  if (!scriptValidation.valid) {
    return NextResponse.json({
      error: scriptValidation.error,
      code: 'INVALID_SCRIPT',
    }, { status: 400 });
  }

  // Validate page count
  if (project.page_count > MAX_PAGE_COUNT) {
    return NextResponse.json({
      error: `Script exceeds maximum of ${MAX_PAGE_COUNT} pages`,
      code: 'SCRIPT_TOO_LONG',
    }, { status: 400 });
  }

  // Sanitize script text before processing
  const sanitizedScript = sanitizeScriptText(project.script_text);

  // Initialize job status immediately
  await supabase
    .from('jobs')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
      progress: { step: 'queued', percent: 0, details: 'Job queued, starting soon...', updated_at: new Date().toISOString() },
    })
    .eq('id', jobId);

  logProgress(jobId, 'start', `Generation started for project ${projectId}`);

  // Schedule background processing - don't await, let it run independently
  // On Render.com, the Node.js process persists so this will complete even after response is sent
  // Using setImmediate to ensure response is sent first before heavy processing starts
  setImmediate(() => {
    processGenerationJob(
      projectId,
      jobId,
      user.id,
      sanitizedScript, // Use sanitized script text
      project.page_count,
      accessToken
    ).catch((error) => {
      // Log any unhandled errors from background processing
      console.error(`[Background Job Error] Job ${jobId}:`, error);
    });
  });

  // Return immediately - job will continue in background
  return NextResponse.json({
    success: true,
    message: 'Generation started',
    jobId,
    projectId,
  });
}
