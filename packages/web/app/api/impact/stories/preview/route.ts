import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

export const maxDuration = 60;

/**
 * POST /api/impact/stories/preview
 *
 * Generates a short audio preview (first 150 words) for the wizard preview step.
 * Returns an audio URL that can be played directly in the browser.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { storyId, storyText, voiceId, voiceName } = body;

  if (!storyText || !voiceId) {
    return NextResponse.json({ error: 'storyText and voiceId are required' }, { status: 400 });
  }

  // Truncate to ~150 words for preview
  const previewText = storyText
    .trim()
    .split(/\s+/)
    .slice(0, 150)
    .join(' ');

  const orchestratorUrl = process.env.ORCHESTRATOR_URL ?? 'http://localhost:22002';

  try {
    const orchRes = await fetch(`${orchestratorUrl}/impact/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': process.env.ORCHESTRATOR_INTERNAL_KEY ?? '',
      },
      body: JSON.stringify({ storyText: previewText, voiceId, voiceName }),
    });

    if (!orchRes.ok) {
      return NextResponse.json({ error: 'Audio preview unavailable' }, { status: 503 });
    }

    const data = await orchRes.json();
    const audioUrl: string = data.audioUrl;

    if (storyId && audioUrl) {
      await prisma.impactStory.update({
        where: { id: storyId },
        data: { audioUrl },
      }).catch(() => {});
    }

    return NextResponse.json({ audioUrl });
  } catch {
    return NextResponse.json({ error: 'Could not connect to audio service' }, { status: 503 });
  }
}
