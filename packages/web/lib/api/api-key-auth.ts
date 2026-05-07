import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashApiKey } from '@/lib/api-keys';

export interface ApiKeyContext {
  userId: string;
  keyId: string;
  params: Record<string, string>;
  prisma: typeof prisma;
}

type RouteContext = { params: Promise<Record<string, string>> };

type ApiKeyHandler = (
  request: NextRequest,
  context: ApiKeyContext
) => Promise<NextResponse> | NextResponse;

export function withApiKey(handler: ApiKeyHandler) {
  return async (request: NextRequest, route: RouteContext): Promise<NextResponse> => {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer sm_live_')) {
      return NextResponse.json({ error: 'Missing or invalid API key.' }, { status: 401 });
    }

    const rawKey = authHeader.slice('Bearer '.length);
    const keyHash = hashApiKey(rawKey);

    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      select: { id: true, userId: true },
    });

    if (!apiKey) {
      return NextResponse.json({ error: 'Invalid API key.' }, { status: 401 });
    }

    // Update lastUsedAt asynchronously — no need to block the request
    prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    const params = route?.params ? await route.params : {};

    return handler(request, { userId: apiKey.userId, keyId: apiKey.id, params, prisma });
  };
}
