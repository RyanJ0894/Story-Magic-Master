'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
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
}

interface JobStatus {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: JobProgress;
  error?: string;
  started_at?: string;
  completed_at?: string;
}

interface GenerateButtonProps {
  projectId: string;
  pageCount: number;
  status: string;
  label?: string;
}

const ESTIMATED_DURATION_MS = 120000; // 2 minutes estimated

export default function GenerateButton({
  projectId,
  pageCount,
  status,
  label = 'Generate Audio',
}: GenerateButtonProps) {
  const [loading, setLoading] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timerProgress, setTimerProgress] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const router = useRouter();

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Poll for job status
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`);
      if (!response.ok) {
        console.error('Failed to fetch job status');
        return;
      }
      const data: JobStatus = await response.json();
      setJobStatus(data);

      // Check if job is complete or failed
      if (data.status === 'completed') {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        toast.success('Audio generation complete!');
        setLoading(false);
        setCurrentJobId(null);
        router.refresh();
      } else if (data.status === 'failed') {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        toast.error(`Generation failed: ${data.error || 'Unknown error'}`);
        setLoading(false);
        setCurrentJobId(null);
        router.refresh();
      }
    } catch (error) {
      console.error('Error polling job status:', error);
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

    // Initial poll
    pollJobStatus(jobId);
  }, [pollJobStatus]);

  const handleGenerate = async () => {
    setLoading(true);
    setJobStatus(null);

    const supabase = createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please sign in');
      router.push('/login');
      setLoading(false);
      return;
    }

    // Check usage limit
    const { data: remaining } = await supabase.rpc('get_remaining_pages', {
      p_user_id: user.id,
    });

    if (remaining !== null && pageCount > remaining) {
      toast.error(`You only have ${remaining} pages remaining. Upgrade to continue.`);
      setLoading(false);
      return;
    }

    // Update project status
    await supabase
      .from('projects')
      .update({ status: 'processing' })
      .eq('id', projectId);

    // Create job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        project_id: projectId,
        user_id: user.id,
        status: 'queued',
        progress: { step: 'queued', percent: 0, details: 'Initializing...' },
      })
      .select()
      .single();

    if (jobError) {
      toast.error('Failed to create job');
      setLoading(false);
      return;
    }

    // Trigger generation via API (fire and forget - returns immediately)
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          jobId: job.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start generation');
      }

      toast.success('Generation started! You can leave this page - processing will continue.');

      // Start tracking progress
      startTracking(job.id);

    } catch (error) {
      toast.error('Failed to start generation');
      console.error('Generation start error:', error);

      // Update job status to failed
      await supabase
        .from('jobs')
        .update({ status: 'failed', error: 'Failed to start generation' })
        .eq('id', job.id);

      await supabase
        .from('projects')
        .update({ status: 'failed' })
        .eq('id', projectId);

      setLoading(false);
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
      queued: 'Queued',
      initializing: 'Initializing',
      parsing: 'Parsing Script',
      parsing_complete: 'Script Parsed',
      generating_audio: 'Generating Audio',
      mixing: 'Mixing Tracks',
      uploading: 'Uploading',
      finalizing: 'Finalizing',
      done: 'Complete',
      failed: 'Failed',
    };
    return labels[step] || step.replace(/_/g, ' ');
  };

  const isRegenerate = label.toLowerCase().includes('regenerate') || label.toLowerCase().includes('retry');
  const Icon = isRegenerate ? RefreshCw : Sparkles;

  // Show progress UI when actively tracking
  if (loading && currentJobId) {
    const actualProgress = jobStatus?.progress?.percent || 0;
    // Use the higher of timer progress or actual progress
    const displayProgress = Math.max(timerProgress, actualProgress);

    return (
      <div className="w-full space-y-4">
        {/* Progress Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {getStepLabel(jobStatus?.progress?.step || 'initializing')}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Clock className="w-4 h-4" />
            <span>{formatTime(elapsedTime)}</span>
          </div>
        </div>

        {/* Main Progress Bar */}
        <div className="relative">
          <Progress
            value={displayProgress}
            className="h-3 bg-slate-200 dark:bg-slate-700"
          />
          <div
            className="absolute top-0 left-0 h-3 bg-violet-500/20 rounded-full transition-all duration-100"
            style={{ width: `${timerProgress}%` }}
          />
        </div>

        {/* Progress Details */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400">
            {jobStatus?.progress?.details || 'Processing...'}
          </span>
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {Math.round(displayProgress)}%
          </span>
        </div>

        {/* Dev Log Panel */}
        <div className="mt-4 p-3 bg-slate-900 rounded-lg text-xs font-mono text-slate-300 max-h-32 overflow-y-auto">
          <div className="text-violet-400 mb-1">// Generation Log (dev mode)</div>
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
      className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
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
