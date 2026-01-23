/**
 * Resend Email Service
 *
 * Handles all transactional email sending for Story Magic
 */

import { Resend } from 'resend';
import { render } from '@react-email/components';
import TeamInviteEmail from '@/emails/TeamInviteEmail';
import ScriptStatusChangeEmail from '@/emails/ScriptStatusChangeEmail';
import ScriptSharedEmail from '@/emails/ScriptSharedEmail';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Base URL for the app
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.storymagicapp.net';

// From address
const FROM_ADDRESS = 'Story Magic <noreply@storymagicapp.net>';

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

    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `You've been invited to join ${teamName} on Story Magic`,
      html,
    });

    if (error) {
      console.error('[Email] Team invite failed:', error);
      return { success: false, error: error.message };
    }

    console.log('[Email] Team invite sent:', data?.id);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[Email] Team invite exception:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
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

    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `${readerName} ${statusLabels[status]} your script "${scriptName}"`,
      html,
    });

    if (error) {
      console.error('[Email] Status change failed:', error);
      return { success: false, error: error.message };
    }

    console.log('[Email] Status change sent:', data?.id);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[Email] Status change exception:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
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

    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `${senderName} shared "${scriptName}" with you on Story Magic`,
      html,
    });

    if (error) {
      console.error('[Email] Script shared failed:', error);
      return { success: false, error: error.message };
    }

    console.log('[Email] Script shared sent:', data?.id);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[Email] Script shared exception:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
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
      const { data, error } = await resend.batch.send(
        batch.map((email) => ({
          from: FROM_ADDRESS,
          to: email.to,
          subject: email.subject,
          html: email.html,
        }))
      );

      if (error) {
        console.error('[Email] Batch send error:', error);
        failed += batch.length;
      } else {
        sent += data?.data?.length || 0;
      }
    } catch (err) {
      console.error('[Email] Batch send exception:', err);
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
