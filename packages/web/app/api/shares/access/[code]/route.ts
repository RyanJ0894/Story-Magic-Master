import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, isBcryptHash, hashPassword } from '@/lib/password';
import { VerifySharePasswordRequestSchema } from '@/lib/api/dto';

interface RouteParams {
  params: Promise<{ code: string }>;
}

// Type for the nested join query result
interface ShareWithProject {
  id: string;
  project_id: string;
  shared_by: string;
  share_code: string;
  access_level: 'stream' | 'download';
  expires_at: string | null;
  password_hash: string | null;
  max_plays: number | null;
  view_count: number;
  play_count: number;
  is_active: boolean;
  recipient_email: string | null;
  recipient_name: string | null;
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
  projects: {
    id: string;
    name: string;
    page_count: number;
    user_id: string;
    profiles: {
      full_name: string | null;
      writer_code: string | null;
    } | null;
  } | null;
}

// GET /api/shares/access/[code] - Access a shared script by code
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { code } = await params;
  const supabase = await createClient();

  // Get share by code
  const { data: shareData, error } = await supabase
    .from('script_shares')
    .select(`
      *,
      projects (
        id,
        name,
        page_count,
        user_id,
        profiles:user_id (
          full_name,
          writer_code
        )
      )
    `)
    .eq('share_code', code)
    .eq('is_active', true)
    .single();

  const share = shareData as ShareWithProject | null;

  if (error || !share) {
    return NextResponse.json({ error: 'Share not found or expired' }, { status: 404 });
  }

  // Check expiration
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This share link has expired' }, { status: 410 });
  }

  // Check max plays
  if (share.max_plays && share.play_count >= share.max_plays) {
    return NextResponse.json({ error: 'This share link has reached its play limit' }, { status: 410 });
  }

  // Check if password protected
  if (share.password_hash) {
    return NextResponse.json({
      requiresPassword: true,
      projectName: share.projects?.name,
      writerName: share.projects?.profiles?.full_name,
    });
  }

  // Check writer subscription status
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', share.projects?.user_id)
    .in('status', ['active', 'trialing'])
    .single();

  if (!subscription) {
    return NextResponse.json(
      { error: 'This content is temporarily unavailable (writer subscription inactive)' },
      { status: 403 }
    );
  }

  // Increment view count
  await supabase
    .from('script_shares')
    .update({
      view_count: (share.view_count || 0) + 1,
      last_accessed_at: new Date().toISOString(),
    })
    .eq('id', share.id);

  // Get current user if logged in
  const { data: { user } } = await supabase.auth.getUser();

  // If logged in, add to reader's library
  if (user) {
    // Check if already in library
    const { data: existingEntry } = await supabase
      .from('reader_library')
      .select('id')
      .eq('reader_id', user.id)
      .eq('project_id', share.project_id)
      .single();

    if (!existingEntry) {
      await supabase
        .from('reader_library')
        .insert({
          reader_id: user.id,
          project_id: share.project_id,
          source: 'received',
          share_id: share.id,
          status: 'active',
        });
    }
  }

  // Get audio output for streaming
  const { data: audioOutput } = await supabase
    .from('audio_outputs')
    .select('id, file_url, duration_seconds, manifest')
    .eq('project_id', share.project_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({
    share: {
      id: share.id,
      accessLevel: share.access_level,
      expiresAt: share.expires_at,
    },
    project: {
      id: share.projects?.id,
      name: share.projects?.name,
      pageCount: share.projects?.page_count,
    },
    writer: {
      name: share.projects?.profiles?.full_name ?? '',
      code: share.projects?.profiles?.writer_code ?? '',
    },
    audio: audioOutput ? {
      url: audioOutput.file_url,
      duration: audioOutput.duration_seconds,
      manifest: audioOutput.manifest,
    } : null,
    canDownload: share.access_level === 'download',
  });
}

// POST /api/shares/access/[code] - Verify password for protected share
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { code } = await params;
  const supabase = await createClient();

  // Parse and validate request body
  const body = await request.json();
  const parseResult = VerifySharePasswordRequestSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parseResult.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { password } = parseResult.data;

  // Get share by code
  const { data: shareData, error } = await supabase
    .from('script_shares')
    .select(`
      *,
      projects (
        id,
        name,
        page_count,
        user_id,
        profiles:user_id (
          full_name,
          writer_code
        )
      )
    `)
    .eq('share_code', code)
    .eq('is_active', true)
    .single();

  const share = shareData as ShareWithProject | null;

  if (error || !share) {
    return NextResponse.json({ error: 'Share not found' }, { status: 404 });
  }

  // Verify password (supports both bcrypt and legacy SHA-256 hashes)
  if (!share.password_hash) {
    // No password set - this shouldn't happen as we only get here for protected shares
    return NextResponse.json({ error: 'Share configuration error' }, { status: 500 });
  }

  let isValid = false;
  if (isBcryptHash(share.password_hash)) {
    isValid = await verifyPassword(password, share.password_hash);
  } else {
    // Legacy SHA-256 hash - migrate to bcrypt on successful verification
    const legacyHash = await legacyHashPassword(password);
    isValid = legacyHash === share.password_hash;
    if (isValid) {
      // Migrate to bcrypt
      const bcryptHash = await hashPassword(password);
      await supabase
        .from('script_shares')
        .update({ password_hash: bcryptHash })
        .eq('id', share.id);
    }
  }
  if (!isValid) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  // Same checks as GET
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This share link has expired' }, { status: 410 });
  }

  if (share.max_plays && share.play_count >= share.max_plays) {
    return NextResponse.json({ error: 'This share link has reached its play limit' }, { status: 410 });
  }

  // Check writer subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', share.projects?.user_id)
    .in('status', ['active', 'trialing'])
    .single();

  if (!subscription) {
    return NextResponse.json(
      { error: 'This content is temporarily unavailable' },
      { status: 403 }
    );
  }

  // Increment view count
  await supabase
    .from('script_shares')
    .update({
      view_count: (share.view_count || 0) + 1,
      last_accessed_at: new Date().toISOString(),
    })
    .eq('id', share.id);

  // Get audio output
  const { data: audioOutput } = await supabase
    .from('audio_outputs')
    .select('id, file_url, duration_seconds, manifest')
    .eq('project_id', share.project_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({
    share: {
      id: share.id,
      accessLevel: share.access_level,
      expiresAt: share.expires_at,
    },
    project: {
      id: share.projects?.id,
      name: share.projects?.name,
      pageCount: share.projects?.page_count,
    },
    writer: {
      name: share.projects?.profiles?.full_name ?? '',
      code: share.projects?.profiles?.writer_code ?? '',
    },
    audio: audioOutput ? {
      url: audioOutput.file_url,
      duration: audioOutput.duration_seconds,
      manifest: audioOutput.manifest,
    } : null,
    canDownload: share.access_level === 'download',
  });
}

// Legacy SHA-256 hashing (for backward compatibility only)
async function legacyHashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
