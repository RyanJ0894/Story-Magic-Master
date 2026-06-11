/**
 * Dropdown content for the bell — last 10 items + Mark all read.
 *
 * Loaded lazily when the dropdown opens. We don't poll the full feed at
 * 30s like we do the count; the user has to click the bell to see new
 * items, which keeps DB load low.
 */

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { NotificationItem, type FeedNotification } from './NotificationItem';

interface Props {
  onMarkedAllRead: () => void;
}

export function NotificationDropdownContent({ onMarkedAllRead }: Props) {
  const [items, setItems] = useState<FeedNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/master/notifications?limit=10', {
          credentials: 'same-origin',
        });
        if (!res.ok) {
          if (!cancelled) setError('Could not load notifications');
          return;
        }
        const json = (await res.json()) as { notifications: FeedNotification[] };
        if (!cancelled) setItems(json.notifications);
      } catch {
        if (!cancelled) setError('Could not load notifications');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const markAllRead = async () => {
    setMarking(true);
    try {
      await fetch('/api/master/notifications/mark-all-read', {
        method: 'POST',
        credentials: 'same-origin',
      });
      // Optimistically clear unread flags client-side
      setItems((prev) => prev?.map((n) => ({ ...n, is_read: true })) ?? null);
      onMarkedAllRead();
    } finally {
      setMarking(false);
    }
  };

  const hasUnread = items?.some((n) => !n.is_read) ?? false;

  return (
    <div className="max-h-[480px] overflow-y-auto">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-sm font-semibold">Notifications</h3>
        <Button
          variant="ghost"
          size="sm"
          disabled={!hasUnread || marking}
          onClick={markAllRead}
          className="h-7 text-xs"
        >
          Mark all read
        </Button>
      </div>

      {error && (
        <div className="p-4 text-center text-sm text-red-600" role="alert">
          {error}
        </div>
      )}

      {!error && items === null && (
        <div className="p-4 text-center text-sm text-gray-500">Loading…</div>
      )}

      {!error && items !== null && items.length === 0 && (
        <div className="p-6 text-center text-sm text-gray-500">
          You&apos;re all caught up.
        </div>
      )}

      {!error && items !== null && items.length > 0 && (
        <ul className="divide-y">
          {items.map((n) => (
            <li key={n.id}>
              <NotificationItem notification={n} compact />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
