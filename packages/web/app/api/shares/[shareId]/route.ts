import { withAuth, verifyOwnership, parseBody, errorResponse } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { UpdateShareRequestSchema } from '@/lib/api/dto';
import { log } from '@/lib/logger';
import { getShare, updateShare, revokeShare } from '@/lib/services/shares';

// GET /api/shares/[shareId] - Get share details
export const GET = withAuth(async (request, { userId, prisma, params }) => {
  const shareId = params.shareId;

  const share = await getShare(prisma, shareId, userId);

  if (!share) {
    return errorResponse('Share not found', 404, { code: 'NOT_FOUND' });
  }

  return NextResponse.json({ share });
});

// PATCH /api/shares/[shareId] - Update share settings
export const PATCH = withAuth(async (request, { userId, prisma, params }) => {
  const shareId = params.shareId;

  // Verify ownership
  const ownerCheck = await verifyOwnership({
    model: 'scriptShare',
    resourceId: shareId,
    userId,
    ownerField: 'sharedBy',
    select: { id: true },
  });
  if ('error' in ownerCheck) return ownerCheck.error;

  const parsed = await parseBody(request, UpdateShareRequestSchema);
  if ('error' in parsed) return parsed.error;

  const {
    access_level,
    expires_at,
    is_active,
    recipient_email,
    recipient_name,
    max_plays,
    password,
  } = parsed.data;

  try {
    const share = await updateShare(prisma, shareId, {
      accessLevel: access_level,
      expiresAt: expires_at,
      isActive: is_active,
      recipientEmail: recipient_email,
      recipientName: recipient_name,
      maxPlays: max_plays,
      password,
    });

    return NextResponse.json({ share });
  } catch (error) {
    log.error('Error updating share', error);
    return errorResponse('Failed to update share', 500);
  }
});

// DELETE /api/shares/[shareId] - Revoke/delete share
export const DELETE = withAuth(async (request, { userId, prisma, params }) => {
  const shareId = params.shareId;

  // Verify ownership
  const ownerCheck = await verifyOwnership({
    model: 'scriptShare',
    resourceId: shareId,
    userId,
    ownerField: 'sharedBy',
    select: { id: true },
  });
  if ('error' in ownerCheck) return ownerCheck.error;

  try {
    await revokeShare(prisma, shareId);
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Error deleting share', error);
    return errorResponse('Failed to delete share', 500);
  }
});
