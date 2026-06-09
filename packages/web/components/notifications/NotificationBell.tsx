/**
 * Bell-icon notification trigger for the master-account feed (#174 PR γ).
 *
 * Polls /api/master/notifications/unread-count every 30 seconds for the
 * badge. Clicking opens a dropdown showing the most recent items + a
 * "Mark all read" action + a link to the full feed at /dashboard/notifications.
 *
 * Polling cadence per Ryan (2026-06-09): 30s. Upgrade to SSE only if
 * dashboard staleness becomes a real complaint.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationDropdownContent } from './NotificationDropdownContent';

/** Ryan-approved cadence; centralized so it shows up in one diff if we change it. */
const POLL_INTERVAL_MS = 30_000;

interface Props {
  /** Optional className for positioning inside any page's header. */
  className?: string;
}

export function NotificationBell({ className }: Props) {
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch('/api/master/notifications/unread-count', {
        credentials: 'same-origin',
      });
      if (!res.ok) return;
      const json = (await res.json()) as { count: number };
      setUnreadCount(typeof json.count === 'number' ? json.count : 0);
    } catch {
      // Polling is best-effort; swallow transient failures
    }
  }, []);

  // Initial fetch + every POLL_INTERVAL_MS.
  useEffect(() => {
    void refreshCount();
    const id = setInterval(refreshCount, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refreshCount]);

  // Refresh immediately when the dropdown closes so the badge reflects any
  // bulk-mark-read the user performed while it was open.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) void refreshCount();
  };

  const showBadge = unreadCount !== null && unreadCount > 0;
  const badgeLabel = unreadCount && unreadCount > 99 ? '99+' : String(unreadCount ?? 0);

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            showBadge ? `Notifications — ${badgeLabel} unread` : 'Notifications'
          }
          className={`relative h-10 w-10 ${className ?? ''}`}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {showBadge && (
            <span
              className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white"
              aria-hidden="true"
            >
              {badgeLabel}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <NotificationDropdownContent
          onMarkedAllRead={() => {
            setUnreadCount(0);
          }}
        />
        <div className="border-t p-2 text-center">
          <Link
            href="/dashboard/notifications"
            className="text-sm text-blue-600 hover:underline"
            onClick={() => setOpen(false)}
          >
            See all notifications
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
