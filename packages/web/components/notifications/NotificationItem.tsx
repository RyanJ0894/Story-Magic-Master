/**
 * Single notification row — shared between the dropdown and the full feed.
 *
 * Severity color uses SEVERITY_TOKENS from lib/notifications/feed-types so
 * the palette never drifts from the backend's contract.
 */

'use client';

import Link from 'next/link';
import { SEVERITY_TOKENS, type Severity } from '@/lib/notifications/feed-types';

export interface FeedNotification {
  id: string;
  alert_type: string;
  severity: Severity;
  title: string;
  message: string | null;
  project_id: string | null;
  team_id: string | null;
  related_user_id: string | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
  project: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
  related_user: { full_name: string | null; avatar_url: string | null } | null;
}

interface Props {
  notification: FeedNotification;
  /** Compact mode for the dropdown — single-line title, no message. */
  compact?: boolean;
}

export function NotificationItem({ notification, compact = false }: Props) {
  const tokens = SEVERITY_TOKENS[notification.severity];
  const linkHref = notification.project_id
    ? `/projects/${notification.project_id}`
    : notification.team_id
      ? `/enterprise/team`
      : '/dashboard/notifications';

  const content = (
    <div
      className={`flex items-start gap-3 p-3 ${notification.is_read ? '' : 'bg-blue-50/30'}`}
    >
      <span
        aria-hidden="true"
        className={`mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full ${tokens.bg.replace('bg-', 'bg-').replace('-50', '-500')}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={`text-sm ${notification.is_read ? 'font-normal text-gray-700' : 'font-semibold text-gray-900'}`}
          >
            {notification.title}
          </p>
          <time
            className="flex-shrink-0 text-xs text-gray-400"
            dateTime={notification.created_at}
          >
            {formatRelative(notification.created_at)}
          </time>
        </div>
        {!compact && notification.message && (
          <p className="mt-1 text-sm text-gray-600">{notification.message}</p>
        )}
        {notification.related_user?.full_name && (
          <p className="mt-1 text-xs text-gray-500">
            From {notification.related_user.full_name}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <Link
      href={linkHref}
      className={`block hover:bg-gray-50 ${tokens.text} ${tokens.ring} ring-inset ring-1`}
      aria-label={`${notification.severity} notification: ${notification.title}`}
    >
      {content}
    </Link>
  );
}

/**
 * Short relative-time formatting for compact display.
 * Uses Intl.RelativeTimeFormat with en-US locale (consistent with the
 * locale-fix policy from the 2026-06-09 review).
 */
function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  const diffHr = Math.round(diffMs / 3_600_000);
  const diffDay = Math.round(diffMs / 86_400_000);

  const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
  if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, 'minute');
  if (Math.abs(diffHr) < 24) return rtf.format(-diffHr, 'hour');
  if (Math.abs(diffDay) < 30) return rtf.format(-diffDay, 'day');
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}
