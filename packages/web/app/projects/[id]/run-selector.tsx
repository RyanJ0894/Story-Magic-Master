'use client';

/**
 * RunSelector - Dropdown for switching between runs
 *
 * Shows current run with quick access to recent runs.
 * Supports viewing past runs and starting new runs.
 */

import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown,
  Sparkles,
  Zap,
  Sliders,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Plus,
  History,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export interface Run {
  id: string;
  run_number: number;
  workflow_mode: 'automatic' | 'fine_tuned';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
  has_audio: boolean;
}

interface RunSelectorProps {
  runs: Run[];
  currentRunNumber: number | null;
  onSelectRun: (runNumber: number | null) => void;
  onStartNewRun: () => void;
  onViewHistory: () => void;
}

const statusConfig = {
  queued: { icon: Clock, label: 'Queued', className: 'text-slate-500' },
  processing: { icon: Loader2, label: 'Processing', className: 'text-violet-500' },
  completed: { icon: CheckCircle, label: 'Completed', className: 'text-green-500' },
  failed: { icon: XCircle, label: 'Failed', className: 'text-red-500' },
};

const modeConfig = {
  automatic: { icon: Zap, label: 'Auto', className: 'text-amber-500' },
  fine_tuned: { icon: Sliders, label: 'Fine-Tuned', className: 'text-violet-500' },
};

export function RunSelector({
  runs,
  currentRunNumber,
  onSelectRun,
  onStartNewRun,
  onViewHistory,
}: RunSelectorProps) {
  const [open, setOpen] = useState(false);

  const currentRun = runs.find(r => r.run_number === currentRunNumber);
  const recentRuns = runs.slice(0, 5); // Show last 5 runs
  const hasMoreRuns = runs.length > 5;

  const nextRunNumber = runs.length > 0 ? Math.max(...runs.map(r => r.run_number)) + 1 : 1;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="w-4 h-4" />
          {currentRun ? (
            <>
              <span>Run #{currentRun.run_number}</span>
              <Badge
                variant="secondary"
                className={cn('text-xs px-1.5', modeConfig[currentRun.workflow_mode].className)}
              >
                {modeConfig[currentRun.workflow_mode].label}
              </Badge>
            </>
          ) : (
            <span>New Run #{nextRunNumber}</span>
          )}
          <ChevronDown className="w-4 h-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Runs</span>
          <span className="text-xs font-normal text-muted-foreground">
            {runs.length} total
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* New Run Option */}
        <DropdownMenuItem
          onClick={() => {
            onStartNewRun();
            setOpen(false);
          }}
          className="gap-3 py-3"
        >
          <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <Plus className="w-4 h-4 text-violet-500" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Start New Run</p>
            <p className="text-xs text-muted-foreground">Run #{nextRunNumber}</p>
          </div>
        </DropdownMenuItem>

        {recentRuns.length > 0 && <DropdownMenuSeparator />}

        {/* Recent Runs */}
        {recentRuns.map((run) => {
          const StatusIcon = statusConfig[run.status].icon;
          const ModeIcon = modeConfig[run.workflow_mode].icon;
          const isActive = run.run_number === currentRunNumber;

          return (
            <DropdownMenuItem
              key={run.id}
              onClick={() => {
                onSelectRun(run.run_number);
                setOpen(false);
              }}
              className={cn(
                'gap-3 py-3',
                isActive && 'bg-violet-50 dark:bg-violet-900/20'
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center',
                run.status === 'completed' && 'bg-green-100 dark:bg-green-900/30',
                run.status === 'failed' && 'bg-red-100 dark:bg-red-900/30',
                run.status === 'processing' && 'bg-violet-100 dark:bg-violet-900/30',
                run.status === 'queued' && 'bg-slate-100 dark:bg-slate-800',
              )}>
                <StatusIcon className={cn(
                  'w-4 h-4',
                  statusConfig[run.status].className,
                  run.status === 'processing' && 'animate-spin'
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Run #{run.run_number}</span>
                  <ModeIcon className={cn('w-3 h-3', modeConfig[run.workflow_mode].className)} />
                  {isActive && (
                    <Badge variant="secondary" className="text-xs px-1">
                      Viewing
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                  {run.status === 'completed' && run.has_audio && ' • Has audio'}
                </p>
              </div>
              {run.status === 'completed' && run.has_audio && (
                <Play className="w-4 h-4 text-muted-foreground" />
              )}
            </DropdownMenuItem>
          );
        })}

        {/* View All History */}
        {(hasMoreRuns || runs.length > 0) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                onViewHistory();
                setOpen(false);
              }}
              className="gap-3 py-2 text-muted-foreground"
            >
              <History className="w-4 h-4" />
              <span>View all {runs.length} runs</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default RunSelector;
