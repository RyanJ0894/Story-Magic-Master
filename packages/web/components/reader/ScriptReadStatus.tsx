'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api/fetch';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ThumbsUp, ThumbsDown, HelpCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ReadStatus = 'like' | 'pass' | 'undecided';

interface ScriptReadStatusProps {
  entryId: string;
  currentStatus: ReadStatus;
  onStatusChange?: (newStatus: ReadStatus) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ScriptReadStatus({
  entryId,
  currentStatus,
  onStatusChange,
  size = 'md',
  className,
}: ScriptReadStatusProps) {
  const [status, setStatus] = useState<ReadStatus>(currentStatus);
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async (newStatus: ReadStatus) => {
    if (newStatus === status || loading) return;

    setLoading(true);

    try {
      const res = await apiFetch(`/api/reader/library/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readStatus: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      setStatus(newStatus);
      onStatusChange?.(newStatus);
    } catch (error) {
      console.error('Failed to update read status:', error);
    } finally {
      setLoading(false);
    }
  };

  const sizeConfig = {
    sm: {
      button: 'h-8 px-2',
      icon: 'w-3.5 h-3.5',
      text: 'text-xs',
    },
    md: {
      button: 'h-9 px-3',
      icon: 'w-4 h-4',
      text: 'text-sm',
    },
    lg: {
      button: 'h-10 px-4',
      icon: 'w-5 h-5',
      text: 'text-base',
    },
  };

  const config = sizeConfig[size];

  return (
    <TooltipProvider>
      <div className={cn('flex items-center gap-1', className)}>
        {/* Like Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={status === 'like' ? 'default' : 'outline'}
              size="sm"
              className={cn(
                config.button,
                status === 'like' &&
                  'bg-green-600 hover:bg-green-700 text-white border-green-600',
                status !== 'like' &&
                  'hover:bg-green-50 hover:text-green-600 hover:border-green-300 dark:hover:bg-green-900/20'
              )}
              onClick={() => handleStatusChange('like')}
              disabled={loading}
            >
              {loading && status !== 'like' ? (
                <Loader2 className={cn(config.icon, 'animate-spin')} />
              ) : (
                <ThumbsUp className={config.icon} />
              )}
              <span className={cn('ml-1.5', config.text)}>Like</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Mark as interested - positive signal to the writer</p>
          </TooltipContent>
        </Tooltip>

        {/* Pass Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={status === 'pass' ? 'default' : 'outline'}
              size="sm"
              className={cn(
                config.button,
                status === 'pass' &&
                  'bg-red-600 hover:bg-red-700 text-white border-red-600',
                status !== 'pass' &&
                  'hover:bg-red-50 hover:text-red-600 hover:border-red-300 dark:hover:bg-red-900/20'
              )}
              onClick={() => handleStatusChange('pass')}
              disabled={loading}
            >
              {loading && status !== 'pass' ? (
                <Loader2 className={cn(config.icon, 'animate-spin')} />
              ) : (
                <ThumbsDown className={config.icon} />
              )}
              <span className={cn('ml-1.5', config.text)}>Pass</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Not for you - the writer will be notified</p>
          </TooltipContent>
        </Tooltip>

        {/* Undecided Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={status === 'undecided' ? 'default' : 'outline'}
              size="sm"
              className={cn(
                config.button,
                status === 'undecided' &&
                  'bg-amber-500 hover:bg-amber-600 text-white border-amber-500',
                status !== 'undecided' &&
                  'hover:bg-amber-50 hover:text-amber-600 hover:border-amber-300 dark:hover:bg-amber-900/20'
              )}
              onClick={() => handleStatusChange('undecided')}
              disabled={loading}
            >
              {loading && status !== 'undecided' ? (
                <Loader2 className={cn(config.icon, 'animate-spin')} />
              ) : (
                <HelpCircle className={config.icon} />
              )}
              <span className={cn('ml-1.5', config.text)}>Undecided</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Still reviewing - need more time to decide</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

// Compact version for table rows
export function ScriptReadStatusCompact({
  entryId,
  currentStatus,
  onStatusChange,
}: {
  entryId: string;
  currentStatus: ReadStatus;
  onStatusChange?: (newStatus: ReadStatus) => void;
}) {
  const [status, setStatus] = useState<ReadStatus>(currentStatus);
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async (newStatus: ReadStatus) => {
    if (newStatus === status || loading) return;

    setLoading(true);

    try {
      const res = await apiFetch(`/api/reader/library/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readStatus: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      setStatus(newStatus);
      onStatusChange?.(newStatus);
    } catch (error) {
      console.error('Failed to update read status:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={cn(
                'p-1.5 rounded-md transition-colors',
                status === 'like'
                  ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                  : 'text-muted-foreground hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
              )}
              onClick={() => handleStatusChange('like')}
              disabled={loading}
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Like</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={cn(
                'p-1.5 rounded-md transition-colors',
                status === 'pass'
                  ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                  : 'text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
              )}
              onClick={() => handleStatusChange('pass')}
              disabled={loading}
            >
              <ThumbsDown className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Pass</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={cn(
                'p-1.5 rounded-md transition-colors',
                status === 'undecided'
                  ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'
              )}
              onClick={() => handleStatusChange('undecided')}
              disabled={loading}
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Undecided</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

// Badge display for status
export function ReadStatusBadge({ status }: { status: ReadStatus }) {
  const config = {
    like: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-700 dark:text-green-300',
      icon: ThumbsUp,
      label: 'Liked',
    },
    pass: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-700 dark:text-red-300',
      icon: ThumbsDown,
      label: 'Passed',
    },
    undecided: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-300',
      icon: HelpCircle,
      label: 'Undecided',
    },
  };

  const { bg, text, icon: Icon, label } = config[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        bg,
        text
      )}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

export default ScriptReadStatus;
