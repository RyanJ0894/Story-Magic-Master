import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ entryId: string }>;
}

// POST /api/reader/library/[entryId]/favorite - Toggle favorite
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { entryId } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify ownership
  const { data: existingEntry } = await supabase
    .from('reader_library')
    .select('id, reader_id, is_favorited')
    .eq('id', entryId)
    .single();

  if (!existingEntry || existingEntry.reader_id !== user.id) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  const body = await request.json();
  const is_favorited = body.is_favorited ?? !existingEntry.is_favorited;

  const { data: entry, error } = await supabase
    .from('reader_library')
    .update({
      is_favorited,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .select()
    .single();

  if (error) {
    console.error('Error updating favorite:', error);
    return NextResponse.json({ error: 'Failed to update favorite' }, { status: 500 });
  }

  return NextResponse.json({
    entry,
    is_favorited: entry.is_favorited,
  });
}
