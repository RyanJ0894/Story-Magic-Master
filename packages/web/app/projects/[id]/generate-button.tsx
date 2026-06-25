'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { log } from '@/lib/logger';
import { apiFetch } from '@/lib/api/fetch';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { isRetryImminent } from '@/lib/generation/job-status';
import { useJobStream } from '@/hooks/use-job-stream';
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
  // Sprint K/L — progressive playback
  firstAudioUrl?: string | null;
  segments?: Array<{ index: number; status: string; audioUrl: string | null }> | null;
  audio_url?: string | null;
  // 2026-06-25: retry telemetry. When status='failed' AND retry_count < max_retries,
  // a worker retry is imminent — keep polling instead of showing a terminal error.
  retry_count?: number;
  max_retries?: number;
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
  /**
   * #372: when true, render the "Re-render audio (reuse cached AI)"
   * toggle. Should reflect whether `project.directorJson` is non-null —
   * the AI cache must exist or the toggle would be a no-op (the server
   * also rejects with NO_DIRECTOR_CACHE as defense-in-depth).
   */
  hasDirectorCache?: boolean;
  onJobStarted?: () => void;
  /** Called as soon as the first audio segment is ready — before full job completion */
  onFirstAudioReady?: (audioUrl: string) => void;
  /** Called whenever new ready segment URLs arrive — receives the full ordered list of ready URLs */
  onSegmentsUpdate?: (urls: string[]) => void;
}

/**
 * Per-job duration estimate driving the smooth progress bar. The bar
 * interpolates from 0 → 95 % over this window; the server's `progress.percent`
 * takes over via `Math.max(timerProgress, actualProgress)` whenever it
 * outpaces the timer.
 *
 * Old behavior was a flat 120 000 ms (2 min) regardless of script length.
 * That worked for tiny scripts and was 4–6× too short for typical jobs — a
 * 10-page run measured at 492 s on dev 2026-06-24, so the bar hit its
 * 95 % cap ~70 s in and sat there for the remaining 7+ minutes (the
 * "stuck at 95 %" report).
 *
 * Calibration: ~50 s/page sustained for cold-cache jobs (director + chunked
 * TTS + mix), plus ~30 s of fixed overhead (warm-up, parse return, finalize).
 * Floors at 1 page so we never under-estimate trivially. No upper cap — long
 * scripts genuinely take 60+ minutes and lying to the user about that just
 * resurfaces the same stuck-bar problem at a different number.
 */
export function estimateDurationMs(pageCount: number): number {
  // `Math.max(1, NaN)` is NaN, so guard explicitly. Project rows can carry
  // null/undefined pageCount before the upload's page-count extraction lands.
  const pages = Number.isFinite(pageCount) ? Math.max(1, pageCount) : 1;
  return 30_000 + pages * 45_000;
}

export default function GenerateButton({
  projectId,
  pageCount,
  status,
  label = 'Generate Audio',
  workflowMode = 'fine_tuned',
  hasScript = true,
  hasDirectorCache = false,
  onJobStarted,
  onFirstAudioReady,
  onSegmentsUpdate,
}: GenerateButtonProps) {
  const { userId, isSignedIn, getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  // #372: per-run toggle. Defaults off so the common path is the normal
  // full pipeline; user opts in to bypass the scene_renders cache.
  const [forceFreshTts, setForceFreshTts] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);

  // 2026-06-25 Real-time job sync (flag-gated, default OFF). Subscribes to
  // /api/jobs/[id]/stream via EventSource and overrides jobStatus on every
  // server push. Polling continues alongside as the safety net; if SSE
  // falls back (3 errors / 30 s), polling is the entire show.
  // See docs/REALTIME_JOB_SYNC_2026-06-25.md for the architecture.
  const realtimeEnabled = process.env.NEXT_PUBLIC_REALTIME_JOB_SYNC === 'true';
  const { status: streamStatus, fellBack: streamFellBack } = useJobStream(
    realtimeEnabled ? currentJobId : null,
  );
  useEffect(() => {
    if (!realtimeEnabled || streamFellBack) return;
    if (!streamStatus) return;
    // The stream payload is a superset of the polling payload — same field
    // names, same shape. Cast to JobStatus is safe (shape comes from
    // /api/jobs/[id]/stream's serializeJobForStream).
    setJobStatus(streamStatus as unknown as JobStatus);
  }, [realtimeEnabled, streamFellBack, streamStatus]);
  const firstAudioFiredRef = useRef(false);
  const lastSegmentCountRef = useRef(0);
  const [queuePosition, setQueuePosition] = useState<QueuePosition | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timerProgress, setTimerProgress] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const consecutiveAuthFailures = useRef(0);
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
  // 2026-06-20: added 429 backoff. The route is rate-limited (loose tier,
  // 60/min) but a flaky network or shared NAT can still occasionally push
  // a user over. On 429 we honor Retry-After (or default 5s) before the
  // next poll instead of hammering. Ryan's 6/19 7:38 PM trace showed
  // 50+ consecutive 429s — purely a client-side cadence issue.
  const queueBackoffUntilRef = useRef<number>(0);
  const pollQueuePosition = useCallback(async (jobId: string) => {
    if (Date.now() < queueBackoffUntilRef.current) return; // honor backoff
    try {
      const response = await apiFetch(`/api/jobs/${jobId}/position`);
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') ?? '5', 10);
        const backoffMs = Math.min(Math.max(retryAfter, 1), 30) * 1000;
        queueBackoffUntilRef.current = Date.now() + backoffMs;
        return;
      }
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

  // Poll for job status — injects a fresh Clerk JWT on every call so the poll
  // survives device sleep or background tab (Clerk client-side refresh may stall).
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const token = await getToken();
      const headers: Record<string, string> = { 'X-Requested-With': 'story-magic' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`/api/jobs/${jobId}`, { headers });
      if (!response.ok) {
        if (response.status === 401) {
          consecutiveAuthFailures.current += 1;
          if (consecutiveAuthFailures.current >= 3) {
            // Don't kill polling — auth may recover on next tick.
            // Show a recoverable toast so the user can manually check.
            consecutiveAuthFailures.current = 0;
            toast.error('Connection lost — your audio may be ready.', {
              duration: 30000,
              action: {
                label: 'Check status →',
                onClick: () => router.refresh(),
              },
            });
          }
          return;
        }
        consecutiveAuthFailures.current = 0;
        log.error('Failed to fetch job status');
        return;
      }
      consecutiveAuthFailures.current = 0;
      const data: JobStatus = await response.json();
      setJobStatus(data);

      // Sprint L Fast Start: fire onFirstAudioReady as soon as the first segment URL appears,
      // before the full job completes.
      if (!firstAudioFiredRef.current && data.firstAudioUrl && onFirstAudioReady) {
        firstAudioFiredRef.current = true;
        onFirstAudioReady(data.firstAudioUrl);
      }

      // Sprint L-2b: fire onSegmentsUpdate whenever the ready segment list grows
      if (onSegmentsUpdate && data.segments) {
        const readyUrls = data.segments
          .filter((s) => s.status === 'ready' && s.audioUrl)
          .map((s) => s.audioUrl as string);
        if (readyUrls.length > lastSegmentCountRef.current) {
          lastSegmentCountRef.current = readyUrls.length;
          onSegmentsUpdate(readyUrls);
        }
      }

      // Check if job is complete or failed.
      //
      // 2026-06-25: distinguish "failed but retry imminent" from "terminally
      // failed". The worker writes status='failed' on every chunk-failure
      // throw, then failJob() in the SQL proc transitions to 'queued' with
      // retryCount+1 if retries remain. Before this branch, the UI saw the
      // brief 'failed' state and stopped polling, missing the retry's
      // eventual completion. Decision logic lives in `isRetryImminent` so
      // it can be unit-tested without React.
      if (isRetryImminent(data)) {
        // Stay quiet but keep polling. The worker will flip the row back to
        // 'queued' within ~30s and we'll catch the subsequent 'processing'
        // → 'completed' (or final 'failed') transition naturally.
        return;
      }

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
        // A-002 (2026-06-15): include jobId in the failure toast with a copy
        // action so users (and Ryan during testing) can paste it into a
        // support ticket. Before this every failure landed in our inbox as
        // "it failed around 4:30" with no way to find the trace.
        toast.error(`Generation failed: ${errorMsg}`, {
          description: `Job ID: ${jobId}`,
          duration: 15_000, // Failure toasts are easy to miss at the default 4s
          action: {
            label: 'Copy Job ID',
            onClick: () => {
              void navigator.clipboard.writeText(jobId).then(
                () => toast.success('Job ID copied to clipboard'),
                () => toast.error('Failed to copy — please copy manually from the description'),
              );
            },
          },
        });
        setLoading(false);
        setCurrentJobId(null);
        setQueuePosition(null);
        router.refresh();
      }
    } catch (error) {
      log.error('Error polling job status', error);
    }
  }, [router, getToken]);

  // Start timer and polling
  const startTracking = useCallback((jobId: string) => {
    startTimeRef.current = Date.now();
    firstAudioFiredRef.current = false;
    lastSegmentCountRef.current = 0;
    consecutiveAuthFailures.current = 0;
    setElapsedTime(0);
    setTimerProgress(0);
    setCurrentJobId(jobId);

    // Update timer every 100ms for smooth progress. Estimate is captured
    // per-job from pageCount, so a 5-page and a 90-page job no longer share
    // the same flat-2-minute fiction.
    const estimateMs = estimateDurationMs(pageCount);
    timerIntervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Date.now() - startTimeRef.current;
        setElapsedTime(elapsed);
        // Timer progress caps at 95% - actual completion comes from job status
        setTimerProgress(Math.min(95, (elapsed / estimateMs) * 100));
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
  }, [pollJobStatus, pollQueuePosition, pageCount]);

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
          // #372: only sent when true; the API schema defaults it to false.
          ...(forceFreshTts ? { forceFreshTts: true } : {}),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to start generation');
      }

      const data = await response.json();
      const jobId = data.jobId;

      toast.success('Generation started!');

      onJobStarted?.();

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
      first_audio_ready: 'Audio Started',
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

        {/* Dev Log Panel — dev builds only; never shown to production users */}
        {process.env.NODE_ENV !== 'production' && (
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
        )}

        {/* Safe to leave notice */}
        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-lg">
          <CheckCircle className="w-4 h-4" />
          <span>Safe to leave - generation continues in background</span>
        </div>
      </div>
    );
  }

  const button = (
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

  // #372: "Re-render audio (reuse cached AI)" toggle. Only shown when a
  // prior generation has cached the directorJson — otherwise the toggle
  // would be a no-op (and the API rejects with NO_DIRECTOR_CACHE).
  const freshTtsToggle = hasDirectorCache && !loading && status !== 'processing' ? (
    <label
      className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer select-none"
      data-testid="force-fresh-tts-toggle"
    >
      <input
        type="checkbox"
        checked={forceFreshTts}
        onChange={(e) => setForceFreshTts(e.target.checked)}
        className="mt-0.5 accent-primary cursor-pointer"
        aria-describedby="force-fresh-tts-help"
      />
      <span>
        <span className="font-medium text-foreground">Re-render audio (reuse cached AI)</span>
        <span id="force-fresh-tts-help" className="block">
          Skip the AI step using the cached director output; re-run TTS only.
          Useful for testing voice changes without burning the AI cost.
        </span>
      </span>
    </label>
  ) : null;

  if (workflowMode === 'automatic' && !loading) {
    return (
      <div className="flex flex-col gap-3 items-start">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent>Audio starts in ~90 seconds</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {freshTtsToggle}
      </div>
    );
  }

  return freshTtsToggle ? (
    <div className="flex flex-col gap-3 items-start">
      {button}
      {freshTtsToggle}
    </div>
  ) : button;
}
