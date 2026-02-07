import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { validateCsrf } from '@/lib/csrf';

interface RouteParams {
  params: Promise<{ entryId: string }>;
}

// GET /api/reader/library/[entryId] - Get single library entry
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { entryId } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: entry, error } = await supabase
    .from('reader_library')
    .select(`
      *,
      projects (
        id,
        name,
        page_count,
        status,
        user_id,
        director_json,
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
    .eq('id', entryId)
    .eq('reader_id', user.id)
    .single();

  if (error || !entry) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  // Get audio output
  const { data: audioOutput } = await supabase
    .from('audio_outputs')
    .select('*')
    .eq('project_id', entry.project_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({
    entry,
    audio: audioOutput,
  });
}

// PATCH /api/reader/library/[entryId] - Update library entry
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
  const {
    notes,
    tags,
    play_position_seconds,
    completed,
    readStatus,
  } = body;

  const updates: Record<string, unknown> = {};

  if (notes !== undefined) updates.notes = notes;
  if (tags !== undefined) updates.tags = tags;
  if (play_position_seconds !== undefined) {
    updates.play_position_seconds = play_position_seconds;
    updates.last_played_at = new Date().toISOString();
  }
  if (completed !== undefined) updates.completed = completed;

  // Handle read status (Like/Pass/Undecided)
  if (readStatus !== undefined) {
    if (!['like', 'pass', 'undecided'].includes(readStatus)) {
      return NextResponse.json(
        { error: 'Invalid read status. Must be like, pass, or undecided.' },
        { status: 400 }
      );
    }
    updates.read_status = readStatus;
    updates.read_status_updated_at = new Date().toISOString();
  }

  updates.updated_at = new Date().toISOString();

  const { data: entry, error } = await supabase
    .from('reader_library')
    .update(updates)
    .eq('id', entryId)
    .select()
    .single();

  if (error) {
    console.error('Error updating entry:', error);
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 });
  }

  return NextResponse.json({ entry });
}

// DELETE /api/reader/library/[entryId] - Remove from library
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

  // Soft delete by setting status to removed
  const { error } = await supabase
    .from('reader_library')
    .update({
      status: 'removed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId);

  if (error) {
    console.error('Error removing entry:', error);
    return NextResponse.json({ error: 'Failed to remove entry' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
