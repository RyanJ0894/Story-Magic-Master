'use client';

import { useState, useEffect, useCallback } from 'react';
import { log } from '@/lib/logger';
import { apiFetch } from '@/lib/api/fetch';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  ArrowLeft,
  Sparkles,
  CheckCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

const alertTypeLabels: Record<string, string> = {
  team_invite: 'Team Invite',
  script_shared: 'Script Shared',
  script_status_changed: 'Status Change',
  script_comment: 'Comment',
  team_member_joined: 'Member Joined',
  team_member_left: 'Member Left',
  generation_complete: 'Generation Complete',
  generation_failed: 'Generation Failed',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAlertLink(alert: Alert): string {
  switch (alert.alert_type) {
    case 'team_invite':
      return '/teams';
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
}

function getStatusIcon(alert: Alert) {
  if (alert.alert_type === 'script_status_changed') {
    const status = alert.metadata?.new_status as string;
    if (status === 'like') return ThumbsUp;
    if (status === 'pass') return ThumbsDown;
    return HelpCircle;
  }
  return alertIcons[alert.alert_type] || Bell;
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await apiFetch('/api/alerts?limit=100');
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

  useEffect(() => {
    fetchAlerts();
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
    setMarkingAll(true);
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
    } finally {
      setMarkingAll(false);
    }
  };

  // Derive filtered lists
  const filteredAlerts = alerts.filter((alert) => {
    if (activeTab === 'unread') return !alert.is_read;
    if (activeTab === 'all') return true;
    return alert.alert_type === activeTab;
  });

  // Collect unique alert types for filter tabs
  const alertTypes = Array.from(new Set(alerts.map((a) => a.alert_type)));

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg brand-gradient-br flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h1 className="font-semibold text-foreground">Notifications</h1>
            </div>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-auto bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                {unreadCount} unread
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Actions Bar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {alerts.length} notification{alerts.length !== 1 ? 's' : ''}
          </p>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              disabled={markingAll}
            >
              {markingAll ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCheck className="w-4 h-4 mr-2" />
              )}
              Mark all as read
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">
              Unread
              {unreadCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                  {unreadCount}
                </span>
              )}
            </TabsTrigger>
            {alertTypes.map((type) => (
              <TabsTrigger key={type} value={type} className="hidden sm:inline-flex">
                {alertTypeLabels[type] || type}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* We render all tab content via the same filtered list */}
          <TabsContent value={activeTab} className="mt-4">
            {loading ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-4">Loading notifications...</p>
                </CardContent>
              </Card>
            ) : filteredAlerts.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    {activeTab === 'unread' ? 'All caught up' : 'No notifications'}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {activeTab === 'unread'
                      ? 'You have no unread notifications.'
                      : 'Notifications will appear here when there is activity on your projects and teams.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {activeTab === 'all'
                      ? 'All Notifications'
                      : activeTab === 'unread'
                        ? 'Unread Notifications'
                        : alertTypeLabels[activeTab] || activeTab}
                  </CardTitle>
                  <CardDescription>
                    {filteredAlerts.length} notification{filteredAlerts.length !== 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {filteredAlerts.map((alert) => {
                      const Icon = getStatusIcon(alert);
                      const link = getAlertLink(alert);

                      return (
                        <div
                          key={alert.id}
                          className={cn(
                            'flex items-start gap-4 p-4 transition-colors hover:bg-accent/50',
                            !alert.is_read && 'bg-violet-50/50 dark:bg-violet-900/10'
                          )}
                        >
                          {/* Icon */}
                          <div
                            className={cn(
                              'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                              !alert.is_read
                                ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400'
                                : 'bg-muted text-muted-foreground'
                            )}
                          >
                            <Icon className="w-5 h-5" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <Link href={link} className="block group">
                              <p
                                className={cn(
                                  'text-sm group-hover:underline',
                                  !alert.is_read
                                    ? 'font-medium text-foreground'
                                    : 'text-muted-foreground'
                                )}
                              >
                                {alert.title}
                              </p>
                            </Link>
                            {alert.message && (
                              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                                {alert.message}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(alert.created_at), {
                                  addSuffix: true,
                                })}
                              </span>
                              {alert.projects && (
                                <Badge variant="outline" className="text-xs py-0">
                                  {alert.projects.name}
                                </Badge>
                              )}
                              {alert.teams && (
                                <Badge variant="outline" className="text-xs py-0">
                                  {alert.teams.name}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {!alert.is_read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-violet-600"
                                onClick={() => markAsRead([alert.id])}
                                title="Mark as read"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                            )}
                            {!alert.is_read && (
                              <div className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
