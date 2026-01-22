/**
 * Data Mappers
 *
 * Transform between database entities, DTOs, and view models.
 * Ensures type safety and consistent data shapes across layers.
 */

import type {
  ShareResponse,
  ShareAccessResponse,
  LibraryEntryResponse,
  LibraryEntryDetailedResponse,
  AdminUser,
  AdminStats,
} from '../dto';

// =============================================================================
// Database Entity Types (from Supabase)
// =============================================================================

interface DbShare {
  id: string;
  project_id: string;
  shared_by: string;
  share_code: string;
  access_level: 'stream' | 'download';
  expires_at: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  max_plays: number | null;
  password_hash: string | null;
  view_count: number;
  play_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
  projects?: {
    id: string;
    name: string;
    page_count: number;
    user_id: string;
    profiles?: {
      full_name: string | null;
      writer_code: string | null;
    };
  };
}

interface DbLibraryEntry {
  id: string;
  reader_id: string;
  project_id: string;
  source: 'received' | 'uploaded' | 'purchased';
  share_id: string | null;
  status: 'active' | 'archived' | 'removed';
  is_favorited: boolean;
  notes: string | null;
  tags: string[] | null;
  last_played_at: string | null;
  play_position_seconds: number | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
  projects?: {
    id: string;
    name: string;
    page_count: number;
    status: string;
    user_id: string;
    profiles?: {
      full_name: string | null;
      writer_code: string | null;
    };
  };
}

interface DbProfile {
  id: string;
  full_name: string | null;
  user_type: 'writer' | 'reader' | 'admin';
  writer_code: string | null;
  reader_code: string | null;
  created_at: string;
  updated_at: string;
}

interface DbSubscription {
  id: string;
  user_id: string;
  status: 'active' | 'trialing' | 'canceled' | 'past_due';
}

// =============================================================================
// Share Mappers
// =============================================================================

export function mapDbShareToResponse(share: DbShare): ShareResponse {
  return {
    id: share.id,
    project_id: share.project_id,
    shared_by: share.shared_by,
    share_code: share.share_code,
    access_level: share.access_level,
    expires_at: share.expires_at,
    recipient_email: share.recipient_email,
    recipient_name: share.recipient_name,
    max_plays: share.max_plays,
    view_count: share.view_count ?? 0,
    play_count: share.play_count ?? 0,
    is_active: share.is_active,
    created_at: share.created_at,
    updated_at: share.updated_at,
    project: share.projects ? {
      id: share.projects.id,
      name: share.projects.name,
      page_count: share.projects.page_count,
    } : undefined,
  };
}

export function mapDbShareToAccessResponse(
  share: DbShare,
  audioOutput: { file_url: string; duration_seconds: number; manifest?: Record<string, unknown> } | null
): ShareAccessResponse {
  const project = share.projects;
  const writerProfile = project?.profiles;

  return {
    share: {
      id: share.id,
      accessLevel: share.access_level,
      expiresAt: share.expires_at,
    },
    project: {
      id: project?.id ?? '',
      name: project?.name ?? 'Unknown',
      pageCount: project?.page_count ?? 0,
    },
    writer: {
      name: writerProfile?.full_name ?? 'Unknown Writer',
      code: writerProfile?.writer_code ?? '',
    },
    audio: audioOutput ? {
      url: audioOutput.file_url,
      duration: audioOutput.duration_seconds,
      manifest: audioOutput.manifest,
    } : null,
    canDownload: share.access_level === 'download',
    requiresPassword: !!share.password_hash,
  };
}

// =============================================================================
// Library Mappers
// =============================================================================

export function mapDbLibraryEntryToResponse(entry: DbLibraryEntry): LibraryEntryResponse {
  return {
    id: entry.id,
    reader_id: entry.reader_id,
    project_id: entry.project_id,
    source: entry.source,
    share_id: entry.share_id,
    status: entry.status,
    is_favorited: entry.is_favorited,
    notes: entry.notes,
    tags: entry.tags ?? [],
    last_played_at: entry.last_played_at,
    play_position_seconds: entry.play_position_seconds ?? 0,
    completed: entry.completed,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  };
}

export function mapDbLibraryEntryToDetailedResponse(
  entry: DbLibraryEntry,
  writerSubscribed: boolean,
  durationSeconds: number
): LibraryEntryDetailedResponse {
  const project = entry.projects;
  const writerProfile = project?.profiles;

  // Override status if writer is not subscribed
  const effectiveStatus = writerSubscribed ? entry.status : 'archived';

  return {
    ...mapDbLibraryEntryToResponse({ ...entry, status: effectiveStatus }),
    script_name: project?.name ?? 'Unknown Script',
    page_count: project?.page_count ?? 0,
    writer_name: writerProfile?.full_name ?? 'Unknown Writer',
    writer_code: writerProfile?.writer_code ?? '',
    writer_subscribed: writerSubscribed,
    duration_seconds: durationSeconds,
  };
}

// =============================================================================
// Admin Mappers
// =============================================================================

interface DbUserWithStats {
  id: string;
  email: string;
  profile?: DbProfile;
  subscription?: DbSubscription | null;
  projects_count?: number;
  shares_count?: number;
}

export function mapDbUserToAdminUser(user: DbUserWithStats): AdminUser {
  const profile = user.profile;
  const subscription = user.subscription;

  let subscriptionStatus: 'active' | 'trialing' | 'canceled' | 'none' = 'none';
  if (subscription) {
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      subscriptionStatus = subscription.status;
    } else {
      subscriptionStatus = 'canceled';
    }
  }

  return {
    id: user.id,
    email: user.email,
    full_name: profile?.full_name ?? null,
    user_type: profile?.user_type ?? 'reader',
    writer_code: profile?.writer_code ?? null,
    reader_code: profile?.reader_code ?? null,
    created_at: profile?.created_at ?? new Date().toISOString(),
    subscription_status: subscriptionStatus,
    projects_count: user.projects_count ?? 0,
    shares_count: user.shares_count ?? 0,
  };
}

interface DbStats {
  total_users: number;
  writer_count: number;
  reader_count: number;
  active_subscription_count: number;
  project_count: number;
  share_count: number;
  mrr_cents: number;
  new_users_today: number;
  new_users_week: number;
  new_users_month: number;
}

export function mapDbStatsToAdminStats(stats: DbStats): AdminStats {
  return {
    total_users: stats.total_users,
    total_writers: stats.writer_count,
    total_readers: stats.reader_count,
    active_subscriptions: stats.active_subscription_count,
    total_projects: stats.project_count,
    total_shares: stats.share_count,
    mrr_cents: stats.mrr_cents,
    new_users_today: stats.new_users_today,
    new_users_week: stats.new_users_week,
    new_users_month: stats.new_users_month,
  };
}

// =============================================================================
// Validation Helpers
// =============================================================================

export function validateAndParse<T>(
  schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } },
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data as T };
  }
  return {
    success: false,
    error: JSON.stringify(result.error?.format() ?? 'Validation failed'),
  };
}

export function parseQueryParams(
  searchParams: URLSearchParams,
  schema: { safeParse: (data: unknown) => { success: boolean; data?: unknown } }
): Record<string, unknown> {
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  const result = schema.safeParse(params);
  return result.success ? (result.data as Record<string, unknown>) : params;
}

// =============================================================================
// Response Helpers
// =============================================================================

export function createSuccessResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function createErrorResponse(
  error: string,
  status = 400,
  details?: Record<string, unknown>
): Response {
  return new Response(
    JSON.stringify({ error, ...(details && { details }) }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): Response {
  return createSuccessResponse({
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  });
}
