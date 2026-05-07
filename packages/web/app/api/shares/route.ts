import { withAuth, parseBody, errorResponse } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { CreateShareRequestSchema } from '@/lib/api/dto';
import { log } from '@/lib/logger';
import {
  getSharesByUser,
  createShare,
  ShareServiceError,
} from '@/lib/services/shares';

// GET /api/shares - List all shares for current user
export const GET = withAuth(async (request, { userId, prisma }) => {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');

  const shares = await getSharesByUser(prisma, userId, projectId);
  return NextResponse.json({ shares });
});

// POST /api/shares - Create a new share link
export const POST = withAuth(async (request, { userId, prisma }) => {
  const parsed = await parseBody(request, CreateShareRequestSchema);
  if ('error' in parsed) return parsed.error;

  const {
    project_id,
    access_level,
    expires_at,
    recipient_email,
    recipient_name,
    max_plays,
    password,
    scene_index,
    scene_start_ms,
  } = parsed.data;

  try {
    const result = await createShare(prisma, userId, {
      projectId: project_id,
      accessLevel: access_level,
      expiresAt: expires_at,
      recipientEmail: recipient_email,
      recipientName: recipient_name,
      maxPlays: max_plays,
      password,
      sceneIndex: scene_index ?? null,
      sceneStartMs: scene_start_ms ?? null,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ShareServiceError) {
      return errorResponse(error.message, error.statusCode, { code: error.code });
    }
    log.error('Error creating share', error);
    return errorResponse('Failed to create share', 500);
  }
});
