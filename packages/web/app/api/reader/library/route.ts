import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Type for the nested join query result
interface LibraryEntryWithProject {
  id: string;
  reader_id: string;
  project_id: string;
  source: 'received' | 'uploaded' | 'purchased';
  share_id: string | null;
  status: 'active' | 'archived' | 'removed';
  is_favorited: boolean;
  notes: string | null;
  tags: string[];
  last_played_at: string | null;
  play_position_seconds: number | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
  projects: {
    id: string;
    name: string;
    page_count: number;
    status: string;
    user_id: string;
    profiles: {
      full_name: string | null;
      writer_code: string | null;
    } | null;
  } | null;
  script_shares: {
    id: string;
    shared_by: string;
    access_level: 'stream' | 'download';
  } | null;
}

// GET /api/reader/library - Get reader's library
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source');
  const status = searchParams.get('status');
  const favorited = searchParams.get('favorited');

  let query = supabase
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
        shared_by,
        access_level
      )
    `)
    .eq('reader_id', user.id)
    .neq('status', 'removed')
    .order('created_at', { ascending: false });

  if (source) {
    query = query.eq('source', source);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (favorited === 'true') {
    query = query.eq('is_favorited', true);
  }

  const { data: entriesData, error } = await query;

  const entries = entriesData as LibraryEntryWithProject[] | null;

  if (error) {
    console.error('Error fetching library:', error);
    return NextResponse.json({ error: 'Failed to fetch library' }, { status: 500 });
  }

  // Check writer subscription status for each entry
  const writerIds = Array.from(new Set(entries?.map(e => e.projects?.user_id).filter(Boolean) || [])) as string[];

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('user_id')
    .in('user_id', writerIds)
    .in('status', ['active', 'trialing']);

  const activeWriterIds = new Set(subscriptions?.map(s => s.user_id) || []);

  // Get audio durations
  const projectIds = entries?.map(e => e.project_id).filter(Boolean) || [];
  const { data: audioOutputs } = await supabase
    .from('audio_outputs')
    .select('project_id, duration_seconds')
    .in('project_id', projectIds);

  const durationMap = new Map(audioOutputs?.map(a => [a.project_id, a.duration_seconds]) || []);

  // Transform entries
  const transformedEntries = (entries || []).map(entry => {
    const project = entry.projects;
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
      duration_seconds: durationMap.get(entry.project_id) || 0,
    };
  });

  return NextResponse.json({ entries: transformedEntries });
}
