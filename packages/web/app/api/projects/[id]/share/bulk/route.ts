import { withAuth, parseBody, errorResponse } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { log } from '@/lib/logger';
import { createShare, ShareServiceError } from '@/lib/services/shares';
import { sendScriptSharedEmail } from '@/lib/email/resend';

// =============================================================================
// Schema
// =============================================================================

const BulkShareRecipientSchema = z.object({
  email: z.string().email(),
  name: z.string().max(100).optional(),
});

const BulkShareRequestSchema = z.object({
  recipients: z.array(BulkShareRecipientSchema).min(1).max(20),
  access_level: z.enum(['stream', 'download']).default('stream'),
  expires_in_days: z.number().int().min(1).max(365).optional(),
  message: z.string().max(1000).optional(),
});

// =============================================================================
// POST /api/projects/[id]/share/bulk
// Creates one ScriptShare per recipient and fires a Resend email to each.
// =============================================================================

export const POST = withAuth(async (request, { userId, prisma, params }) => {
  const projectId = (params as { id: string }).id;

  if (!projectId) {
    return errorResponse('Missing project id', 400);
  }

  const parsed = await parseBody(request, BulkShareRequestSchema);
  if ('error' in parsed) return parsed.error;

  const { recipients, access_level, expires_in_days, message } = parsed.data;

  // Resolve expiry date (optional)
  const expiresAt = expires_in_days
    ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString()
    : undefined;

  // Resolve sender name for email
  const senderProfile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { fullName: true },
  });
  const senderName = senderProfile?.fullName ?? 'A writer';

  // Resolve project name for email subject
  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: { id: true, name: true, userId: true },
  });

  if (!project) {
    return errorResponse('Project not found', 404, { code: 'NOT_FOUND' });
  }

  if (project.userId !== userId) {
    return errorResponse('Not authorized to share this project', 403, { code: 'FORBIDDEN' });
  }

  // Create one share + send one email per recipient
  const results: Array<{
    email: string;
    shareCode?: string;
    shareUrl?: string;
    emailSent: boolean;
    error?: string;
  }> = [];

  for (const recipient of recipients) {
    try {
      // Personalise message: replace {name} with recipient name if provided
      const personalised = message && recipient.name
        ? message.replace(/\{name\}/g, recipient.name)
        : message;

      const { share, shareUrl, shareCode } = await createShare(prisma, userId, {
        projectId,
        accessLevel: access_level,
        expiresAt,
        recipientEmail: recipient.email,
        recipientName: recipient.name ?? null,
      });

      // Fire email (non-blocking — log failure but don't abort the loop)
      let emailSent = false;
      const emailResult = await sendScriptSharedEmail({
        to: recipient.email,
        senderName,
        recipientName: recipient.name,
        scriptName: project.name,
        message: personalised,
        shareToken: shareCode,
        accessLevel: access_level,
      });
      emailSent = emailResult.success;

      if (!emailResult.success) {
        log.error('[BulkShare] Email failed', { email: recipient.email, error: emailResult.error });
      }

      results.push({ email: recipient.email, shareCode, shareUrl, emailSent });
    } catch (error) {
      const errMsg = error instanceof ShareServiceError
        ? error.message
        : 'Failed to create share';
      log.error('[BulkShare] Share creation failed', { email: recipient.email, error });
      results.push({ email: recipient.email, emailSent: false, error: errMsg });
    }
  }

  const successCount = results.filter((r) => !r.error).length;
  const emailsSent = results.filter((r) => r.emailSent).length;

  return NextResponse.json({
    results,
    summary: {
      total: recipients.length,
      created: successCount,
      emailsSent,
      failed: recipients.length - successCount,
    },
  });
});
