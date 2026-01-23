/**
 * Alerts API Route
 *
 * GET /api/alerts - Get user's alerts
 * POST /api/alerts/mark-read - Mark alerts as read
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// =============================================================================
// GET - List alerts
// =============================================================================

export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get('unread') === 'true';
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);

  try {
    let query = supabase
      .from('alerts')
      .select(
        `
        id,
        alert_type,
        title,
        message,
        project_id,
        team_id,
        related_user_id,
        metadata,
        is_read,
        read_at,
        created_at,
        projects:project_id (
          id,
          name
        ),
        teams:team_id (
          id,
          name
        ),
        related_user:related_user_id (
          full_name,
          avatar_url
        )
      `
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data: alerts, error } = await query;

    if (error) throw error;

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    return NextResponse.json({
      alerts: alerts || [],
      unreadCount: unreadCount || 0,
    });
  } catch (error) {
    console.error('[Alerts] Error listing:', error);
    return NextResponse.json(
      {
        error: 'Failed to list alerts',
        code: 'LIST_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH - Mark alerts as read
// =============================================================================

export async function PATCH(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  let body: { alertIds?: string[]; markAllRead?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'PARSE_ERROR' }, { status: 400 });
  }

  const { alertIds, markAllRead } = body;

  try {
    if (markAllRead) {
      // Mark all unread alerts as read
      const { error } = await supabase
        .from('alerts')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
    } else if (alertIds && alertIds.length > 0) {
      // Mark specific alerts as read
      const { error } = await supabase
        .from('alerts')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .in('id', alertIds);

      if (error) throw error;
    } else {
      return NextResponse.json(
        { error: 'Must provide alertIds or markAllRead', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Alerts] Error marking read:', error);
    return NextResponse.json(
      {
        error: 'Failed to mark alerts as read',
        code: 'UPDATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
