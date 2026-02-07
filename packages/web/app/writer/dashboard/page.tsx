import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { WriterDashboardClient } from '@/components/dashboard/writer-dashboard-client';
import { AlertsDropdown } from '@/components/alerts/AlertsDropdown';
import type { WriterScriptSummary, Subscription, SubscriptionLimits } from '@/lib/types/marketplace';

export default async function WriterDashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Fetch profile with writer code
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Fetch subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['active', 'trialing'])
    .single();

  // Fetch scripts with stats
  const { data: projects } = await supabase
    .from('projects')
    .select(`
      id,
      name,
      status,
      page_count,
      created_at,
      director_json
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Fetch share counts for each project
  const { data: shares } = await supabase
    .from('script_shares')
    .select('project_id, view_count')
    .eq('shared_by', user.id);

  // Fetch audio outputs to check which have audio
  const { data: audioOutputs } = await supabase
    .from('audio_outputs')
    .select('project_id')
    .in('project_id', projects?.map(p => p.id) || []);

  // Build scripts with stats
  const scripts: WriterScriptSummary[] = (projects || []).map(project => {
    const projectShares = shares?.filter(s => s.project_id === project.id) || [];
    const hasAudio = audioOutputs?.some(a => a.project_id === project.id);

    return {
      project_id: project.id,
      name: project.name,
      status: project.status,
      page_count: project.page_count,
      created_at: project.created_at,
      share_count: projectShares.length,
      reader_count: projectShares.length, // Simplified
      total_views: projectShares.reduce((sum, s) => sum + (s.view_count || 0), 0),
      audio_generated: hasAudio || false,
    };
  });

  // Calculate limits
  const limits: SubscriptionLimits = {
    generations_remaining: subscription?.generations_limit
      ? subscription.generations_limit - (subscription.generations_used || 0)
      : 0,
    generations_limit: subscription?.generations_limit || 0,
    downloads_remaining: subscription?.downloads_limit
      ? subscription.downloads_limit - (subscription.downloads_used || 0)
      : 0,
    downloads_limit: subscription?.downloads_limit || 0,
    period_ends: subscription?.current_period_end || null,
  };

  // Calculate totals
  const stats = {
    totalScripts: scripts.length,
    totalShares: scripts.reduce((sum, s) => sum + s.share_count, 0),
    totalReaders: scripts.reduce((sum, s) => sum + s.reader_count, 0),
    totalViews: scripts.reduce((sum, s) => sum + s.total_views, 0),
  };

  const writerCode = profile?.writer_code || 'LOADING';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur">
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
