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
  Play,
  Pause,
  MoreVertical,
  Star,
  StarOff,
  Download,
  Trash2,
  Clock,
  User,
  AlertTriangle,
  Lock,
  CheckCircle,
  ExternalLink,
  StickyNote,
} from 'lucide-react';
import type { ReaderLibraryEntryDetailed } from '@/lib/types/marketplace';

interface ReaderScriptCardProps {
  entry: ReaderLibraryEntryDetailed;
  onPlay?: () => void;
  onPause?: () => void;
  onFavorite?: () => void;
  onDownload?: () => void;
  onRemove?: () => void;
  onUnlock?: () => void;
  onAddNote?: () => void;
  isPlaying?: boolean;
}

export function ReaderScriptCard({
  entry,
  onPlay,
  onPause,
  onFavorite,
  onDownload,
  onRemove,
  onUnlock,
  onAddNote,
  isPlaying = false,
}: ReaderScriptCardProps) {
  const isArchived = entry.status === 'archived';
  const isActive = entry.status === 'active';

  // Calculate playback progress
  const duration = entry.duration_seconds || 0;
  const position = entry.play_position_seconds || 0;
  const progress = duration > 0 ? (position / duration) * 100 : 0;

  // Format time
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Card className={`group hover:shadow-md transition-shadow ${isArchived ? 'opacity-75' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Thumbnail / Play Button */}
          <div className="relative flex-shrink-0">
            <div
              className={`w-16 h-16 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                isArchived
                  ? 'bg-slate-200 dark:bg-slate-800'
                  : isPlaying
                  ? 'bg-violet-100 dark:bg-violet-900'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-violet-900/50'
              }`}
              onClick={isArchived ? onUnlock : isPlaying ? onPause : onPlay}
            >
              {isArchived ? (
                <Lock className="w-6 h-6 text-slate-400" />
              ) : isPlaying ? (
                <Pause className="w-6 h-6 text-violet-600" />
              ) : (
                <Play className="w-6 h-6 text-slate-600 dark:text-slate-400" />
              )}
            </div>
            {entry.is_favorited && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center">
                <Star className="w-3 h-3 text-white fill-white" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-medium truncate">{entry.script_name}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                  <User className="w-3 h-3" />
                  <span>{entry.writer_name}</span>
                  <span>•</span>
                  <span>{entry.page_count} pages</span>
                </div>
              </div>

              {/* Status Badges */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {isArchived && (
                  <Badge variant="secondary" className="text-xs">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Archived
                  </Badge>
                )}
                {entry.completed && (
                  <Badge variant="outline" className="text-xs text-green-600">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Finished
                  </Badge>
                )}
                {entry.source === 'purchased' && (
                  <Badge variant="default" className="text-xs">
                    <Download className="w-3 h-3 mr-1" />
                    Owned
                  </Badge>
                )}
              </div>
            </div>

            {/* Progress Bar (if started listening) */}
            {position > 0 && duration > 0 && !isArchived && (
              <div className="mt-3 space-y-1">
                <Progress value={progress} className="h-1.5" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatTime(position)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            )}

            {/* Archived Message */}
            {isArchived && (
              <div className="mt-3 p-2 rounded bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Writer's subscription ended. Unlock for $5 or wait for them to resubscribe.
                </p>
              </div>
            )}

            {/* Notes Preview */}
            {entry.notes && (
              <div className="mt-2 p-2 rounded bg-slate-50 dark:bg-slate-900 text-xs text-muted-foreground flex items-start gap-2">
                <StickyNote className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span className="line-clamp-2">{entry.notes}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {isArchived ? (
              <Button size="sm" onClick={onUnlock}>
                Unlock $5
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onFavorite}
                >
                  {entry.is_favorited ? (
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  ) : (
                    <StarOff className="w-4 h-4" />
                  )}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onPlay}>
                      <Play className="w-4 h-4 mr-2" />
                      {position > 0 ? 'Resume' : 'Play'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onAddNote}>
                      <StickyNote className="w-4 h-4 mr-2" />
                      {entry.notes ? 'Edit Notes' : 'Add Notes'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDownload}>
                      <Download className="w-4 h-4 mr-2" />
                      Download ($25)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onRemove}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove from Library
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact card for list views
export function ReaderScriptCardCompact({
  entry,
  onPlay,
}: {
  entry: ReaderLibraryEntryDetailed;
  onPlay?: () => void;
}) {
  const isArchived = entry.status === 'archived';
  const progress = entry.duration_seconds
    ? (entry.play_position_seconds / entry.duration_seconds) * 100
    : 0;

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer ${
        isArchived ? 'opacity-60' : ''
      }`}
      onClick={isArchived ? undefined : onPlay}
    >
      <div
        className={`w-10 h-10 rounded flex items-center justify-center flex-shrink-0 ${
          isArchived
            ? 'bg-slate-200 dark:bg-slate-800'
            : 'bg-violet-100 dark:bg-violet-900'
        }`}
      >
        {isArchived ? (
          <Lock className="w-4 h-4 text-slate-400" />
        ) : (
          <Play className="w-4 h-4 text-violet-600" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{entry.script_name}</p>
        <p className="text-xs text-muted-foreground">by {entry.writer_name}</p>
      </div>
      {progress > 0 && progress < 100 && (
        <div className="w-16">
          <Progress value={progress} className="h-1" />
        </div>
      )}
      {entry.is_favorited && (
        <Star className="w-4 h-4 text-amber-500 fill-amber-500 flex-shrink-0" />
      )}
    </div>
  );
}
