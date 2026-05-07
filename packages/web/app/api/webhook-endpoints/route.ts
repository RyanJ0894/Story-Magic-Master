import { withAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { log } from '@/lib/logger';

const ALLOWED_EVENTS = ['job.completed', 'job.failed'] as const;
const MAX_ENDPOINTS_PER_USER = 5;

const CreateSchema = z.object({
  url: z.string().url().startsWith('https://'),
  events: z
    .array(z.enum(ALLOWED_EVENTS))
    .min(1)
    .default(['job.completed', 'job.failed']),
});

export const GET = withAuth(async (_request, { userId, prisma }) => {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, url: true, events: true, createdAt: true },
  });
  return NextResponse.json({ endpoints });
});

export const POST = withAuth(
  async (request, { userId, prisma }) => {
    const existing = await prisma.webhookEndpoint.count({ where: { userId } });
    if (existing >= MAX_ENDPOINTS_PER_USER) {
      return NextResponse.json(
        { error: `Maximum ${MAX_ENDPOINTS_PER_USER} webhook endpoints per account.` },
        { status: 422 }
      );
    }

    let body: unknown;
    try { body = await request.json(); } catch { body = {}; }

    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'url (https://) and events ([job.completed|job.failed]) required.' },
        { status: 400 }
      );
    }

    const secret = randomBytes(32).toString('hex');

    const endpoint = await prisma.webhookEndpoint.create({
      data: { userId, url: parsed.data.url, secret, events: parsed.data.events },
      select: { id: true, url: true, events: true, createdAt: true },
    });

    log.info('[WebhookEndpoints] Created', { userId, endpointId: endpoint.id });

    // Return secret once — needed by the caller to verify incoming webhook signatures
    return NextResponse.json({ endpoint: { ...endpoint, secret } }, { status: 201 });
  },
  { csrf: true }
);
