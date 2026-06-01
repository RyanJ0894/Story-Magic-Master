import { NextResponse } from 'next/server';
import { withAdminAuth, parseBody, errorResponse } from '@/lib/api/middleware';
import { z } from 'zod';
import { logAuditEvent, extractRequestInfo, AuditActions, ResourceTypes } from '@/lib/api/audit';
import { log } from '@/lib/logger';

const GrantCreditsSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  amount: z.number().int().positive().max(10000),
  reason: z.string().default('admin_grant'),
});

/**
 * POST /api/admin/credits/grant
 * Atomically add credits to a user's balance and record the transaction.
 */
export const POST = withAdminAuth(async (request, { userId: adminId, prisma }) => {
  const parsed = await parseBody(request, GrantCreditsSchema);
  if ('error' in parsed) return parsed.error;

  const { userId: targetUserId, amount, reason } = parsed.data;

  const target = await prisma.profile.findUnique({
    where: { id: targetUserId },
    select: { id: true, fullName: true, credits: true },
  });

  if (!target) {
    return errorResponse('User not found', 404, { code: 'NOT_FOUND' });
  }

  try {
    const updatedProfile = await prisma.$transaction(async (tx) => {
      const profile = await tx.profile.update({
        where: { id: targetUserId },
        data: { credits: { increment: amount } },
        select: { id: true, credits: true },
      });
      await tx.creditTransaction.create({
        data: { profileId: targetUserId, amount, reason },
      });
      return profile;
    });

    const requestInfo = extractRequestInfo(request);
    await logAuditEvent({
      user_id: adminId,
      action: AuditActions.ADMIN_CREDIT_GRANT,
      resource_type: ResourceTypes.USER,
      resource_id: targetUserId,
      details: {
        amount,
        reason,
        previous_credits: target.credits,
        new_credits: updatedProfile.credits,
      },
      ...requestInfo,
    });

    log.info('[Admin] credits granted', { adminId, targetUserId, amount });

    return NextResponse.json({
      userId: targetUserId,
      creditsGranted: amount,
      newBalance: updatedProfile.credits,
    });
  } catch (error) {
    log.error('Error granting credits', error);
    return errorResponse('Failed to grant credits', 500);
  }
}, { rateLimit: 'strict' });
