/**
 * GET /api/settings/audio-tuning — return the current user's tuning settings
 * PATCH /api/settings/audio-tuning — partial update + optional lock toggle
 *
 * B-002 of the 2026-06-15 build plan.
 */

import { NextResponse } from 'next/server';
import { withAuth, errorResponse, parseBody } from '@/lib/api/middleware';
import {
  getAudioTuning,
  updateAudioTuning,
  AudioTuningPatchSchema,
} from '@/lib/services/audio-tuning';

export const GET = withAuth(async (_request, { userId, prisma }) => {
  const tuning = await getAudioTuning(prisma, userId);
  return NextResponse.json({ data: tuning });
});

export const PATCH = withAuth(async (request, { userId, prisma }) => {
  const parsed = await parseBody(request, AudioTuningPatchSchema);
  if ('error' in parsed) return parsed.error;
  if (Object.keys(parsed.data).length === 0) {
    return errorResponse('At least one field must be provided', 400, { code: 'EMPTY_PATCH' });
  }

  const updated = await updateAudioTuning(prisma, userId, parsed.data);
  return NextResponse.json({ data: updated });
}, { rateLimit: 'strict' });
