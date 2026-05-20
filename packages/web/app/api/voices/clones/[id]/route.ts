import { withAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';

export const DELETE = withAuth(
  async (_request, { userId, prisma, params }) => {
    const id = params.id as string;

    const clone = await prisma.voiceClone.findFirst({
      where: { id, userId },
      select: { id: true, elevenLabsVoiceId: true },
    });

    if (!clone) {
      return NextResponse.json({ error: 'Voice clone not found.' }, { status: 404 });
    }

    // Remove from ElevenLabs first — fail loudly if it errors so user can retry
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (apiKey) {
      const elRes = await fetch(`https://api.elevenlabs.io/v1/voices/${clone.elevenLabsVoiceId}`, {
        method: 'DELETE',
        headers: { 'xi-api-key': apiKey },
      });
      if (!elRes.ok && elRes.status !== 404) {
        log.error('[VoiceClones] ElevenLabs delete failed', undefined, {
          voiceId: clone.elevenLabsVoiceId,
          status: elRes.status,
        });
        return NextResponse.json(
          { error: 'Failed to delete voice from ElevenLabs. Please try again.' },
          { status: 502 }
        );
      }
    }

    await prisma.voiceClone.delete({ where: { id: clone.id } });
    log.info('[VoiceClones] Deleted clone', { userId, cloneId: id });

    return new NextResponse(null, { status: 204 });
  },
  { csrf: true }
);
