import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { uploadImpactAudio, isR2Configured } from '@/lib/storage/r2';
import { sendStoryProductionCompleteEmail } from '@/lib/email/impact';

export const maxDuration = 60;

/**
 * POST /api/impact/stories/produce
 *
 * Calls orchestrator for TTS → receives binary M4A → uploads to R2 → marks story complete.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { storyId, storyText, voiceId, voiceName, title } = body;

  if (!storyId || !storyText || !voiceId) {
    return NextResponse.json({ error: 'storyId, storyText, and voiceId are required' }, { status: 400 });
  }

  const story = await prisma.impactStory.findUnique({ where: { id: storyId } });
  if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 });
  if (story.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (story.status === 'complete' && story.audioUrl) {
    return NextResponse.json({ audioUrl: story.audioUrl, storyId });
  }

  await prisma.impactStory.update({
    where: { id: storyId },
    data: { status: 'processing', voiceId, voiceName: voiceName ?? null, title: title ?? story.title },
  });

  const orchestratorUrl = process.env.ORCHESTRATOR_URL ?? 'http://localhost:22002';

  try {
    const orchRes = await fetch(`${orchestratorUrl}/impact/produce`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-key': process.env.SERVICE_SECRET_KEY ?? '',
      },
      body: JSON.stringify({ storyId, title: title ?? story.title, storyText, voiceId, voiceName }),
    });

    if (!orchRes.ok) {
      await prisma.impactStory.update({ where: { id: storyId }, data: { status: 'draft' } });
      return NextResponse.json({ error: 'Audio service unavailable' }, { status: 503 });
    }

    // Receive M4A binary and upload to R2
    const audioBuf = Buffer.from(await orchRes.arrayBuffer());
    let audioUrl: string;

    if (isR2Configured()) {
      audioUrl = await uploadImpactAudio(audioBuf, `impact/${storyId}.m4a`);
    } else {
      // Fallback: orchestrator already stored on disk — shouldn't reach here in production
      await prisma.impactStory.update({ where: { id: storyId }, data: { status: 'draft' } });
      return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
    }

    await prisma.impactStory.update({
      where: { id: storyId },
      data: { status: 'complete', audioUrl },
    });

    // Fire-and-forget: email the user
    const profile = await prisma.profile.findUnique({ where: { id: userId }, select: { email: true } });
    if (profile?.email) {
      sendStoryProductionCompleteEmail({
        to: profile.email,
        storyTitle: title ?? story.title,
        audioUrl,
        isPublic: story.isPublic,
        prizeEligible: story.prizeEligible,
      }).catch(() => {});
    }

    return NextResponse.json({ storyId, audioUrl });
  } catch {
    await prisma.impactStory.update({ where: { id: storyId }, data: { status: 'draft' } });
    return NextResponse.json({ error: 'Could not connect to audio service' }, { status: 503 });
  }
}
