import { withAuth, verifyOwnership } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';
import { UpdateShareRequestSchema } from '@/lib/api/dto';
import { log } from '@/lib/logger';

// GET /api/shares/[shareId] - Get share details
export const GET = withAuth(async (request, { userId, prisma, params }) => {
  const shareId = params.shareId;

  const share = await prisma.scriptShare.findFirst({
    where: {
      id: shareId,
      sharedBy: userId,
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          pageCount: true,
        },
      },
    },
  });

  if (!share) {
    return NextResponse.json({ error: 'Share not found' }, { status: 404 });
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

  // Parse and validate request body
  const body = await request.json();
  const parseResult = UpdateShareRequestSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parseResult.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const {
    access_level,
    expires_at,
    is_active,
    recipient_email,
    recipient_name,
    max_plays,
    password,
  } = parseResult.data;

  const updates: Record<string, unknown> = {};

  if (access_level !== undefined) updates.accessLevel = access_level;
  if (expires_at !== undefined) updates.expiresAt = expires_at ? new Date(expires_at) : null;
  if (is_active !== undefined) updates.isActive = is_active;
  if (recipient_email !== undefined) updates.recipientEmail = recipient_email;
  if (recipient_name !== undefined) updates.recipientName = recipient_name;
  if (max_plays !== undefined) updates.maxPlays = max_plays;
  if (password !== undefined) {
    updates.passwordHash = password ? await hashPassword(password) : null;
  }

  try {
    const share = await prisma.scriptShare.update({
      where: { id: shareId },
      data: updates,
    });

    return NextResponse.json({ share });
  } catch (error) {
    log.error('Error updating share', error);
    return NextResponse.json({ error: 'Failed to update share' }, { status: 500 });
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
    // Soft delete by deactivating
    await prisma.scriptShare.update({
      where: { id: shareId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Error deleting share', error);
    return NextResponse.json({ error: 'Failed to delete share' }, { status: 500 });
  }
});
