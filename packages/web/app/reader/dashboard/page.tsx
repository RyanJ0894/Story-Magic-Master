import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload } from 'lucide-react';
import { ReaderDashboardClient } from '@/components/dashboard/reader-dashboard-client';
import { AlertsDropdown } from '@/components/alerts/AlertsDropdown';
import type { ReaderLibraryEntryDetailed } from '@/lib/types/marketplace';

export default async function ReaderDashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Fetch profile with reader code
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Fetch reader library with project details
  const { data: libraryEntries } = await supabase
    .from('reader_library')
    .select(`
      *,
      projects (
        id,
        name,
        page_count,
        status,
        user_id,
        profiles:user_id (
          full_name,
          writer_code
        )
      ),
      script_shares (
        id,
        shared_by
      )
    `)
    .eq('reader_id', user.id)
    .neq('status', 'removed')
    .order('created_at', { ascending: false });

  // Check writer subscription status for each entry
  const { data: activeSubscriptions } = await supabase
    .from('subscriptions')
    .select('user_id')
    .in('status', ['active', 'trialing']);

  const activeWriterIds = new Set(activeSubscriptions?.map(s => s.user_id) || []);

  // Transform to detailed entries
  const entries: ReaderLibraryEntryDetailed[] = (libraryEntries || []).map(entry => {
    const project = entry.projects as any;
    const writerProfile = project?.profiles;
    const writerId = project?.user_id;

    return {
      id: entry.id,
      reader_id: entry.reader_id,
      project_id: entry.project_id,
      source: entry.source,
      share_id: entry.share_id,
      status: activeWriterIds.has(writerId) ? entry.status : 'archived',
      is_favorited: entry.is_favorited,
      notes: entry.notes,
      tags: entry.tags,
      last_played_at: entry.last_played_at,
      play_position_seconds: entry.play_position_seconds || 0,
      completed: entry.completed,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
      script_name: project?.name || 'Unknown Script',
      page_count: project?.page_count || 0,
      writer_name: writerProfile?.full_name || 'Unknown Writer',
      writer_code: writerProfile?.writer_code || '',
      writer_subscribed: activeWriterIds.has(writerId),
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

  const readerCode = profile?.reader_code || 'LOADING';

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
