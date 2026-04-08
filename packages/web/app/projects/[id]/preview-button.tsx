'use client';

/**
 * PreviewButton - Generates and plays a 15-second audio preview of a scene
 *
 * States:
 * - idle: Shows play icon + "Preview"
 * - generating: Shows spinner + "Generating..."
 * - playing: Shows pause icon + progress bar
 * - error: Shows error message with retry
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Play, Pause, Loader2, AlertCircle, Volume2 } from 'lucide-react';
import { apiFetch } from '@/lib/api/fetch';
import { cn } from '@/lib/utils';

type PreviewState = 'idle' | 'generating' | 'playing' | 'paused' | 'error';

interface PreviewButtonProps {
  projectId: string;
  sceneId: string;
  sceneSummary?: string;
  disabled?: boolean;
  remainingPreviews: number;
  onPreviewGenerated?: (url: string) => void;
  onRemainingChanged?: (remaining: number) => void;
}

export function PreviewButton({
  projectId,
  sceneId,
  sceneSummary,
  disabled,
  remainingPreviews,
  onPreviewGenerated,
  onRemainingChanged,
}: PreviewButtonProps) {
  const [state, setState] = useState<PreviewState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const budgetExhausted = remainingPreviews <= 0;

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (audioRef.current) {
        audioRef.current.onplay = null;
        audioRef.current.onpause = null;
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const startProgressTracking = useCallback((audio: HTMLAudioElement) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    progressIntervalRef.current = setInterval(() => {
      if (audio.duration > 0) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    }, 100);
  }, []);

  const stopProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const playAudio = useCallback((url: string) => {
    // Stop any existing playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(url);

    audio.onplay = () => {
      if (!mountedRef.current) return;
      setState('playing');
      startProgressTracking(audio);
    };

    audio.onpause = () => {
      if (!mountedRef.current) return;
      if (!audio.ended) {
        setState('paused');
      }
      stopProgressTracking();
    };

    audio.onended = () => {
      if (!mountedRef.current) return;
      setState('idle');
      setProgress(0);
      stopProgressTracking();
    };

    audio.onerror = () => {
      if (!mountedRef.current) return;
      setState('error');
      setErrorMessage('Failed to play audio');
      stopProgressTracking();
    };

    audioRef.current = audio;
    audio.play().catch(() => {
      if (!mountedRef.current) return;
      setState('error');
      setErrorMessage('Failed to play audio');
    });
  }, [startProgressTracking, stopProgressTracking]);

  const handleClick = useCallback(async () => {
    // If we have a cached preview URL, toggle play/pause
    if (previewUrl) {
      if (state === 'playing') {
        audioRef.current?.pause();
        return;
      }
      if (state === 'paused') {
        audioRef.current?.play();
        return;
      }
      if (state === 'idle' || state === 'error') {
        playAudio(previewUrl);
        return;
      }
    }

    // Generate a new preview
    setState('generating');
    setErrorMessage(null);

    try {
      const response = await apiFetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, sceneId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data.code === 'PREVIEW_BUDGET_EXCEEDED') {
          setState('error');
          setErrorMessage('No previews remaining');
          return;
        }
        throw new Error(data.error || 'Preview generation failed');
      }

      const data = await response.json();
      const url = data.previewUrl;

      if (!url) {
        throw new Error('No preview URL returned');
      }

      setPreviewUrl(url);
      onPreviewGenerated?.(url);

      if (typeof data.remainingPreviews === 'number') {
        onRemainingChanged?.(data.remainingPreviews);
      }

      // Auto-play the preview
      playAudio(url);
    } catch (error) {
      setState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Preview failed');
    }
  }, [previewUrl, state, projectId, sceneId, playAudio, onPreviewGenerated, onRemainingChanged]);

  const isDisabled = disabled || (budgetExhausted && !previewUrl) || state === 'generating';

  const buttonContent = () => {
    switch (state) {
      case 'generating':
        return (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="text-xs">Generating...</span>
          </>
        );
      case 'playing':
        return (
          <>
            <Pause className="w-3.5 h-3.5" />
            <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        );
      case 'paused':
        return (
          <>
            <Play className="w-3.5 h-3.5" />
            <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        );
      case 'error':
        return (
          <>
            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs">Retry</span>
          </>
        );
      default:
        return (
          <>
            <Volume2 className="w-3.5 h-3.5" />
            <span className="text-xs">Preview</span>
          </>
        );
    }
  };

  if (budgetExhausted && !previewUrl) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="ghost"
                size="sm"
                disabled
                className="h-7 gap-1.5 text-muted-foreground"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span className="text-xs">Preview</span>
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>No previews remaining. Generate to use page credits, which grant more previews.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={isDisabled}
      className={cn(
        'h-7 gap-1.5',
        state === 'playing' && 'text-blue-600 dark:text-blue-400',
        state === 'error' && 'text-red-600 dark:text-red-400',
      )}
    >
      {buttonContent()}
    </Button>
  );
}

export default PreviewButton;
