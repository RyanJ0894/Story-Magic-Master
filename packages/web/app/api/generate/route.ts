import { withAuth, parseBody, errorResponse } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';
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

export const POST = withAuth(async (request, { userId, prisma }) => {
  const parsed = await parseBody(request, GenerateRequestSchema);
  if ('error' in parsed) return parsed.error;

  const { projectId, workflowMode } = parsed.data;
  let { jobId } = parsed.data;

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

  // Credit gate — free-tier users are charged 1 credit per estimated scene.
  // Paid-tier users (creator/pro/studio) bypass this check entirely.
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true, credits: true },
  });

  const PAID_TIERS = new Set(['creator', 'pro', 'studio']);
  const isPaidTier = PAID_TIERS.has(profile?.subscriptionTier ?? 'free');

  if (!isPaidTier) {
    // Estimate scene count: use cached director JSON if available, else page-based estimate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const directorScenes = (project as any).directorJson?.scenes;
    const creditsNeeded = Array.isArray(directorScenes) && directorScenes.length > 0
      ? directorScenes.length
      : Math.max(1, Math.ceil(project.pageCount / 10));

    const creditsHeld = profile?.credits ?? 0;

    if (creditsHeld < creditsNeeded) {
      return NextResponse.json({
        error: 'Insufficient scene credits',
        code: 'INSUFFICIENT_CREDITS',
        creditsNeeded,
        creditsHeld,
      }, { status: 402 });
    }

    // Atomically deduct credits and record the transaction
    await prisma.$transaction(async (tx) => {
      await tx.profile.update({
        where: { id: userId },
        data: { credits: { decrement: creditsNeeded } },
      });
      await tx.creditTransaction.create({
        data: {
          profileId: userId,
          amount: -creditsNeeded,
          reason: 'scene_generation',
          jobId: jobId ?? null,
        },
      });
    });
  }

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

  log.info('Job queued', { jobId: jobId!.slice(0, 8), projectId, type: 'generation' });

  return NextResponse.json({
    success: true,
    message: 'Generation queued',
    jobId,
    projectId,
  });
}, { rateLimit: 'strict' });
