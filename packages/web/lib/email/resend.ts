/**
 * Resend Email Service
 *
 * Handles all transactional email sending for Story Magic
 */

import { log } from '@/lib/logger';
import { Resend } from 'resend';
import { render } from '@react-email/components';
import TeamInviteEmail from '@/emails/TeamInviteEmail';
import ScriptStatusChangeEmail from '@/emails/ScriptStatusChangeEmail';
import ScriptSharedEmail from '@/emails/ScriptSharedEmail';
import HumanReviewRequestEmail from '@/emails/HumanReviewRequestEmail';
import HumanReviewDecisionEmail from '@/emails/HumanReviewDecisionEmail';
import CommentNotificationEmail from '@/emails/CommentNotificationEmail';

// Lazy-loaded Resend client (to avoid build-time initialization errors)
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

// Base URL for the app
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.storymagicapp.net';

// From address — override via RESEND_FROM_ADDRESS when storymagicapp.net
// is not yet verified in Resend (e.g. use noreply@servicevision.io temporarily).
const FROM_ADDRESS =
  process.env.RESEND_FROM_ADDRESS || 'Story Magic <noreply@storymagicapp.net>';

// HTML-escape user-supplied values before embedding in email templates.
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// =============================================================================
// Types
// =============================================================================

interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

// =============================================================================
// Team Invite Email
// =============================================================================

export async function sendTeamInviteEmail(params: {
  to: string;
  inviterName: string;
  teamName: string;
  inviteToken: string;
}): Promise<EmailResult> {
  const { to, inviterName, teamName, inviteToken } = params;
  const inviteUrl = `${APP_URL}/invite/${inviteToken}`;

  try {
    const html = await render(
      TeamInviteEmail({
        inviterName,
        teamName,
        inviteUrl,
        recipientEmail: to,
      })
    );

    const { data, error } = await getResendClient().emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `You've been invited to join ${teamName} on Story Magic`,
      html,
    });

    if (error) {
      log.error('[Email] Team invite failed', error);
      return { success: false, error: error.message };
    }

    log.info('[Email] Team invite sent', { id: data?.id });
    return { success: true, id: data?.id };
  } catch (error) {
    log.error('[Email] Team invite exception', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Sub-Account Deactivation / Reactivation Emails (#147)
// =============================================================================

export async function sendSubAccountDeactivationEmail(params: {
  to: string;
  recipientName: string;
  teamName: string;
  masterAccountName: string;
}): Promise<EmailResult> {
  const { to, recipientName, teamName, masterAccountName } = params;
  try {
    const { data, error } = await getResendClient().emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `Your access to ${esc(teamName)} has been deactivated`,
      html: `
        <p>Hi ${esc(recipientName) || 'there'},</p>
        <p>Your sub-account access to the <strong>${esc(teamName)}</strong> team on Story Magic has been deactivated by ${esc(masterAccountName)}.</p>
        <p>If you believe this was a mistake, please contact your team administrator.</p>
        <p>— The Story Magic Team</p>
      `,
    });

    if (error) {
      log.error('[Email] Sub-account deactivation failed', { message: error.message, name: error.name });
      return { success: false, error: error.message };
    }
    log.info('[Email] Sub-account deactivation sent', { id: data?.id, to });
    return { success: true, id: data?.id };
  } catch (error) {
    log.error('[Email] Sub-account deactivation exception', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendSubAccountReactivationEmail(params: {
  to: string;
  recipientName: string;
  teamName: string;
  masterAccountName: string;
}): Promise<EmailResult> {
  const { to, recipientName, teamName, masterAccountName } = params;
  try {
    const { data, error } = await getResendClient().emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `Your access to ${esc(teamName)} has been reactivated`,
      html: `
        <p>Hi ${esc(recipientName) || 'there'},</p>
        <p>Great news! Your sub-account access to the <strong>${esc(teamName)}</strong> team on Story Magic has been reactivated by ${esc(masterAccountName)}.</p>
        <p>You can now sign in and access the team's shared scripts at <a href="${APP_URL}/enterprise/dashboard">${APP_URL}/enterprise/dashboard</a>.</p>
        <p>— The Story Magic Team</p>
      `,
    });

    if (error) {
      log.error('[Email] Sub-account reactivation failed', { message: error.message, name: error.name });
      return { success: false, error: error.message };
    }
    log.info('[Email] Sub-account reactivation sent', { id: data?.id, to });
    return { success: true, id: data?.id };
  } catch (error) {
    log.error('[Email] Sub-account reactivation exception', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// =============================================================================
// Script Status Change Email
// =============================================================================

export async function sendScriptStatusChangeEmail(params: {
  to: string;
  ownerName: string;
  readerName: string;
  scriptName: string;
  status: 'like' | 'pass' | 'undecided';
  projectId: string;
}): Promise<EmailResult> {
  const { to, ownerName, readerName, scriptName, status, projectId } = params;
  const projectUrl = `${APP_URL}/projects/${projectId}`;

  try {
    const html = await render(
      ScriptStatusChangeEmail({
        ownerName,
        readerName,
        scriptName,
        status,
        projectUrl,
      })
    );

    const statusLabels = {
      like: 'liked',
      pass: 'passed on',
      undecided: 'marked as undecided on',
    };

    const { data, error } = await getResendClient().emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `${readerName} ${statusLabels[status]} your script "${scriptName}"`,
      html,
    });

    if (error) {
      log.error('[Email] Status change failed', error);
      return { success: false, error: error.message };
    }

    log.info('[Email] Status change sent', { id: data?.id });
    return { success: true, id: data?.id };
  } catch (error) {
    log.error('[Email] Status change exception', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Script Shared Email
// =============================================================================

export async function sendScriptSharedEmail(params: {
  to: string;
  senderName: string;
  recipientName?: string;
  scriptName: string;
  message?: string;
  shareToken: string;
  accessLevel: 'stream' | 'download';
}): Promise<EmailResult> {
  const { to, senderName, recipientName, scriptName, message, shareToken, accessLevel } = params;
  const shareUrl = `${APP_URL}/share/${shareToken}`;

  try {
    const html = await render(
      ScriptSharedEmail({
        senderName,
        recipientName: recipientName || 'there',
        scriptName,
        message,
        shareUrl,
        accessLevel,
      })
    );

    const { data, error } = await getResendClient().emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `${senderName} shared "${scriptName}" with you on Story Magic`,
      html,
    });

    if (error) {
      log.error('[Email] Script shared failed', error);
      return { success: false, error: error.message };
    }

    log.info('[Email] Script shared sent', { id: data?.id });
    return { success: true, id: data?.id };
  } catch (error) {
    log.error('[Email] Script shared exception', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Human Review — Reviewer Notification
// =============================================================================

export async function sendHumanReviewRequestEmail(params: {
  to: string;
  projectName: string;
  customerName: string;
  reviewQueueUrl: string;
  audioUrl?: string;
}): Promise<EmailResult> {
  const { to, projectName, customerName, reviewQueueUrl, audioUrl } = params;
  try {
    const html = await render(
      HumanReviewRequestEmail({ projectName, customerName, reviewQueueUrl, audioUrl })
    );
    const { data, error } = await getResendClient().emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `[Review Queue] New audio ready — "${projectName}"`,
      html,
    });
    if (error) {
      log.error('[Email] Review request failed', error);
      return { success: false, error: error.message };
    }
    log.info('[Email] Review request sent', { id: data?.id });
    return { success: true, id: data?.id };
  } catch (error) {
    log.error('[Email] Review request exception', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// =============================================================================
// Human Review — Customer Decision Notification
// =============================================================================

export async function sendHumanReviewDecisionEmail(params: {
  to: string;
  customerName: string;
  projectName: string;
  decision: 'approved' | 'rejected';
  reviewerNotes?: string;
  projectUrl: string;
  audioUrl?: string;
}): Promise<EmailResult> {
  const { to, customerName, projectName, decision, reviewerNotes, projectUrl, audioUrl } = params;
  try {
    const html = await render(
      HumanReviewDecisionEmail({ customerName, projectName, decision, reviewerNotes, projectUrl, audioUrl })
    );
    const label = decision === 'approved' ? 'approved ✓' : 'reviewed';
    const { data, error } = await getResendClient().emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `Your audio for "${projectName}" has been ${label}`,
      html,
    });
    if (error) {
      log.error('[Email] Review decision failed', error);
      return { success: false, error: error.message };
    }
    log.info('[Email] Review decision sent', { id: data?.id, decision });
    return { success: true, id: data?.id };
  } catch (error) {
    log.error('[Email] Review decision exception', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// =============================================================================
// Comment Notification — Project Owner
// =============================================================================

export async function sendCommentNotificationEmail(params: {
  to: string;
  ownerName: string;
  commenterName: string;
  projectName: string;
  commentBody: string;
  projectUrl: string;
}): Promise<EmailResult> {
  const { to, ownerName, commenterName, projectName, commentBody, projectUrl } = params;
  try {
    const html = await render(
      CommentNotificationEmail({ ownerName, commenterName, projectName, commentBody, projectUrl })
    );
    const { data, error } = await getResendClient().emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `${commenterName} commented on "${projectName}"`,
      html,
    });
    if (error) {
      log.error('[Email] Comment notification failed', error);
      return { success: false, error: error.message };
    }
    log.info('[Email] Comment notification sent', { id: data?.id });
    return { success: true, id: data?.id };
  } catch (error) {
    log.error('[Email] Comment notification exception', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// =============================================================================
// Batch Send (for digest emails)
// =============================================================================

export async function sendBatchEmails(
  emails: Array<{
    to: string;
    subject: string;
    html: string;
  }>
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  // Resend supports batch sending up to 100 emails
  const batches = [];
  for (let i = 0; i < emails.length; i += 100) {
    batches.push(emails.slice(i, i + 100));
  }

  for (const batch of batches) {
    try {
      const { data, error } = await getResendClient().batch.send(
        batch.map((email) => ({
          from: FROM_ADDRESS,
          to: email.to,
          subject: email.subject,
          html: email.html,
        }))
      );

      if (error) {
        log.error('[Email] Batch send error', error);
        failed += batch.length;
      } else {
        sent += data?.data?.length || 0;
      }
    } catch (error) {
      log.error('[Email] Batch send exception', error);
      failed += batch.length;
    }
  }

  return { sent, failed };
}

// =============================================================================
// Default Export
// =============================================================================

export default {
  sendTeamInviteEmail,
  sendScriptStatusChangeEmail,
  sendScriptSharedEmail,
  sendBatchEmails,
};
