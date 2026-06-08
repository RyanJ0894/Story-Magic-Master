/**
 * PATCH /api/admin/voices/[entryId] — toggle isActive on a catalog entry
 */

import { NextResponse } from 'next/server';
import { withAuth, parseBody, errorResponse } from '@/lib/api/middleware';
import { z } from 'zod';
import { log } from '@/lib/logger';

const UpdateVoiceEntrySchema = z.object({
  is_active: z.boolean(),
});

export const PATCH = withAuth(async (request, { userId, prisma, params }) => {
  const adminProfile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { userType: true },
  });

  if (adminProfile?.userType !== 'admin') {
    return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
  }

  const parsed = await parseBody(request, UpdateVoiceEntrySchema);
  if ('error' in parsed) return parsed.error;

  const entryId = params.entryId;
  const existing = await prisma.voiceCatalogEntry.findUnique({ where: { id: entryId } });
  if (!existing) {
    return errorResponse('Voice entry not found', 404, { code: 'NOT_FOUND' });
  }

  const updated = await prisma.voiceCatalogEntry.update({
    where: { id: entryId },
    data: { isActive: parsed.data.is_active },
  });

  log.info('[Admin] voice catalog entry updated', { userId, entryId, isActive: parsed.data.is_active });
  return NextResponse.json({ data: updated });
});
