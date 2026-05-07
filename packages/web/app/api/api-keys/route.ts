import { withAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateApiKey, MAX_KEYS_PER_USER } from '@/lib/api-keys';
import { log } from '@/lib/logger';

const CreateSchema = z.object({
  name: z.string().min(1).max(64),
});

export const GET = withAuth(async (_request, { userId, prisma }) => {
  const keys = await prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, createdAt: true },
  });
  return NextResponse.json({ keys });
});

export const POST = withAuth(
  async (request, { userId, prisma }) => {
    const existing = await prisma.apiKey.count({ where: { userId } });
    if (existing >= MAX_KEYS_PER_USER) {
      return NextResponse.json(
        { error: `Maximum ${MAX_KEYS_PER_USER} API keys per account.` },
        { status: 422 }
      );
    }

    let body: unknown;
    try { body = await request.json(); } catch { body = {}; }

    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'name is required (1–64 chars).' }, { status: 400 });
    }

    const { raw, hash, prefix } = generateApiKey();

    const key = await prisma.apiKey.create({
      data: { userId, name: parsed.data.name, keyHash: hash, keyPrefix: prefix },
      select: { id: true, name: true, keyPrefix: true, createdAt: true },
    });

    log.info('[ApiKeys] Created', { userId, keyId: key.id });

    // raw is returned ONCE — never stored, never retrievable again
    return NextResponse.json({ key: { ...key, raw } }, { status: 201 });
  },
  { csrf: true }
);
