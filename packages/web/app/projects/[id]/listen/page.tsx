export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import { ScreenplayReader } from '@/components/player/screenplay-reader';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ListenPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const { userId } = await auth();
  if (!userId) redirect('/login');

  // Load project
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      userId: true,
      directorJson: true,
      status: true,
    },
  });
  if (!project) notFound();

  const isOwner = project.userId === userId;

  // Check access: owner or team member with a TeamShare for this project
  let teamId: string | null = null;
  let entryId: string | null = null;
  let initialReadStatus: 'like' | 'pass' | 'undecided' = 'undecided';

  if (!isOwner) {
    // Find the team this user belongs to that has this project shared.
    // Deactivated sub-accounts must lose access — status alone is insufficient
    // because the deactivation handler only writes deactivatedAt (DT-32-C-1).
    const membership = await prisma.teamMember.findFirst({
      where: { userId, status: 'accepted', deactivatedAt: null },
      include: {
        team: {
          include: {
            teamShares: {
              where: { projectId },
              select: { id: true },
            },
          },
        },
      },
    });

    const hasAccess = membership?.team?.teamShares && membership.team.teamShares.length > 0;

    // Also check if owner shared directly (script share)
    const directShare = await prisma.scriptShare.findFirst({
      where: { projectId, sharedWith: userId },
      select: { id: true },
    });

    if (!hasAccess && !directShare) {
      redirect('/reader/dashboard');
    }

    teamId = membership?.teamId ?? null;

    // Find or create ReaderLibrary entry
    let entry = await prisma.readerLibrary.findFirst({
      where: { readerId: userId, projectId },
      select: { id: true, readStatus: true },
    });

    if (!entry) {
      entry = await prisma.readerLibrary.create({
        data: {
          readerId: userId,
          projectId,
          source: 'received',
          shareId: directShare?.id ?? null,
          status: 'active',
        },
        select: { id: true, readStatus: true },
      });
    }

    entryId = entry.id;
    const rs = entry.readStatus;
    if (rs === 'like' || rs === 'pass' || rs === 'undecided') {
      initialReadStatus = rs;
    }
  }

  // Load audio outputs
  const audioOutputs = await prisma.audioOutput.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { id: true, fileName: true, filePath: true, durationSeconds: true, format: true },
  });

  // Load existing notes for this user
  const notesRaw = await prisma.projectNote.findMany({
    where: { projectId, authorId: userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, noteText: true, lineId: true, timestamp: true, createdAt: true },
  });

  // Extract scenes from directorJson
  type DirJson = { scenes?: Array<{ scene_id?: string; scene_header?: string; dialogue?: Array<{ line_id: string; character: string; text: string; voice_key?: string }> }> };
  const djson = project.directorJson as DirJson | null;
  const scenes = (djson?.scenes ?? []).map((s) => ({
    scene_id: s.scene_id,
    scene_header: s.scene_header,
    dialogue: (s.dialogue ?? []).map((l) => ({
      line_id: l.line_id,
      character: l.character,
      text: l.text,
      voice_key: l.voice_key,
    })),
  }));

  const orchestratorUrl = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? '';

  return (
    <ScreenplayReader
      projectId={projectId}
      projectName={project.name}
      audioOutputs={audioOutputs.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        filePath: a.filePath,
        durationSeconds: a.durationSeconds ? Number(a.durationSeconds) : undefined,
        format: a.format ?? undefined,
      }))}
      scenes={scenes}
      initialReadStatus={initialReadStatus}
      initialNotes={notesRaw.map((n) => ({
        id: n.id,
        noteText: n.noteText,
        lineId: n.lineId,
        timestamp: n.timestamp,
        createdAt: n.createdAt.toISOString(),
      }))}
      entryId={entryId}
      teamId={teamId}
      orchestratorUrl={orchestratorUrl}
      isOwner={isOwner}
    />
  );
}
