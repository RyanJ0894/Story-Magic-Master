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
  runNumber: number;
  workflowMode: 'automatic' | 'fine_tuned';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  hasAudio: boolean;
}

interface RunSelectorProps {
  runs: Run[];
  currentRunNumber: number | null;
  onSelectRun: (runNumber: number | null) => void;
  onStartNewRun: () => void;
  onViewHistory: () => void;
}

const statusConfig = {
  queued: { icon: Clock, label: 'Queued', className: 'text-muted-foreground' },
  processing: { icon: Loader2, label: 'Processing', className: 'text-blue-500' },
  completed: { icon: CheckCircle, label: 'Completed', className: 'text-green-500' },
  failed: { icon: XCircle, label: 'Failed', className: 'text-red-500' },
};

const modeConfig = {
  automatic: { icon: Zap, label: 'Auto', className: 'text-amber-500' },
  fine_tuned: { icon: Sliders, label: 'Fine-Tuned', className: 'text-blue-500' },
};

export function RunSelector({
  runs,
  currentRunNumber,
  onSelectRun,
  onStartNewRun,
  onViewHistory,
}: RunSelectorProps) {
  const [open, setOpen] = useState(false);

  const currentRun = runs.find(r => r.runNumber === currentRunNumber);
  const recentRuns = runs.slice(0, 5); // Show last 5 runs
  const hasMoreRuns = runs.length > 5;

  const nextRunNumber = runs.length > 0 ? Math.max(...runs.map(r => r.runNumber)) + 1 : 1;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="w-4 h-4" />
          {currentRun ? (
            <>
              <span>Run #{currentRun.runNumber}</span>
              <Badge
                variant="secondary"
                className={cn('text-xs px-1.5', modeConfig[currentRun.workflowMode].className)}
              >
                {modeConfig[currentRun.workflowMode].label}
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
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Plus className="w-4 h-4 text-blue-500" />
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
          const ModeIcon = modeConfig[run.workflowMode].icon;
          const isActive = run.runNumber === currentRunNumber;

          return (
            <DropdownMenuItem
              key={run.id}
              onClick={() => {
                onSelectRun(run.runNumber);
                setOpen(false);
              }}
              className={cn(
                'gap-3 py-3',
                isActive && 'bg-blue-50 dark:bg-blue-900/20'
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center',
                run.status === 'completed' && 'bg-green-100 dark:bg-green-900/30',
                run.status === 'failed' && 'bg-red-100 dark:bg-red-900/30',
                run.status === 'processing' && 'bg-blue-100 dark:bg-blue-900/30',
                run.status === 'queued' && 'bg-muted',
              )}>
                <StatusIcon className={cn(
                  'w-4 h-4',
                  statusConfig[run.status].className,
                  run.status === 'processing' && 'animate-spin'
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Run #{run.runNumber}</span>
                  <ModeIcon className={cn('w-3 h-3', modeConfig[run.workflowMode].className)} />
                  {isActive && (
                    <Badge variant="secondary" className="text-xs px-1">
                      Viewing
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                  {run.status === 'completed' && run.hasAudio && ' • Has audio'}
                </p>
              </div>
              {run.status === 'completed' && run.hasAudio && (
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
