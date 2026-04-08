'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { log } from '@/lib/logger';
import { apiFetch } from '@/lib/api/fetch';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, Sparkles, RefreshCw, Clock, CheckCircle, XCircle } from 'lucide-react';

interface JobProgress {
  step: string;
  percent: number;
  details?: string;
  updated_at?: string;
  retryAttempt?: number;
}

interface JobStatus {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: JobProgress;
  error?: string;
  started_at?: string;
  completed_at?: string;
}

interface QueuePosition {
  position: number | null;
  estimatedWaitSeconds: number | null;
  jobsAhead: number | null;
}

interface GenerateButtonProps {
  projectId: string;
  pageCount: number;
  status: string;
  label?: string;
  workflowMode?: 'automatic' | 'fine_tuned';
  hasScript?: boolean;
}

const ESTIMATED_DURATION_MS = 120000; // 2 minutes estimated

export default function GenerateButton({
  projectId,
  pageCount,
  status,
  label = 'Generate Audio',
  workflowMode = 'fine_tuned',
  hasScript = true,
}: GenerateButtonProps) {
  const { userId, isSignedIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [queuePosition, setQueuePosition] = useState<QueuePosition | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timerProgress, setTimerProgress] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queuePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const router = useRouter();

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (queuePollRef.current) clearInterval(queuePollRef.current);
    };
  }, []);

  // Poll for queue position
  const pollQueuePosition = useCallback(async (jobId: string) => {
    try {
      const response = await apiFetch(`/api/jobs/${jobId}/position`);
      if (!response.ok) return;
      const data: QueuePosition & { status: string } = await response.json();
      setQueuePosition({
        position: data.position,
        estimatedWaitSeconds: data.estimatedWaitSeconds,
        jobsAhead: data.jobsAhead,
      });

      // Stop polling position once job starts processing
      if (data.status !== 'queued' && queuePollRef.current) {
        clearInterval(queuePollRef.current);
        queuePollRef.current = null;
        setQueuePosition(null);
      }
    } catch (error) {
      log.error('Error polling queue position', error);
    }
  }, []);

  // Poll for job status
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const response = await apiFetch(`/api/jobs/${jobId}`);
      if (!response.ok) {
        log.error('Failed to fetch job status');
        return;
      }
      const data: JobStatus = await response.json();
      setJobStatus(data);

      // Check if job is complete or failed
      if (data.status === 'completed') {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (queuePollRef.current) clearInterval(queuePollRef.current);
        toast.success('Audio generation complete!');
        setLoading(false);
        setCurrentJobId(null);
        setQueuePosition(null);
        router.refresh();
      } else if (data.status === 'failed') {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (queuePollRef.current) clearInterval(queuePollRef.current);
        // data.error may be a JSON string like {"status":"error","message":"..."} — extract the message
        let errorMsg = data.error || 'Unknown error';
        if (typeof errorMsg === 'string' && errorMsg.startsWith('{')) {
          try { errorMsg = JSON.parse(errorMsg).message || errorMsg; } catch { /* keep as-is */ }
        }
        toast.error(`Generation failed: ${errorMsg}`);
        setLoading(false);
        setCurrentJobId(null);
        setQueuePosition(null);
        router.refresh();
      }
    } catch (error) {
      log.error('Error polling job status', error);
    }
  }, [router]);

  // Start timer and polling
  const startTracking = useCallback((jobId: string) => {
    startTimeRef.current = Date.now();
    setElapsedTime(0);
    setTimerProgress(0);
    setCurrentJobId(jobId);

    // Update timer every 100ms for smooth progress
    timerIntervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Date.now() - startTimeRef.current;
        setElapsedTime(elapsed);
        // Timer progress caps at 95% - actual completion comes from job status
        setTimerProgress(Math.min(95, (elapsed / ESTIMATED_DURATION_MS) * 100));
      }
    }, 100);

    // Poll job status every 2 seconds
    pollIntervalRef.current = setInterval(() => {
      pollJobStatus(jobId);
    }, 2000);

    // Poll queue position every 3 seconds (only while queued)
    queuePollRef.current = setInterval(() => {
      pollQueuePosition(jobId);
    }, 3000);

    // Initial polls
    pollJobStatus(jobId);
    pollQueuePosition(jobId);
  }, [pollJobStatus, pollQueuePosition]);

  const handleGenerate = async () => {
    setLoading(true);
    setJobStatus(null);

    if (!isSignedIn || !userId) {
      toast.error('Please sign in');
      router.push('/login');
      setLoading(false);
      return;
    }

    if (!hasScript) {
      toast.error('Please add script text before generating audio.');
      setLoading(false);
      return;
    }

    // Trigger generation via API — the server handles usage checks,
    // project status updates, and job creation
    try {
      const response = await apiFetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          workflowMode,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to start generation');
      }

      const data = await response.json();
      const jobId = data.jobId;

      toast.success('Generation started! You can leave this page - processing will continue.');

      // Start tracking progress
      startTracking(jobId);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start generation';
      toast.error(message);
      log.error('Generation start error', error);
      setLoading(false);
      router.refresh();
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getStepLabel = (step: string) => {
    const labels: Record<string, string> = {
      queued: 'In Queue',
      retrying: 'Retrying',
      initializing: 'Initializing',
      parsing: 'Parsing Script',
      parsing_complete: 'Script Parsed',
      generating_audio: 'Generating Audio',
      mixing: 'Mixing Tracks',
      uploading: 'Uploading',
      finalizing: 'Finalizing',
      done: 'Complete',
      failed: 'Failed',
      cancelled: 'Cancelled',
    };
    return labels[step] || step.replace(/_/g, ' ');
  };

  const formatWaitTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `~${Math.round(seconds / 60)}m`;
    return `~${(seconds / 3600).toFixed(1)}h`;
  };

  const isRegenerate = label.toLowerCase().includes('regenerate') || label.toLowerCase().includes('retry');
  const Icon = isRegenerate ? RefreshCw : Sparkles;

  // Show progress UI when actively tracking
  if (loading && currentJobId) {
    const actualProgress = jobStatus?.progress?.percent || 0;
    // Use the higher of timer progress or actual progress
    const displayProgress = Math.max(timerProgress, actualProgress);
    const isQueued = jobStatus?.status === 'queued';

    return (
      <div className="w-full space-y-4">
        {/* Queue Position (shown when queued) */}
        {isQueued && queuePosition && queuePosition.position !== null && (
          <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center">
                <span className="text-sm font-bold text-amber-800 dark:text-amber-200">
                  #{queuePosition.position}
                </span>
              </div>
              <div>
                <span className="font-medium text-amber-800 dark:text-amber-200">
                  Position in Queue
                </span>
                {queuePosition.jobsAhead !== null && queuePosition.jobsAhead > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {queuePosition.jobsAhead} job{queuePosition.jobsAhead > 1 ? 's' : ''} ahead
                  </p>
                )}
              </div>
            </div>
            {queuePosition.estimatedWaitSeconds !== null && (
              <div className="text-right">
                <span className="text-sm text-amber-600 dark:text-amber-400">Est. wait:</span>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {formatWaitTime(queuePosition.estimatedWaitSeconds)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Progress Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span className="font-medium text-foreground">
              {getStepLabel(jobStatus?.progress?.step || 'initializing')}
            </span>
            {jobStatus?.progress?.retryAttempt && (
              <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">
                Retry #{jobStatus.progress.retryAttempt}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{formatTime(elapsedTime)}</span>
          </div>
        </div>

        {/* Main Progress Bar */}
        <div className="relative">
          <Progress
            value={displayProgress}
            className="h-3 bg-muted"
          />
          <div
            className="absolute top-0 left-0 h-3 bg-blue-500/20 rounded-full transition-all duration-100"
            style={{ width: `${timerProgress}%` }}
          />
        </div>

        {/* Progress Details */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {jobStatus?.progress?.details || 'Processing...'}
          </span>
          <span className="font-medium text-foreground">
            {Math.round(displayProgress)}%
          </span>
        </div>

        {/* Dev Log Panel */}
        <div className="mt-4 p-3 bg-slate-900 rounded-lg text-xs font-mono text-slate-300 max-h-32 overflow-y-auto">
          <div className="text-blue-400 mb-1">// Generation Log (dev mode)</div>
          <div className="text-slate-500">Job ID: {currentJobId.slice(0, 8)}...</div>
          <div className="text-slate-500">Status: {jobStatus?.status || 'starting'}</div>
          <div className="text-slate-500">Step: {jobStatus?.progress?.step || 'queued'}</div>
          <div className="text-slate-500">Progress: {actualProgress}%</div>
          {jobStatus?.progress?.details && (
            <div className="text-green-400 mt-1">{jobStatus.progress.details}</div>
          )}
          {jobStatus?.started_at && (
            <div className="text-slate-500">Started: {new Date(jobStatus.started_at).toLocaleTimeString()}</div>
          )}
        </div>

        {/* Safe to leave notice */}
        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-lg">
          <CheckCircle className="w-4 h-4" />
          <span>Safe to leave - generation continues in background</span>
        </div>
      </div>
    );
  }

  return (
    <Button
      onClick={handleGenerate}
      disabled={loading || status === 'processing'}
      className="brand-gradient brand-gradient-hover"
      size="lg"
      data-testid="generate-button"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Starting...
        </>
      ) : (
        <>
          <Icon className="w-4 h-4 mr-2" />
          {label}
        </>
      )}
    </Button>
  );
}
