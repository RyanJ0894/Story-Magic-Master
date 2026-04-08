/**
 * Voice Marketplace Waitlist API
 * POST /api/waitlist — register interest in the voice marketplace
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  name: z.string().max(100).optional(),
  role: z.enum(['actor', 'producer', 'both']),
  notes: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, name, role, notes } = parsed.data;

  try {
    await prisma.voiceMarketplaceInterest.upsert({
      where: { email },
      update: { name, role, notes },
      create: { email, name, role, notes },
    });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to save. Please try again.' },
      { status: 500 }
    );
  }
}
