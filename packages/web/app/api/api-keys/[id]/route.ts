import { withAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';

export const DELETE = withAuth(
  async (_request, { userId, prisma, params }) => {
    const id = params.id;

    const deleted = await prisma.apiKey.deleteMany({
      where: { id, userId },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: 'API key not found.' }, { status: 404 });
    }

    log.info('[ApiKeys] Deleted', { userId, keyId: id });
    return new NextResponse(null, { status: 204 });
  },
  { csrf: true }
);
