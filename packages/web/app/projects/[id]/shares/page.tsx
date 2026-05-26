'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api/fetch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Copy,
  CheckCircle,
  Mail,
  Eye,
  EyeOff,
  Headphones,
  Clock,
  Plus,
  PowerOff,
  Loader2,
  Link2,
  Users,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShareRow {
  id: string;
  shareCode: string;
  shareUrl: string;
  recipientEmail: string | null;
  recipientName: string | null;
  accessLevel: string;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  viewCount: number;
  playCount: number;
  hasListened: boolean;
  lastAccessedAt: string | null;
}

interface ShareDashboardData {
  project: { id: string; name: string };
  shares: ShareRow[];
  summary: {
    total: number;
    listened: number;
    opened: number;
    notOpened: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(share: ShareRow) {
  if (!share.isActive) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Deactivated
      </Badge>
    );
  }
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    return <Badge variant="secondary">Expired</Badge>;
  }
  if (share.hasListened) {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">
        <Headphones className="w-3 h-3 mr-1" />
        Listened
      </Badge>
    );
  }
  if ((share.viewCount ?? 0) > 0) {
    return (
      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-0">
        <Eye className="w-3 h-3 mr-1" />
        Opened
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <Clock className="w-3 h-3 mr-1" />
      Not opened
    </Badge>
  );
}

function relativeDate(date: string | null) {
  if (!date) return '—';
  const d = new Date(date);
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ShareDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;
  const { toast } = useToast();

  const [data, setData] = useState<ShareDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [deactivatingAll, setDeactivatingAll] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/shares`);
      if (!res.ok) {
        setFetchError(true);
        toast({ variant: 'destructive', title: 'Failed to load shares' });
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function deactivateShare(shareId: string) {
    if (!window.confirm('Deactivate this share link? The recipient will no longer be able to access the audio.')) return;
    setDeactivatingId(shareId);
    try {
      const res = await apiFetch(`/api/shares/${shareId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      });
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Failed to deactivate share' });
        return;
      }
      await fetchData();
      toast({ title: 'Share deactivated' });
    } finally {
      setDeactivatingId(null);
    }
  }

  async function deactivateAll() {
    const count = data?.shares.filter((s) => s.isActive).length ?? 0;
    if (!window.confirm(`Deactivate all ${count} active share link${count === 1 ? '' : 's'}? Recipients will immediately lose access to the audio.`)) return;
    setDeactivatingAll(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/shares`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deactivate_all' }),
      });
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Failed to deactivate all shares' });
        return;
      }
      const json = await res.json();
      await fetchData();
      toast({ title: `${json.deactivated} share(s) deactivated` });
    } finally {
      setDeactivatingAll(false);
    }
  }

  async function copyLink(shareUrl: string, shareCode: string) {
    await navigator.clipboard.writeText(shareUrl);
    setCopiedCode(shareCode);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  // ---------------------------------------------------------------------------
  // Render — loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
        <p className="text-sm">Failed to load share data.</p>
        <Button variant="outline" size="sm" onClick={fetchData}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const activeShares = data.shares.filter((s) => s.isActive);

  // ---------------------------------------------------------------------------
  // Render — dashboard
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/projects/${projectId}`)}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to project
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">Share Dashboard</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{data.project.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track who you&apos;ve shared this script with and their engagement
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={deactivateAll}
            disabled={deactivatingAll || activeShares.length === 0}
          >
            {deactivatingAll ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <PowerOff className="w-4 h-4 mr-2" />
            )}
            Deactivate All
          </Button>
          <Button
            size="sm"
            onClick={() => router.push(`/projects/${projectId}`)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Share
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{data.summary.total}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Users className="w-3 h-3" /> Total sent
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-blue-600">{data.summary.opened}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Eye className="w-3 h-3" /> Opened
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-green-600">{data.summary.listened}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Headphones className="w-3 h-3" /> Listened
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-muted-foreground">{data.summary.notOpened}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <EyeOff className="w-3 h-3" /> Not opened
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shares Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Shares</CardTitle>
          <CardDescription>
            {data.shares.length === 0
              ? 'No shares yet. Share this project from the project page.'
              : `${data.shares.length} share${data.shares.length === 1 ? '' : 's'} — ${activeShares.length} active`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.shares.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Link2 className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No shares yet</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => router.push(`/projects/${projectId}`)}
              >
                Create your first share
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Heard</TableHead>
                    <TableHead className="text-right">Plays</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.shares.map((share) => (
                    <TableRow
                      key={share.id}
                      className={!share.isActive ? 'opacity-50' : undefined}
                    >
                      {/* Recipient */}
                      <TableCell>
                        <div className="min-w-0">
                          {share.recipientName ? (
                            <div className="font-medium truncate max-w-[160px]">
                              {share.recipientName}
                            </div>
                          ) : null}
                          {share.recipientEmail ? (
                            <div className="text-xs text-muted-foreground truncate max-w-[160px]">
                              <Mail className="w-3 h-3 inline mr-1" />
                              {share.recipientEmail}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              <Link2 className="w-3 h-3 inline mr-1" />
                              Public link
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Sent date */}
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {relativeDate(share.createdAt)}
                      </TableCell>

                      {/* Status badge */}
                      <TableCell>{statusBadge(share)}</TableCell>

                      {/* Last heard */}
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {relativeDate(share.lastAccessedAt)}
                      </TableCell>

                      {/* Play count */}
                      <TableCell className="text-right text-sm font-medium">
                        {(share.playCount ?? 0) > 0 ? `${share.playCount}×` : '—'}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Copy link"
                            onClick={() => copyLink(share.shareUrl, share.shareCode)}
                          >
                            {copiedCode === share.shareCode ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                          {share.isActive && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              title="Deactivate share"
                              disabled={deactivatingId === share.id}
                              onClick={() => deactivateShare(share.id)}
                            >
                              {deactivatingId === share.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <PowerOff className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
