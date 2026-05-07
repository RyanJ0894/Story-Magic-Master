import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withProjectAuth, parseBody } from '@/lib/api/middleware';

const PutEmotionOverridesSchema = z.object({
  overrides: z.record(z.string(), z.string()),
});

// GET /api/projects/[id]/emotion-overrides
export const GET = withProjectAuth(async (_request, { project }) => {
  const raw = project.emotionOverrides as Record<string, string> | null;
  return NextResponse.json({ overrides: raw ?? {} });
});

// PUT /api/projects/[id]/emotion-overrides
export const PUT = withProjectAuth(async (request, { prisma, projectId }) => {
  const parsed = await parseBody(request, PutEmotionOverridesSchema);
  if ('error' in parsed) return parsed.error;

  await prisma.project.update({
    where: { id: projectId },
    data: { emotionOverrides: parsed.data.overrides },
  });

  return NextResponse.json({ overrides: parsed.data.overrides });
});
