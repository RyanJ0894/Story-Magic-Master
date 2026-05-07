import { withApiKey } from '@/lib/api/api-key-auth';
import { NextResponse } from 'next/server';

export const GET = withApiKey(async (_request, { userId, prisma, params }) => {
  const jobId = params.id;

  if (!jobId) {
    return NextResponse.json({ error: 'Job ID required.' }, { status: 400 });
  }

  const job = await prisma.job.findFirst({
    where: { id: jobId, userId },
    select: {
      id: true,
      status: true,
      progress: true,
      error: true,
      createdAt: true,
      completedAt: true,
      projectId: true,
    },
  });

  if (!job) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }

  return NextResponse.json({ job });
});
