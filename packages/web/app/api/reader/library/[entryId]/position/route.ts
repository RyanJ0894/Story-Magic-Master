import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { validateCsrf } from '@/lib/csrf';

interface RouteParams {
  params: Promise<{ entryId: string }>;
}

// POST /api/reader/library/[entryId]/position - Update playback position
export async function POST(request: NextRequest, { params }: RouteParams) {
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const { entryId } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify ownership
  const { data: existingEntry } = await supabase
    .from('reader_library')
    .select('id, reader_id')
    .eq('id', entryId)
    .single();

  if (!existingEntry || existingEntry.reader_id !== user.id) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  const body = await request.json();
  const { position, duration, completed } = body;

  if (typeof position !== 'number') {
    return NextResponse.json({ error: 'Position required' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    play_position_seconds: Math.floor(position),
    last_played_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Mark as completed if near the end
  if (completed || (duration && position >= duration - 30)) {
    updates.completed = true;
  }

  const { data: entry, error } = await supabase
    .from('reader_library')
    .update(updates)
    .eq('id', entryId)
    .select()
    .single();

  if (error) {
    console.error('Error updating position:', error);
    return NextResponse.json({ error: 'Failed to update position' }, { status: 500 });
  }

  // Log access for analytics
  await supabase
    .from('content_access_log')
    .insert({
      user_id: user.id,
      project_id: existingEntry.id,
      access_type: 'stream',
      session_duration_seconds: Math.floor(position),
    });

  return NextResponse.json({
    entry,
    position: entry.play_position_seconds,
    completed: entry.completed,
  });
}
