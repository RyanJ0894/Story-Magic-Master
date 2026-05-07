import { withAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';

export const DELETE = withAuth(
  async (_request, { userId, prisma, params }) => {
    const id = params.id;

    const deleted = await prisma.webhookEndpoint.deleteMany({
      where: { id, userId },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Webhook endpoint not found.' }, { status: 404 });
    }

    log.info('[WebhookEndpoints] Deleted', { userId, endpointId: id });
    return new NextResponse(null, { status: 204 });
  },
  { csrf: true }
);
