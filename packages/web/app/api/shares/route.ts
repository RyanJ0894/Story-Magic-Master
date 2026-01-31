import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { hashPassword } from '@/lib/password';
import { CreateShareRequestSchema } from '@/lib/api/dto';

// GET /api/shares - List all shares for current user
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');

  let query = supabase
    .from('script_shares')
    .select(`
      *,
      projects (
        id,
        name,
        page_count
      )
    `)
    .eq('shared_by', user.id)
    .order('created_at', { ascending: false });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data: shares, error } = await query;

  if (error) {
    console.error('Error fetching shares:', error);
    return NextResponse.json({ error: 'Failed to fetch shares' }, { status: 500 });
  }

  return NextResponse.json({ shares });
}

// POST /api/shares - Create a new share link
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse and validate request body
  const body = await request.json();
  const parseResult = CreateShareRequestSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parseResult.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const {
    project_id,
    access_level,
    expires_at,
    recipient_email,
    recipient_name,
    max_plays,
    password,
  } = parseResult.data;

  // Verify user owns this project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name, user_id')
    .eq('id', project_id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (project.user_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized to share this project' }, { status: 403 });
  }

  // Check subscription status
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['active', 'trialing'])
    .single();

  if (!subscription) {
    return NextResponse.json(
      { error: 'Active subscription required to share scripts' },
      { status: 403 }
    );
  }

  // Generate share code
  const shareCode = nanoid(10);

  // Create share record
  const { data: share, error: shareError } = await supabase
    .from('script_shares')
    .insert({
      project_id,
      shared_by: user.id,
      share_code: shareCode,
      access_level,
      expires_at,
      recipient_email,
      recipient_name,
      max_plays,
      password_hash: password ? await hashPassword(password) : null,
      is_active: true,
    })
    .select()
    .single();

  if (shareError) {
    console.error('Error creating share:', shareError);
    return NextResponse.json({ error: 'Failed to create share' }, { status: 500 });
  }

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/s/${shareCode}`;

  return NextResponse.json({
    share,
    shareUrl,
    shareCode,
  });
}

