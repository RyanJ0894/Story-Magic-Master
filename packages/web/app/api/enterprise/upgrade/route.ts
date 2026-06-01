/**
 * Enterprise Upgrade API Route
 *
 * POST /api/enterprise/upgrade
 *
 * Verifies the shared enterprise gate password and upgrades the user's
 * subscriptionTier to 'enterprise'. The password is a simple shared preset
 * stored in ENTERPRISE_GATE_PASSWORD — not user-specific.
 */

import { withAuth, parseBody, errorResponse } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { log } from '@/lib/logger';

const UpgradeSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export const POST = withAuth(async (request, { userId, prisma }) => {
  const parsed = await parseBody(request, UpgradeSchema);
  if ('error' in parsed) return parsed.error;

  const { password } = parsed.data;
  const gatePassword = process.env.ENTERPRISE_GATE_PASSWORD;

  if (!gatePassword) {
    log.error('[EnterpriseUpgrade] ENTERPRISE_GATE_PASSWORD not configured', { userId });
    return errorResponse('Enterprise upgrade is not available', 503, { code: 'NOT_CONFIGURED' });
  }

  if (password !== gatePassword) {
    log.warn('[EnterpriseUpgrade] Incorrect password attempt', { userId });
    return errorResponse('Incorrect password', 401, { code: 'WRONG_PASSWORD' });
  }

  await prisma.profile.update({
    where: { id: userId },
    data: { subscriptionTier: 'enterprise' },
  });

  log.info('[EnterpriseUpgrade] User upgraded to enterprise', { userId });

  return NextResponse.json({ success: true, tier: 'enterprise' });
});
