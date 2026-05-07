import { withAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import crypto from 'crypto';

export const POST = withAuth(
  async (_request, { userId, prisma, params }) => {
    const id = params.id;

    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!endpoint) {
      return NextResponse.json({ error: 'Webhook endpoint not found.' }, { status: 404 });
    }

    const newSecret = `whsec_${crypto.randomBytes(32).toString('hex')}`;

    await prisma.webhookEndpoint.update({
      where: { id },
      data: { secret: newSecret },
    });

    log.info('[WebhookEndpoints] Secret rotated', { userId, endpointId: id });

    return NextResponse.json({ secret: newSecret });
  },
  { csrf: true }
);
