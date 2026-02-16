export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { ensureProfile } from '@/lib/ensure-profile';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload } from 'lucide-react';
import { ReaderDashboardClient } from '@/components/dashboard/reader-dashboard-client';
import { AlertsDropdown } from '@/components/alerts/AlertsDropdown';
import type { ReaderLibraryEntryDetailed } from '@/lib/types/marketplace';

export default async function ReaderDashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }

  // Fetch (or auto-create) profile with reader code
  const profile = await ensureProfile(userId);

  // Fetch reader library with project details
  const libraryEntries = await prisma.readerLibrary.findMany({
    where: { readerId: userId, status: { not: 'removed' } },
    include: {
      project: {
        include: {
          user: {
            select: { fullName: true, writerCode: true },
          },
        },
      },
      share: {
        select: { id: true, sharedBy: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Check writer subscription status for each entry
  const activeSubscriptions = await prisma.subscription.findMany({
    where: { status: { in: ['active', 'trialing'] } },
    select: { userId: true },
  });

  const activeWriterIds = new Set(activeSubscriptions.map(s => s.userId));

  // Transform to detailed entries
  const entries: ReaderLibraryEntryDetailed[] = (libraryEntries || []).map(entry => {
    const project = entry.project;
    const writerProfile = project?.user;
    const writerId = project?.userId;

    return {
      id: entry.id,
      reader_id: entry.readerId,
      project_id: entry.projectId,
      source: entry.source as 'received' | 'uploaded' | 'purchased',
      share_id: entry.shareId,
      status: activeWriterIds.has(writerId ?? '') ? entry.status as 'active' | 'archived' | 'removed' : 'archived',
      is_favorited: entry.isFavorited,
      notes: entry.notes,
      tags: entry.tags,
      last_played_at: entry.lastPlayedAt?.toISOString() || null,
      play_position_seconds: entry.playPositionSeconds || 0,
      completed: entry.completed,
      created_at: entry.createdAt.toISOString(),
      updated_at: entry.updatedAt.toISOString(),
      script_name: project?.name || 'Unknown Script',
      page_count: project?.pageCount || 0,
      writer_name: writerProfile?.fullName || 'Unknown Writer',
      writer_code: writerProfile?.writerCode || '',
      writer_subscribed: activeWriterIds.has(writerId ?? ''),
      duration_seconds: 0, // Would come from audio_outputs
    };
  });

  // Calculate stats
  const stats = {
    totalScripts: entries.length,
    activeCount: entries.filter(e => e.status === 'active').length,
    archivedCount: entries.filter(e => e.status === 'archived').length,
    favoritedCount: entries.filter(e => e.is_favorited).length,
  };

  const readerCode = profile?.readerCode || 'LOADING';

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="font-bold text-xl">
                Story Magic
              </Link>
              <Badge variant="outline">Reader</Badge>
            </div>
            <div className="flex items-center gap-4">
              <AlertsDropdown />
              <Link href="/reader/upload">
                <Button variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Script
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ReaderDashboardClient
          entries={entries}
          readerCode={readerCode}
          stats={stats}
        />
      </main>
    </div>
  );
}
