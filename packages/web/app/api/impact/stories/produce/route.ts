import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const maxDuration = 60;

/**
 * POST /api/impact/stories/produce
 *
 * Triggers full audio production for an impact story.
 * Uses the existing orchestrator pipeline with a simplified direct-voice script.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { storyId, storyText, voiceId, voiceName, title } = body;

  if (!storyId || !storyText || !voiceId) {
    return NextResponse.json({ error: 'storyId, storyText, and voiceId are required' }, { status: 400 });
  }

  const story = await prisma.impactStory.findUnique({ where: { id: storyId } });
  if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 });

  if (story.status === 'complete' && story.audioUrl) {
    return NextResponse.json({ audioUrl: story.audioUrl, storyId });
  }

  // Mark as processing
  await prisma.impactStory.update({
    where: { id: storyId },
    data: { status: 'processing', voiceId, voiceName: voiceName ?? null },
  });

  // Fire off production asynchronously via the orchestrator
  const orchestratorUrl = process.env.ORCHESTRATOR_URL ?? 'http://localhost:22002';

  try {
    const orchRes = await fetch(`${orchestratorUrl}/impact/produce`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': process.env.ORCHESTRATOR_INTERNAL_KEY ?? '',
      },
      body: JSON.stringify({
        storyId,
        title: title ?? story.title,
        storyText,
        voiceId,
        voiceName,
      }),
    });

    if (!orchRes.ok) {
      // Fallback: mark as draft so user can retry
      await prisma.impactStory.update({ where: { id: storyId }, data: { status: 'draft' } });
      return NextResponse.json({ error: 'Orchestrator unavailable' }, { status: 503 });
    }

    const orchData = await orchRes.json();
    return NextResponse.json({ storyId, jobId: orchData.jobId ?? null });
  } catch {
    await prisma.impactStory.update({ where: { id: storyId }, data: { status: 'draft' } });
    return NextResponse.json({ error: 'Could not connect to audio service' }, { status: 503 });
  }
}
