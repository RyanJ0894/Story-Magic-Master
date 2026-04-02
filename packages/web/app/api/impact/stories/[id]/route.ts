import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

// GET /api/impact/stories/[id] — fetch one story (public approved, or owner, or admin)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();

  const story = await prisma.impactStory.findUnique({ where: { id } });
  if (!story) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isOwner = userId && story.userId === userId;
  const isPublicAndApproved = story.isPublic && story.isApproved;

  if (!isOwner && !isPublicAndApproved) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Increment view count for public stories (fire and forget)
  if (isPublicAndApproved) {
    prisma.impactStory.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    }).catch(() => {});
  }

  return NextResponse.json(story);
}

// PATCH /api/impact/stories/[id] — update voice, share settings, author info
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const story = await prisma.impactStory.findUnique({ where: { id } });
  if (!story) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (story.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const allowed = ['voiceId', 'voiceName', 'isPublic', 'prizeEligible', 'authorName', 'authorCity', 'title'];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  const updated = await prisma.impactStory.update({ where: { id }, data });
  return NextResponse.json(updated);
}
