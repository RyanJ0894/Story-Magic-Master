/**
 * Client-side notification list with cursor pagination + mark-all-read.
 * Used on the /dashboard/notifications full feed page.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { NotificationItem, type FeedNotification } from '@/components/notifications/NotificationItem';

interface FeedResponse {
  notifications: FeedNotification[];
  nextCursor: string | null;
  unreadCount: number;
}

export function NotificationsFullList() {
  const [items, setItems] = useState<FeedNotification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  const load = useCallback(
    async (afterCursor: string | null, replace = false) => {
      setLoading(true);
      setError(null);
      try {
        const url = new URL('/api/master/notifications', window.location.origin);
        url.searchParams.set('limit', '20');
        if (afterCursor) url.searchParams.set('cursor', afterCursor);
        const res = await fetch(url.toString(), { credentials: 'same-origin' });
        if (!res.ok) {
          setError('Could not load notifications');
          return;
        }
        const json = (await res.json()) as FeedResponse;
        setItems((prev) => (replace ? json.notifications : [...prev, ...json.notifications]));
        setCursor(json.nextCursor);
        setUnreadCount(json.unreadCount);
      } catch {
        setError('Could not load notifications');
      } finally {
        setLoading(false);
        setInitialLoaded(true);
      }
    },
    [],
  );

  useEffect(() => {
    void load(null, true);
  }, [load]);

  const markAllRead = async () => {
    setMarking(true);
    try {
      await fetch('/api/master/notifications/mark-all-read', {
        method: 'POST',
        credentials: 'same-origin',
      });
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600" aria-live="polite">
          {unreadCount > 0
            ? `${unreadCount} unread`
            : initialLoaded
              ? "You're all caught up."
              : 'Loading…'}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={unreadCount === 0 || marking}
          onClick={markAllRead}
        >
          Mark all read
        </Button>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {initialLoaded && items.length === 0 && !error && (
        <div className="rounded border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No notifications yet.
        </div>
      )}

      {items.length > 0 && (
        <ul className="overflow-hidden rounded border border-gray-200 bg-white">
          {items.map((n) => (
            <li key={n.id} className="border-b last:border-b-0">
              <NotificationItem notification={n} />
            </li>
          ))}
        </ul>
      )}

      {cursor && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => void load(cursor)}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
