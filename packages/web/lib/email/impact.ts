/**
 * Impact StoryBuilder transactional emails.
 *
 * All admin emails route to ADMIN_EMAIL env var (default: info@servicevision.net).
 * Set EMAIL_TESTING_MODE=true to redirect ALL outbound email to info@servicevision.net.
 */

import { Resend } from 'resend';
import { log } from '@/lib/logger';

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');
  return new Resend(key);
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.storymagicapp.net';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'info@servicevision.net';
const FROM = 'Story Magic Impact <impact@storymagicapp.net>';
const TESTING = process.env.EMAIL_TESTING_MODE === 'true';

function to(email: string): string {
  return TESTING ? ADMIN_EMAIL : email;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrap(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#18181b;border:1px solid #27272a;border-radius:12px;overflow:hidden;max-width:600px;">
      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#4c1d95,#7c3aed);padding:28px 32px;">
          <div style="font-size:22px;font-weight:800;color:#fff;">💜 Story Magic Impact</div>
          <div style="font-size:13px;color:#c4b5fd;margin-top:4px;">Giving voice to those who need it most</div>
        </td>
      </tr>
      <!-- Body -->
      <tr><td style="padding:32px;color:#e4e4e7;font-size:15px;line-height:1.6;">${body}</td></tr>
      <!-- Footer -->
      <tr>
        <td style="padding:20px 32px;border-top:1px solid #27272a;font-size:12px;color:#71717a;text-align:center;">
          Story Magic · <a href="${APP_URL}/impact" style="color:#a78bfa;text-decoration:none;">Impact Program</a> ·
          <a href="${APP_URL}/impact/stories" style="color:#a78bfa;text-decoration:none;">Story Gallery</a>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ---------------------------------------------------------------------------
// 1. Admin: new story submitted for gallery review
// ---------------------------------------------------------------------------

export async function sendStorySubmittedAlert(params: {
  storyTitle: string;
  category: string;
  authorName?: string | null;
  storyId: string;
}) {
  const { storyTitle, category, authorName, storyId } = params;
  const reviewUrl = `${APP_URL}/admin/impact`;
  const html = wrap('New Story Awaiting Approval', `
    <p style="color:#a78bfa;font-size:13px;font-weight:600;margin:0 0 16px;">ACTION REQUIRED</p>
    <h2 style="margin:0 0 8px;color:#fff;font-size:20px;">New Impact Story Submitted for Gallery</h2>
    <p style="color:#a1a1aa;margin:0 0 20px;">A storyteller has submitted a story for public gallery review.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;border-radius:8px;padding:16px;margin-bottom:24px;">
      <tr><td style="padding:6px 0;">
        <span style="color:#71717a;font-size:13px;">Title</span><br>
        <span style="color:#fff;font-weight:600;">${storyTitle}</span>
      </td></tr>
      <tr><td style="padding:6px 0;">
        <span style="color:#71717a;font-size:13px;">Category</span><br>
        <span style="color:#e4e4e7;">${category}</span>
      </td></tr>
      <tr><td style="padding:6px 0;">
        <span style="color:#71717a;font-size:13px;">Author</span><br>
        <span style="color:#e4e4e7;">${authorName ?? 'Anonymous'}</span>
      </td></tr>
    </table>

    <a href="${reviewUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">
      Review in Admin Dashboard →
    </a>
    <p style="font-size:12px;color:#52525b;margin-top:20px;">Story ID: ${storyId}</p>
  `);

  try {
    const { data, error } = await getResend().emails.send({
      from: FROM,
      to: ADMIN_EMAIL,
      subject: `[Impact] New story pending review: "${storyTitle}"`,
      html,
    });
    if (error) log.error('[Impact Email] Story submitted alert failed', error);
    else log.info('[Impact Email] Story submitted alert sent', { id: data?.id });
  } catch (err) {
    log.error('[Impact Email] Story submitted alert exception', err instanceof Error ? err : undefined);
  }
}

// ---------------------------------------------------------------------------
// 2. User: story production complete (audio is ready)
// ---------------------------------------------------------------------------

export async function sendStoryProductionCompleteEmail(params: {
  to: string;
  storyTitle: string;
  audioUrl: string;
  isPublic: boolean;
  prizeEligible: boolean;
}) {
  const { storyTitle, audioUrl, isPublic, prizeEligible } = params;
  const publicNote = isPublic
    ? `<p style="background:#14532d22;border:1px solid #166534;border-radius:8px;padding:12px 16px;color:#86efac;font-size:13px;margin:16px 0;">
        🎉 Your story has been submitted for gallery review. Once approved, it will appear in the public Impact gallery.
       </p>`
    : '';
  const prizeNote = prizeEligible
    ? `<p style="background:#3b0764aa;border:1px solid #7c3aed;border-radius:8px;padding:12px 16px;color:#c4b5fd;font-size:13px;margin:16px 0;">
        🏆 You're entered in this month's $100 prize drawing. Winners are notified by email on the last day of the month.
       </p>`
    : '';

  const html = wrap('Your Story is Ready', `
    <h2 style="margin:0 0 8px;color:#fff;font-size:22px;">Your story is alive. 🎙️</h2>
    <p style="color:#a1a1aa;margin:0 0 20px;">"${storyTitle}" has been transformed into audio. Your voice has been heard.</p>

    <a href="${audioUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;margin-bottom:8px;">
      🎧 Listen to Your Story
    </a>
    <br>
    <a href="${audioUrl}" download style="display:inline-block;background:transparent;color:#a78bfa;text-decoration:none;padding:10px 24px;border:1px solid #7c3aed;border-radius:8px;font-size:13px;margin-top:8px;">
      Download Audio File
    </a>

    ${publicNote}
    ${prizeNote}

    <p style="margin-top:24px;font-size:13px;color:#71717a;">
      Thank you for having the courage to share your story. It matters.
    </p>
    <p style="font-size:13px;color:#71717a;">
      <a href="${APP_URL}/impact/stories" style="color:#a78bfa;">Listen to other community stories →</a>
    </p>
  `);

  try {
    const { data, error } = await getResend().emails.send({
      from: FROM,
      to: to(params.to),
      subject: `Your Impact story "${storyTitle}" is ready to listen`,
      html,
    });
    if (error) log.error('[Impact Email] Production complete failed', error);
    else log.info('[Impact Email] Production complete sent', { id: data?.id });
  } catch (err) {
    log.error('[Impact Email] Production complete exception', err instanceof Error ? err : undefined);
  }
}

// ---------------------------------------------------------------------------
// 3. User: story approved for gallery
// ---------------------------------------------------------------------------

export async function sendStoryApprovedEmail(params: {
  to: string;
  storyTitle: string;
  storyId: string;
}) {
  const { storyTitle, storyId } = params;
  const galleryUrl = `${APP_URL}/impact/stories`;

  const html = wrap('Your Story is in the Gallery', `
    <h2 style="margin:0 0 8px;color:#fff;font-size:22px;">Your story is now live. 🌟</h2>
    <p style="color:#a1a1aa;margin:0 0 20px;">
      We've reviewed your story and it's been approved for the public Impact gallery.
      Others can now find it, listen, and be inspired by your experience.
    </p>

    <a href="${galleryUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">
      View the Gallery →
    </a>

    <p style="margin-top:24px;color:#a1a1aa;font-size:13px;">
      Share your story with people who matter to you — your voice can change how someone else sees their own path.
    </p>
    <p style="font-size:12px;color:#52525b;margin-top:16px;">Story: "${storyTitle}"</p>
  `);

  try {
    const { data, error } = await getResend().emails.send({
      from: FROM,
      to: to(params.to),
      subject: `Your story "${storyTitle}" is now in the Impact gallery`,
      html,
    });
    if (error) log.error('[Impact Email] Approved failed', error);
    else log.info('[Impact Email] Approved sent', { id: data?.id, storyId });
  } catch (err) {
    log.error('[Impact Email] Approved exception', err instanceof Error ? err : undefined);
  }
}

// ---------------------------------------------------------------------------
// 4. Admin: new partner inquiry
// ---------------------------------------------------------------------------

export async function sendPartnerInquiryAlert(params: {
  companyName: string;
  contactName?: string | null;
  contactEmail?: string | null;
  tier: string;
  notes?: string | null;
}) {
  const { companyName, contactName, contactEmail, tier, notes } = params;
  const adminUrl = `${APP_URL}/admin/impact`;

  const html = wrap('New Partner Inquiry', `
    <p style="color:#fbbf24;font-size:13px;font-weight:600;margin:0 0 16px;">NEW SPONSOR INQUIRY</p>
    <h2 style="margin:0 0 8px;color:#fff;font-size:20px;">${companyName} wants to partner</h2>
    <p style="color:#a1a1aa;margin:0 0 20px;">A company has submitted a partnership inquiry for the Impact program.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;border-radius:8px;padding:16px;margin-bottom:24px;">
      <tr><td style="padding:6px 0;">
        <span style="color:#71717a;font-size:13px;">Company</span><br>
        <span style="color:#fff;font-weight:600;">${companyName}</span>
      </td></tr>
      <tr><td style="padding:6px 0;">
        <span style="color:#71717a;font-size:13px;">Contact</span><br>
        <span style="color:#e4e4e7;">${contactName ?? '—'}</span>
      </td></tr>
      <tr><td style="padding:6px 0;">
        <span style="color:#71717a;font-size:13px;">Email</span><br>
        <span style="color:#a78bfa;">${contactEmail ?? '—'}</span>
      </td></tr>
      <tr><td style="padding:6px 0;">
        <span style="color:#71717a;font-size:13px;">Tier of interest</span><br>
        <span style="color:#e4e4e7;">${tier}</span>
      </td></tr>
      ${notes ? `<tr><td style="padding:6px 0;">
        <span style="color:#71717a;font-size:13px;">Message</span><br>
        <span style="color:#d4d4d8;font-style:italic;">${notes}</span>
      </td></tr>` : ''}
    </table>

    <a href="${adminUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">
      View in Admin Dashboard →
    </a>
    ${contactEmail ? `<br><a href="mailto:${contactEmail}" style="display:inline-block;margin-top:10px;color:#a78bfa;font-size:13px;">Reply directly to ${contactEmail} →</a>` : ''}
  `);

  try {
    const { data, error } = await getResend().emails.send({
      from: FROM,
      to: ADMIN_EMAIL,
      subject: `[Impact] New partner inquiry: ${companyName} (${tier})`,
      html,
    });
    if (error) log.error('[Impact Email] Partner inquiry alert failed', error);
    else log.info('[Impact Email] Partner inquiry alert sent', { id: data?.id });
  } catch (err) {
    log.error('[Impact Email] Partner inquiry exception', err instanceof Error ? err : undefined);
  }
}

// ---------------------------------------------------------------------------
// 5. Prize draw winner notification
// ---------------------------------------------------------------------------

export async function sendPrizeDrawWinnerEmail(params: {
  winnerEmail: string;
  storyTitle: string;
  drawMonth: string; // YYYY-MM
  storyId: string;
}) {
  const { winnerEmail, storyTitle, drawMonth, storyId } = params;
  const [year, month] = drawMonth.split('-');
  const monthName = new Date(Number(year), Number(month) - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const winnerHtml = wrap(`You won the ${monthName} drawing!`, `
    <div style="text-align:center;padding:20px 0;">
      <div style="font-size:64px;margin-bottom:16px;">🏆</div>
      <h2 style="margin:0 0 8px;color:#fff;font-size:24px;">You won the ${monthName} drawing!</h2>
      <p style="color:#a1a1aa;margin:0 0 24px;">
        Your story "<strong style="color:#fff;">${storyTitle}</strong>" was selected in our monthly $100 prize drawing.
        As a thank-you for having the courage to share your experience, we're sending you $100.
      </p>
      <div style="background:#3b0764;border:1px solid #7c3aed;border-radius:12px;padding:24px;margin-bottom:24px;">
        <div style="font-size:40px;font-weight:900;color:#a78bfa;">$100</div>
        <div style="font-size:14px;color:#c4b5fd;margin-top:4px;">Your prize</div>
      </div>
    </div>

    <p style="color:#a1a1aa;font-size:14px;margin-bottom:16px;">
      To claim your prize, simply reply to this email with your preferred payment method (PayPal, Venmo, Zelle, or check).
      We'll process it within 5 business days.
    </p>
    <p style="color:#71717a;font-size:12px;">
      Your story continues to inspire others in the gallery. Thank you for sharing.
    </p>
    <p style="font-size:12px;color:#52525b;">Story ID: ${storyId}</p>
  `);

  // Admin notification
  const adminHtml = wrap(`Prize Draw Winner — ${monthName}`, `
    <h2 style="margin:0 0 8px;color:#fff;">Prize Draw Winner Selected</h2>
    <p style="color:#a1a1aa;margin:0 0 20px;">Monthly prize draw winner notification sent for ${monthName}.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;border-radius:8px;padding:16px;margin-bottom:24px;">
      <tr><td style="padding:6px 0;">
        <span style="color:#71717a;font-size:13px;">Winner email</span><br>
        <span style="color:#a78bfa;">${winnerEmail}</span>
      </td></tr>
      <tr><td style="padding:6px 0;">
        <span style="color:#71717a;font-size:13px;">Story</span><br>
        <span style="color:#fff;">"${storyTitle}"</span>
      </td></tr>
      <tr><td style="padding:6px 0;">
        <span style="color:#71717a;font-size:13px;">Draw month</span><br>
        <span style="color:#e4e4e7;">${monthName}</span>
      </td></tr>
      <tr><td style="padding:6px 0;">
        <span style="color:#71717a;font-size:13px;">Prize amount</span><br>
        <span style="color:#fbbf24;font-weight:600;">$100</span>
      </td></tr>
    </table>
    <p style="color:#a1a1aa;font-size:13px;">Winner has been notified. Reply to their email to arrange payment.</p>
    <a href="mailto:${winnerEmail}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">
      Reply to Winner →
    </a>
  `);

  try {
    const resend = getResend();

    // Send to winner
    const { data: wd, error: we } = await resend.emails.send({
      from: FROM,
      to: to(winnerEmail),
      subject: `🏆 You won the Story Magic Impact ${monthName} drawing!`,
      html: winnerHtml,
    });
    if (we) log.error('[Impact Email] Winner email failed', we);
    else log.info('[Impact Email] Winner email sent', { id: wd?.id });

    // Always send admin copy
    const { data: ad, error: ae } = await resend.emails.send({
      from: FROM,
      to: ADMIN_EMAIL,
      subject: `[Impact] Prize draw winner — ${monthName}: ${winnerEmail}`,
      html: adminHtml,
    });
    if (ae) log.error('[Impact Email] Admin prize copy failed', ae);
    else log.info('[Impact Email] Admin prize copy sent', { id: ad?.id });
  } catch (err) {
    log.error('[Impact Email] Prize draw email exception', err instanceof Error ? err : undefined);
  }
}

// ---------------------------------------------------------------------------
// 6. Admin: donation received
// ---------------------------------------------------------------------------

export async function sendDonationReceivedAlert(params: {
  amountCents: number;
  donorEmail?: string | null;
  stripeSessionId: string;
}) {
  const { amountCents, donorEmail, stripeSessionId } = params;
  const dollars = (amountCents / 100).toFixed(2);

  const html = wrap('Donation Received', `
    <p style="color:#86efac;font-size:13px;font-weight:600;margin:0 0 16px;">💜 NEW DONATION</p>
    <h2 style="margin:0 0 8px;color:#fff;font-size:22px;">$${dollars} donated to Impact</h2>
    <p style="color:#a1a1aa;margin:0 0 20px;">Someone has made a voluntary donation to support the Impact StoryBuilder program.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;border-radius:8px;padding:16px;margin-bottom:24px;">
      <tr><td style="padding:6px 0;">
        <span style="color:#71717a;font-size:13px;">Amount</span><br>
        <span style="color:#86efac;font-weight:700;font-size:20px;">$${dollars}</span>
      </td></tr>
      <tr><td style="padding:6px 0;">
        <span style="color:#71717a;font-size:13px;">Donor</span><br>
        <span style="color:#e4e4e7;">${donorEmail ?? 'Anonymous'}</span>
      </td></tr>
      <tr><td style="padding:6px 0;">
        <span style="color:#71717a;font-size:13px;">Stripe session</span><br>
        <span style="color:#52525b;font-size:12px;">${stripeSessionId}</span>
      </td></tr>
    </table>
  `);

  try {
    const { data, error } = await getResend().emails.send({
      from: FROM,
      to: ADMIN_EMAIL,
      subject: `[Impact] $${dollars} donation received`,
      html,
    });
    if (error) log.error('[Impact Email] Donation alert failed', error);
    else log.info('[Impact Email] Donation alert sent', { id: data?.id });
  } catch (err) {
    log.error('[Impact Email] Donation alert exception', err instanceof Error ? err : undefined);
  }
}
