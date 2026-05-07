import { withApiKey } from '@/lib/api/api-key-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { log } from '@/lib/logger';
import { rateLimit, getClientIp } from '@/lib/api/rate-limit';

const BodySchema = z.object({
  projectId: z.string().uuid(),
});

export const POST = withApiKey(async (request, { userId, prisma }) => {
  const limited = await rateLimit(getClientIp(request), 'strict');
  if (limited) return limited as NextResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'projectId (UUID) is required.' }, { status: 400 });
  }

  const { projectId } = parsed.data;

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true, scriptText: true, pageCount: true },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  if (!project.scriptText?.trim()) {
    return NextResponse.json({ error: 'Project has no script content.' }, { status: 422 });
  }

  const now = new Date().toISOString();

  const job = await prisma.job.create({
    data: {
      userId,
      projectId,
      status: 'queued',
      jobType: 'audio_generation',
      progress: { step: 'queued', percent: 0, details: 'Queued via API', updated_at: now },
      metadata: { source: 'public_api', workflowMode: 'automatic', pageCount: project.pageCount },
    },
    select: { id: true, status: true, createdAt: true },
  });

  log.info('[v1/generate] Job queued via API key', { jobId: job.id.slice(0, 8), userId, projectId });

  return NextResponse.json({ jobId: job.id, status: job.status }, { status: 202 });
});
