'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  Share2,
  Play,
  MoreVertical,
  Sparkles,
  Users,
  Eye,
  Download,
  Trash2,
  BarChart3,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { WriterScriptSummary } from '@/lib/types/marketplace';

interface WriterScriptCardProps {
  script: WriterScriptSummary;
  onShare?: () => void;
  onGenerate?: () => void;
  onDelete?: () => void;
  onViewAnalytics?: () => void;
}

const STATUS_CONFIG: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; icon: typeof CheckCircle }> = {
  draft: { variant: 'secondary', label: 'Draft', icon: Clock },
  processing: { variant: 'default', label: 'Processing', icon: Loader2 },
  completed: { variant: 'outline', label: 'Ready', icon: CheckCircle },
  failed: { variant: 'destructive', label: 'Failed', icon: AlertCircle },
};

export function WriterScriptCard({
  script,
  onShare,
  onGenerate,
  onDelete,
  onViewAnalytics,
}: WriterScriptCardProps) {
  const status = STATUS_CONFIG[script.status] || STATUS_CONFIG.draft;
  const StatusIcon = status.icon;
  const hasAudio = script.audio_generated;

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Script Info */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href={`/projects/${script.project_id}`}
                  className="font-medium text-foreground hover:underline truncate"
                >
                  {script.name}
                </Link>
                <Badge variant={status.variant} className="flex-shrink-0">
                  <StatusIcon className={`w-3 h-3 mr-1 ${script.status === 'processing' ? 'animate-spin' : ''}`} />
                  {status.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {script.page_count} pages
                {script.audio_generated && ' • Audio ready'}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {hasAudio ? (
              <>
                <Button variant="outline" size="sm" onClick={onShare}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
                <Link href={`/projects/${script.project_id}`}>
                  <Button variant="ghost" size="sm">
                    <Play className="w-4 h-4 mr-2" />
                    Play
                  </Button>
                </Link>
              </>
            ) : (
              <Button size="sm" onClick={onGenerate} disabled={script.status === 'processing'}>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Audio
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onViewAnalytics}>
                  <BarChart3 className="w-4 h-4 mr-2" />
                  View Analytics
                </DropdownMenuItem>
                {hasAudio && (
                  <DropdownMenuItem>
                    <Download className="w-4 h-4 mr-2" />
                    Download Audio
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Script
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Stats Row */}
        {hasAudio && (script.share_count > 0 || script.total_views > 0) && (
          <div className="mt-4 pt-3 border-t flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span>{script.reader_count} readers</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Share2 className="w-4 h-4" />
              <span>{script.share_count} shares</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              <span>{script.total_views} views</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compact version for list views
export function WriterScriptCardCompact({
  script,
  onShare,
}: {
  script: WriterScriptSummary;
  onShare?: () => void;
}) {
  const status = STATUS_CONFIG[script.status] || STATUS_CONFIG.draft;
  const StatusIcon = status.icon;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <Link
            href={`/projects/${script.project_id}`}
            className="font-medium text-sm hover:underline truncate block"
          >
            {script.name}
          </Link>
          <p className="text-xs text-muted-foreground">
            {script.page_count}p • {script.reader_count} readers
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={status.variant} className="text-xs">
          <StatusIcon className={`w-3 h-3 mr-1 ${script.status === 'processing' ? 'animate-spin' : ''}`} />
          {status.label}
        </Badge>
        {script.audio_generated && (
          <Button variant="ghost" size="sm" onClick={onShare}>
            <Share2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
