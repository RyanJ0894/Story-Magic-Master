import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { sendStoryApprovedEmail } from '@/lib/email/impact';

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const profile = await prisma.profile.findUnique({ where: { id: userId }, select: { userType: true } });
  return profile?.userType === 'admin' ? userId : null;
}

// POST /api/admin/impact/stories/[id]/approve
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const story = await prisma.impactStory.findUnique({ where: { id } });
  if (!story) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.impactStory.update({
    where: { id },
    data: { isApproved: true },
  });

  // Fire-and-forget: notify user their story is live
  if (story.userId) {
    const profile = await prisma.profile.findUnique({
      where: { id: story.userId },
      select: { email: true },
    });
    if (profile?.email) {
      sendStoryApprovedEmail({
        to: profile.email,
        storyTitle: story.title,
        storyId: story.id,
      }).catch(() => {});
    }
  }

  return NextResponse.json(updated);
}

// DELETE /api/admin/impact/stories/[id]/approve — revoke approval
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const updated = await prisma.impactStory.update({
    where: { id },
    data: { isApproved: false },
  });

  return NextResponse.json(updated);
}
