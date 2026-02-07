import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';
import { UpdateShareRequestSchema } from '@/lib/api/dto';
import { validateCsrf } from '@/lib/csrf';

interface RouteParams {
  params: Promise<{ shareId: string }>;
}

// GET /api/shares/[shareId] - Get share details
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { shareId } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: share, error } = await supabase
    .from('script_shares')
    .select(`
      *,
      projects (
        id,
        name,
        page_count
      )
    `)
    .eq('id', shareId)
    .eq('shared_by', user.id)
    .single();

  if (error || !share) {
    return NextResponse.json({ error: 'Share not found' }, { status: 404 });
  }

  return NextResponse.json({ share });
}

// PATCH /api/shares/[shareId] - Update share settings
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const { shareId } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify ownership
  const { data: existingShare } = await supabase
    .from('script_shares')
    .select('id, shared_by')
    .eq('id', shareId)
    .single();

  if (!existingShare || existingShare.shared_by !== user.id) {
    return NextResponse.json({ error: 'Share not found or not authorized' }, { status: 404 });
  }

  // Parse and validate request body
  const body = await request.json();
  const parseResult = UpdateShareRequestSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parseResult.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const {
    access_level,
    expires_at,
    is_active,
    recipient_email,
    recipient_name,
    max_plays,
    password,
  } = parseResult.data;

  const updates: Record<string, unknown> = {};

  if (access_level !== undefined) updates.access_level = access_level;
  if (expires_at !== undefined) updates.expires_at = expires_at;
  if (is_active !== undefined) updates.is_active = is_active;
  if (recipient_email !== undefined) updates.recipient_email = recipient_email;
  if (recipient_name !== undefined) updates.recipient_name = recipient_name;
  if (max_plays !== undefined) updates.max_plays = max_plays;
  if (password !== undefined) {
    updates.password_hash = password ? await hashPassword(password) : null;
  }

  updates.updated_at = new Date().toISOString();

  const { data: share, error } = await supabase
    .from('script_shares')
    .update(updates)
    .eq('id', shareId)
    .select()
    .single();

  if (error) {
    console.error('Error updating share:', error);
    return NextResponse.json({ error: 'Failed to update share' }, { status: 500 });
  }

  return NextResponse.json({ share });
}

// DELETE /api/shares/[shareId] - Revoke/delete share
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const { shareId } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify ownership
  const { data: existingShare } = await supabase
    .from('script_shares')
    .select('id, shared_by')
    .eq('id', shareId)
    .single();

  if (!existingShare || existingShare.shared_by !== user.id) {
    return NextResponse.json({ error: 'Share not found or not authorized' }, { status: 404 });
  }

  // Soft delete by deactivating
  const { error } = await supabase
    .from('script_shares')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shareId);

  if (error) {
    console.error('Error deleting share:', error);
    return NextResponse.json({ error: 'Failed to delete share' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

