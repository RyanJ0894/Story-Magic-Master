import { NextResponse } from 'next/server';
import { withAdminAuth, parseBody, errorResponse } from '@/lib/api/middleware';
import { z } from 'zod';
import { logAuditEvent, extractRequestInfo, AuditActions, ResourceTypes } from '@/lib/api/audit';
import { log } from '@/lib/logger';
import { provisionTier } from '@/lib/services/tier-provision';

const VALID_TIERS = ['creator', 'pro', 'studio', 'enterprise'] as const;

const SetTierSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  tier: z.enum(VALID_TIERS),
  reason: z.string().default('admin_provision'),
});

/**
 * POST /api/admin/tier
 * Set a user's subscription tier directly. Enterprise provisioning (Option A).
 * Admin-only — requires withAdminAuth.
 *
 * Option B (Stripe self-serve checkout) will supersede the enterprise case
 * once the payment flow is built.
 */
export const POST = withAdminAuth(async (request, { userId: adminId, prisma }) => {
  const parsed = await parseBody(request, SetTierSchema);
  if ('error' in parsed) return parsed.error;

  const { userId: targetUserId, tier, reason } = parsed.data;

  const target = await prisma.profile.findUnique({
    where: { id: targetUserId },
    select: { id: true, fullName: true, email: true, subscriptionTier: true },
  });

  if (!target) {
    return errorResponse('User not found', 404, { code: 'NOT_FOUND' });
  }

  // DT-30-M-1: provisionTier atomically updates both profile.subscriptionTier
  // and the latest subscriptions row under Serializable isolation. The earlier
  // implementation read the existing subscription OUTSIDE the transaction,
  // leaving a TOCTOU window in which two concurrent admin actions could each
  // observe "no subscription row" and both insert — producing duplicate
  // active rows that #196's llm_call_log cost-attribution would double-count.
  await provisionTier(prisma, { userId: targetUserId, tier });

  const requestInfo = extractRequestInfo(request);
  await logAuditEvent({
    user_id: adminId,
    action: AuditActions.ADMIN_CREDIT_GRANT,
    resource_type: ResourceTypes.USER,
    resource_id: targetUserId,
    details: {
      tier,
      reason,
      previous_tier: target.subscriptionTier,
    },
    ...requestInfo,
  });

  log.info('[Admin] tier set', { adminId, targetUserId, tier, previousTier: target.subscriptionTier });

  return NextResponse.json({
    userId: targetUserId,
    email: target.email,
    previousTier: target.subscriptionTier,
    newTier: tier,
  });
}, { rateLimit: 'strict' });
