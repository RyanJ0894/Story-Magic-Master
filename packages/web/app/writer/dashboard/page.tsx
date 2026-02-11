import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { WriterDashboardClient } from '@/components/dashboard/writer-dashboard-client';
import { AlertsDropdown } from '@/components/alerts/AlertsDropdown';
import type { WriterScriptSummary, Subscription, SubscriptionLimits } from '@/lib/types/marketplace';

export default async function WriterDashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }

  // Fetch profile with writer code
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
  });

  // Fetch subscription
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: { in: ['active', 'trialing'] } },
  });

  // Fetch scripts with stats
  const projects = await prisma.project.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      status: true,
      pageCount: true,
      createdAt: true,
      directorJson: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Fetch share counts for each project
  const shares = await prisma.scriptShare.findMany({
    where: { sharedBy: userId },
    select: { projectId: true, viewCount: true },
  });

  // Fetch audio outputs to check which have audio
  const projectIds = projects.map(p => p.id);
  const audioOutputs = await prisma.audioOutput.findMany({
    where: { projectId: { in: projectIds } },
    select: { projectId: true },
  });

  // Build scripts with stats
  const scripts: WriterScriptSummary[] = (projects || []).map(project => {
    const projectShares = shares?.filter(s => s.projectId === project.id) || [];
    const hasAudio = audioOutputs?.some(a => a.projectId === project.id);

    return {
      project_id: project.id,
      name: project.name,
      status: project.status,
      page_count: project.pageCount,
      created_at: project.createdAt.toISOString(),
      share_count: projectShares.length,
      reader_count: projectShares.length, // Simplified
      total_views: projectShares.reduce((sum, s) => sum + (s.viewCount || 0), 0),
      audio_generated: hasAudio || false,
    };
  });

  // Calculate limits
  const limits: SubscriptionLimits = {
    generations_remaining: subscription?.generationsLimit
      ? subscription.generationsLimit - (subscription.generationsUsed || 0)
      : 0,
    generations_limit: subscription?.generationsLimit || 0,
    downloads_remaining: subscription?.downloadsLimit
      ? subscription.downloadsLimit - (subscription.downloadsUsed || 0)
      : 0,
    downloads_limit: subscription?.downloadsLimit || 0,
    period_ends: subscription?.currentPeriodEnd?.toISOString() || null,
  };

  // Calculate totals
  const stats = {
    totalScripts: scripts.length,
    totalShares: scripts.reduce((sum, s) => sum + s.share_count, 0),
    totalReaders: scripts.reduce((sum, s) => sum + s.reader_count, 0),
    totalViews: scripts.reduce((sum, s) => sum + s.total_views, 0),
  };

  const writerCode = profile?.writerCode || 'LOADING';

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
              <Badge variant="secondary">Writer</Badge>
            </div>
            <div className="flex items-center gap-4">
              <AlertsDropdown />
              <Link href="/projects/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Script
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <WriterDashboardClient
          scripts={scripts}
          subscription={subscription as Subscription | null}
          limits={limits}
          writerCode={writerCode}
          stats={stats}
        />
      </main>
    </div>
  );
}
