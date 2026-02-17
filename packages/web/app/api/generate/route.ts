import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCsrf } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/api/rate-limit';
import { log } from '@/lib/logger';

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
  jobId: z.string().uuid('Invalid job ID format').optional(),
  workflowMode: z.enum(['automatic', 'fine_tuned']).optional().default('fine_tuned'),
});

// =============================================================================
// Input Sanitization
// =============================================================================
function sanitizeScriptText(text: string): string {
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

export async function POST(request: Request) {
  // Rate limit: strict (5/min) — expensive LLM + TTS pipeline
  const ip = getClientIp(request);
  const limited = await rateLimit(`generate:${ip}`, 'strict');
  if (limited) return limited;

  // CSRF protection - validate origin header
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({
      error: 'CSRF validation failed',
      code: 'CSRF_ERROR',
    }, { status: 403 });
  }

  // Verify user is authenticated
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({
      error: 'Unauthorized',
      code: 'AUTH_REQUIRED',
    }, { status: 401 });
  }

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

  const { projectId, workflowMode } = parseResult.data;
  let { jobId } = parseResult.data;

  // Fetch project
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    return NextResponse.json({
      error: 'Project not found',
      code: 'PROJECT_NOT_FOUND',
    }, { status: 404 });
  }

  // Validate script content
  const scriptValidation = validateScriptContent(project.scriptText as string);
  if (!scriptValidation.valid) {
    return NextResponse.json({
      error: scriptValidation.error,
      code: 'INVALID_SCRIPT',
    }, { status: 400 });
  }

  // Validate page count
  if (project.pageCount > MAX_PAGE_COUNT) {
    return NextResponse.json({
      error: `Script exceeds maximum of ${MAX_PAGE_COUNT} pages`,
      code: 'SCRIPT_TOO_LONG',
    }, { status: 400 });
  }

  // Sanitize script text before processing
  const sanitizedScript = sanitizeScriptText(project.scriptText as string);

  // Get voice assignments (user-selected voice overrides)
  const voiceOverrides: Record<string, string> = {};
  const voiceAssignments = project.voiceAssignments as unknown[];
  if (Array.isArray(voiceAssignments)) {
    for (const assignment of voiceAssignments as Array<{ user_selected?: boolean; voice_id?: string; character_name?: string }>) {
      if (assignment.user_selected && assignment.voice_id && assignment.character_name) {
        voiceOverrides[assignment.character_name] = assignment.voice_id;
      }
    }
  }

  // Create job if not provided (client-side doesn't pre-create jobs)
  if (!jobId) {
    const newJob = await prisma.job.create({
      data: {
        projectId,
        userId,
        jobType: 'audio_generation',
        workflowMode: workflowMode ?? 'fine_tuned',
        status: 'pending',
        progress: { step: 'pending', percent: 0 },
      },
    });
    jobId = newJob.id;
  }

  // Enqueue job for background processing via the queue worker.
  // The worker picks up 'queued' jobs, processes them with retry support,
  // and survives process restarts via lock expiration.
  const now = new Date().toISOString();
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'queued',
      progress: { step: 'queued', percent: 0, details: 'Job queued, starting soon...', updated_at: now },
      // Store generation params as metadata for the queue worker to consume
      result: {
        metadata: {
          scriptText: sanitizedScript,
          pageCount: project.pageCount,
          voiceOverrides,
        },
      },
    },
  });

  log.info('Job queued', { jobId: jobId.slice(0, 8), projectId, type: 'generation' });

  return NextResponse.json({
    success: true,
    message: 'Generation queued',
    jobId,
    projectId,
  });
}
