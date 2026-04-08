'use client';

import { useState, useEffect, useCallback } from 'react';
import { log } from '@/lib/logger';
import { apiFetch } from '@/lib/api/fetch';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell,
  Users,
  FileText,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  MessageSquare,
  UserPlus,
  UserMinus,
  Check,
  Volume2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface Alert {
  id: string;
  alert_type: string;
  title: string;
  message?: string;
  project_id?: string;
  team_id?: string;
  metadata?: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
  projects?: { id: string; name: string };
  teams?: { id: string; name: string };
  related_user?: { full_name: string; avatar_url?: string };
}

const alertIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  team_invite: Users,
  script_shared: FileText,
  script_status_changed: ThumbsUp,
  script_comment: MessageSquare,
  team_member_joined: UserPlus,
  team_member_left: UserMinus,
  generation_complete: Volume2,
  generation_failed: AlertTriangle,
};

export function AlertsDropdown() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await apiFetch('/api/alerts?limit=20');
      if (!res.ok) return;

      const data = await res.json();
      setAlerts(data.alerts || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      log.error('Failed to fetch alerts', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch alerts on mount and periodically
  useEffect(() => {
    fetchAlerts();

    // Poll for new alerts every 30 seconds
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const markAsRead = async (alertIds: string[]) => {
    try {
      await apiFetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertIds }),
      });

      setAlerts((prev) =>
        prev.map((alert) =>
          alertIds.includes(alert.id) ? { ...alert, is_read: true } : alert
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - alertIds.length));
    } catch (error) {
      log.error('Failed to mark alerts as read', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiFetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });

      setAlerts((prev) => prev.map((alert) => ({ ...alert, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      log.error('Failed to mark all as read', error);
    }
  };

  const getAlertLink = (alert: Alert): string => {
    switch (alert.alert_type) {
      case 'team_invite':
        return `/teams`;
      case 'script_shared':
      case 'script_status_changed':
      case 'generation_complete':
      case 'generation_failed':
        return alert.project_id ? `/projects/${alert.project_id}` : '/dashboard';
      case 'team_member_joined':
      case 'team_member_left':
        return alert.team_id ? `/teams/${alert.team_id}` : '/teams';
      default:
        return '/dashboard';
    }
  };

  const getStatusIcon = (alert: Alert) => {
    if (alert.alert_type === 'script_status_changed') {
      const status = alert.metadata?.new_status as string;
      if (status === 'like') return ThumbsUp;
      if (status === 'pass') return ThumbsDown;
      return HelpCircle;
    }
    return alertIcons[alert.alert_type] || Bell;
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative" aria-label="View notifications">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 px-2 text-xs text-blue-600 hover:text-blue-700"
              onClick={(e) => {
                e.preventDefault();
                markAllAsRead();
              }}
            >
              <Check className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {loading ? (
          <div className="py-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            {alerts.map((alert) => {
              const Icon = getStatusIcon(alert);
              const link = getAlertLink(alert);

              return (
                <DropdownMenuItem
                  key={alert.id}
                  asChild
                  className={cn(
                    'cursor-pointer p-3 focus:bg-accent',
                    !alert.is_read && 'bg-blue-50/50 dark:bg-blue-900/10'
                  )}
                >
                  <Link
                    href={link}
                    onClick={() => {
                      if (!alert.is_read) {
                        markAsRead([alert.id]);
                      }
                      setOpen(false);
                    }}
                  >
                    <div className="flex gap-3 w-full">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                          !alert.is_read
                            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm line-clamp-2',
                            !alert.is_read
                              ? 'font-medium text-foreground'
                              : 'text-muted-foreground'
                          )}
                        >
                          {alert.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(alert.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      {!alert.is_read && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                      )}
                    </div>
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </ScrollArea>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="justify-center text-blue-600 cursor-pointer">
          <Link href="/alerts" onClick={() => setOpen(false)}>
            View all notifications
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default AlertsDropdown;
