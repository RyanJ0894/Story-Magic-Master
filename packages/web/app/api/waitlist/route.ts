/**
 * Voice Marketplace Waitlist API
 * POST /api/waitlist — register interest in the voice marketplace
 *
 * Accepts multipart/form-data (with optional audio demo) or JSON.
 * Audio file is uploaded to R2 if configured; otherwise silently skipped.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

const schema = z.object({
  email: z.string().email(),
  name: z.string().max(100).optional(),
  role: z.enum(['actor', 'producer', 'both']),
  notes: z.string().max(1000).optional(),
});

const MAX_AUDIO_BYTES = 500 * 1024 * 1024; // 500 MB
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/x-wav', 'audio/wave'];

async function uploadDemoAudio(file: File): Promise<string | null> {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
    return null; // R2 not configured — skip upload, don't fail the form
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp3';
  const key = `voice-demos/${randomUUID()}.${ext}`;

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  const buffer = Buffer.from(await file.arrayBuffer());
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: file.type || 'audio/mpeg',
    CacheControl: 'private, max-age=86400',
  }));

  return `${publicUrl.replace(/\/$/, '')}/${key}`;
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  let email: string, name: string | undefined, role: 'actor' | 'producer' | 'both', notes: string | undefined;
  let audioFile: File | null = null;

  if (contentType.includes('multipart/form-data')) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
    }

    const raw = {
      email: formData.get('email'),
      name: formData.get('name') || undefined,
      role: formData.get('role'),
      notes: formData.get('notes') || undefined,
    };

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    ({ email, name, role, notes } = parsed.data);

    const maybeFile = formData.get('demoAudio');
    if (maybeFile instanceof File && maybeFile.size > 0) {
      if (maybeFile.size > MAX_AUDIO_BYTES) {
        return NextResponse.json({ error: 'Audio file must be under 500 MB' }, { status: 413 });
      }
      if (!ALLOWED_AUDIO_TYPES.includes(maybeFile.type)) {
        return NextResponse.json({ error: 'Audio must be an MP3, WAV, or OGG file' }, { status: 400 });
      }
      audioFile = maybeFile;
    }
  } else {
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
    ({ email, name, role, notes } = parsed.data);
  }

  // Upload demo audio if provided (non-blocking failure — form still saves)
  let demoAudioUrl: string | undefined;
  if (audioFile) {
    try {
      demoAudioUrl = (await uploadDemoAudio(audioFile)) ?? undefined;
    } catch {
      // Audio upload failure should not block form submission
    }
  }

  try {
    await prisma.voiceMarketplaceInterest.upsert({
      where: { email },
      update: { name, role, notes, ...(demoAudioUrl && { demoAudioUrl }) },
      create: { email, name, role, notes, demoAudioUrl },
    });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to save. Please try again.' },
      { status: 500 }
    );
  }
}
