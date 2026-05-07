import { withAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';

const MAX_CLONES_PER_USER = 5;
const MAX_FILE_SIZE_MB = 10;

export const GET = withAuth(async (_request, { userId, prisma }) => {
  const clones = await prisma.voiceClone.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, elevenLabsVoiceId: true, createdAt: true },
  });
  return NextResponse.json({ clones });
});

export const POST = withAuth(
  async (request, { userId, prisma }) => {
    const existing = await prisma.voiceClone.count({ where: { userId } });
    if (existing >= MAX_CLONES_PER_USER) {
      return NextResponse.json(
        { error: `Maximum ${MAX_CLONES_PER_USER} voice clones allowed per account.` },
        { status: 422 }
      );
    }

    const formData = await request.formData();
    const name = (formData.get('name') as string | null)?.trim();
    const file = formData.get('file') as File | null;

    if (!name || name.length < 2) {
      return NextResponse.json({ error: 'Name must be at least 2 characters.' }, { status: 400 });
    }
    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'Audio file is required.' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `Audio file must be under ${MAX_FILE_SIZE_MB} MB.` },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Voice cloning not configured.' }, { status: 503 });
    }

    // Forward to ElevenLabs Instant Voice Clone API
    const elForm = new FormData();
    elForm.append('name', name);
    elForm.append('files', file, file.name);

    const elRes = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: elForm,
    });

    if (!elRes.ok) {
      const body = await elRes.text();
      log.error('[VoiceClones] ElevenLabs IVC failed', undefined, { status: elRes.status, body });
      return NextResponse.json(
        { error: 'Voice clone creation failed. Please try a different audio sample.' },
        { status: 502 }
      );
    }

    const { voice_id } = (await elRes.json()) as { voice_id: string };

    const clone = await prisma.voiceClone.create({
      data: { userId, name, elevenLabsVoiceId: voice_id },
      select: { id: true, name: true, elevenLabsVoiceId: true, createdAt: true },
    });

    log.info('[VoiceClones] Created clone', { userId, cloneId: clone.id, voiceId: voice_id });
    return NextResponse.json({ clone }, { status: 201 });
  },
  { csrf: true }
);
