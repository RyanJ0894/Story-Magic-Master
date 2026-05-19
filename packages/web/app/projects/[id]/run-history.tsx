'use client';

/**
 * RunHistory - Full run history with comparison tools
 *
 * Shows all runs for a project with:
 * - Status, mode, timestamp for each run
 * - Quick play buttons for completed runs
 * - A/B comparison selection
 * - Settings reuse option
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  History,
  ChevronDown,
  Zap,
  Sliders,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Play,
  Pause,
  GitCompare,
  Copy,
  Volume2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import type { Run } from './run-selector';
import { resolveAudioUrl } from '@/lib/resolve-audio-url';

interface AudioOutput {
  id: string;
  fileName: string;
  filePath: string;
  durationSeconds?: number;
}

interface RunWithAudio extends Run {
  audioOutputs?: AudioOutput[];
  error?: string;
}

interface RunHistoryProps {
  runs: RunWithAudio[];
  currentRunNumber: number | null;
  onSelectRun: (runNumber: number) => void;
  onCompareRuns: (runA: number, runB: number) => void;
  onCopySettings: (runNumber: number) => void;
}

const statusConfig = {
  queued: { icon: Clock, label: 'Queued', color: 'bg-muted text-muted-foreground' },
  processing: { icon: Loader2, label: 'Processing', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  completed: { icon: CheckCircle, label: 'Completed', color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
  failed: { icon: XCircle, label: 'Failed', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
};

const modeConfig = {
  automatic: { icon: Zap, label: 'Automatic', color: 'text-amber-500' },
  fine_tuned: { icon: Sliders, label: 'Fine-Tuned', color: 'text-blue-500' },
};

function MiniAudioPlayer({ src, duration }: { src: string; duration?: number }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio] = useState(() => typeof window !== 'undefined' ? new Audio(src) : null);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Handle audio end
  if (audio) {
    audio.onended = () => setIsPlaying(false);
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={togglePlay}
      className="gap-1.5 h-7 px-2"
    >
      {isPlaying ? (
        <Pause className="w-3 h-3" />
      ) : (
        <Play className="w-3 h-3" />
      )}
      <span className="text-xs">{formatDuration(duration)}</span>
    </Button>
  );
}

export function RunHistory({
  runs,
  currentRunNumber,
  onSelectRun,
  onCompareRuns,
  onCopySettings,
}: RunHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<number[]>([]);

  const completedRuns = runs.filter(r => r.status === 'completed' && r.hasAudio);
  const canCompare = completedRuns.length >= 2;

  const handleCompareToggle = (runNumber: number) => {
    setSelectedForCompare(prev => {
      if (prev.includes(runNumber)) {
        return prev.filter(n => n !== runNumber);
      }
      // Max 2 runs for comparison
      if (prev.length >= 2) {
        return [prev[1], runNumber];
      }
      return [...prev, runNumber];
    });
  };

  const handleStartCompare = () => {
    if (selectedForCompare.length === 2) {
      onCompareRuns(selectedForCompare[0], selectedForCompare[1]);
    }
  };

  if (runs.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Run History
                <Badge variant="secondary" className="ml-2">
                  {runs.length} run{runs.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              <ChevronDown className={cn(
                'w-4 h-4 text-muted-foreground transition-transform',
                isOpen && 'rotate-180'
              )} />
            </CardTitle>
            <CardDescription>
              View and compare previous generation attempts
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Compare Mode Toggle */}
            {canCompare && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Compare Mode</span>
                </div>
                <div className="flex items-center gap-2">
                  {compareMode && selectedForCompare.length === 2 && (
                    <Button size="sm" onClick={handleStartCompare}>
                      Compare Selected
                    </Button>
                  )}
                  <Button
                    variant={compareMode ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setCompareMode(!compareMode);
                      setSelectedForCompare([]);
                    }}
                  >
                    {compareMode ? 'Cancel' : 'Select Runs'}
                  </Button>
                </div>
              </div>
            )}

            {/* Compare Selection Hint */}
            {compareMode && (
              <p className="text-sm text-muted-foreground text-center">
                Select 2 completed runs to compare side-by-side
                {selectedForCompare.length > 0 && (
                  <span className="font-medium"> ({selectedForCompare.length}/2 selected)</span>
                )}
              </p>
            )}

            {/* Runs List */}
            <div className="space-y-2">
              {runs.map((run) => {
                const StatusIcon = statusConfig[run.status].icon;
                const ModeIcon = modeConfig[run.workflowMode].icon;
                const isActive = run.runNumber === currentRunNumber;
                const isSelected = selectedForCompare.includes(run.runNumber);
                const canSelect = compareMode && run.status === 'completed' && run.hasAudio;

                return (
                  <div
                    key={run.id}
                    onClick={() => !compareMode && onSelectRun(run.runNumber)}
                    className={cn(
                      'flex items-center gap-4 p-3 rounded-lg border transition-all',
                      !compareMode && 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-700',
                      isActive && !compareMode && 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10',
                      isSelected && 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
                    )}
                  >
                    {/* Compare Checkbox */}
                    {compareMode && (
                      <Checkbox
                        checked={isSelected}
                        disabled={!canSelect}
                        onCheckedChange={() => canSelect && handleCompareToggle(run.runNumber)}
                        className="data-[state=checked]:bg-blue-500"
                      />
                    )}

                    {/* Status Icon */}
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                      statusConfig[run.status].color
                    )}>
                      <StatusIcon className={cn(
                        'w-5 h-5',
                        run.status === 'processing' && 'animate-spin'
                      )} />
                    </div>

                    {/* Run Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">Run #{run.runNumber}</span>
                        <Badge variant="outline" className={cn('gap-1', modeConfig[run.workflowMode].color)}>
                          <ModeIcon className="w-3 h-3" />
                          {modeConfig[run.workflowMode].label}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {statusConfig[run.status].label}
                        </Badge>
                        {isActive && !compareMode && (
                          <Badge className="bg-blue-500 text-xs">Current</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {format(new Date(run.createdAt), 'MMM d, yyyy h:mm a')}
                        <span className="mx-1">•</span>
                        {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                      </p>
                      {run.status === 'failed' && run.error && (
                        <p className="text-sm text-red-600 dark:text-red-400 mt-1 truncate">
                          Error: {run.error}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Audio Player */}
                      {run.status === 'completed' && run.audioOutputs && run.audioOutputs.length > 0 && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded">
                          <Volume2 className="w-3 h-3 text-muted-foreground" />
                          <MiniAudioPlayer
                            src={resolveAudioUrl(run.audioOutputs[0].filePath)}
                            duration={run.audioOutputs[0].durationSeconds}
                          />
                        </div>
                      )}

                      {/* Copy Settings */}
                      {run.status === 'completed' && run.workflowMode === 'fine_tuned' && !compareMode && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCopySettings(run.runNumber);
                          }}
                          title="Use these settings for a new run"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Empty state for completed runs in compare mode */}
            {compareMode && completedRuns.length < 2 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                You need at least 2 completed runs to compare.
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default RunHistory;
