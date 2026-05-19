'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, Pause, Download, Music, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { resolveAudioUrl } from '@/lib/resolve-audio-url';

interface AudioOutput {
  id: string;
  fileName: string;
  filePath: string;
  durationSeconds?: number;
  format?: string;
}

interface AudioPlayerProps {
  outputs: AudioOutput[];
  /** When set, overrides the constructed URL for the current track with this direct URL (used for progressive playback). */
  directUrl?: string;
  /** Ordered list of segment URLs for progressive multi-chunk playback. Supersedes directUrl when non-empty. */
  segmentUrls?: string[];
  /** When true, shows a "Preparing…" indicator after all available segments have played. */
  showBufferIndicator?: boolean;
}

export default function AudioPlayer({ outputs, directUrl, segmentUrls, showBufferIndicator }: AudioPlayerProps) {
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const isFirstSegmentAdvanceRef = useRef(true);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const currentOutput = outputs[currentTrack];
  const isSegmentMode = !!segmentUrls && segmentUrls.length > 0;

  const handleEnded = useCallback(() => {
    if (isSegmentMode && segmentUrls && activeSegmentIndex < segmentUrls.length - 1) {
      setActiveSegmentIndex((i) => i + 1);
    } else if (isSegmentMode && showBufferIndicator) {
      setIsBuffering(true);
      setIsPlaying(false);
    } else {
      setIsPlaying(false);
    }
  }, [isSegmentMode, segmentUrls, activeSegmentIndex, showBufferIndicator]);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleTimeUpdate = () => {
    if (!audioRef.current || isDragging) return;
    const progressPercent = (audioRef.current.currentTime / audioRef.current.duration) * 100;
    setProgress(progressPercent || 0);
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const seekTo = useCallback((percentage: number) => {
    if (!audioRef.current) return;
    const clamped = Math.max(0, Math.min(1, percentage));
    const time = clamped * audioRef.current.duration;
    audioRef.current.currentTime = time;
    setProgress(clamped * 100);
    setCurrentTime(time);
  }, []);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    seekTo(x / rect.width);
  };

  // Drag-to-seek on progress bar
  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handleSeek(e);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!progressRef.current) return;
      const rect = progressRef.current.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left;
      seekTo(x / rect.width);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Progress bar keyboard navigation
  const handleProgressKeyDown = (e: React.KeyboardEvent) => {
    if (!audioRef.current) return;
    const stepPercent = 0.02; // 2% per arrow press

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        seekTo((audioRef.current.currentTime / audioRef.current.duration) + stepPercent);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        seekTo((audioRef.current.currentTime / audioRef.current.duration) - stepPercent);
        break;
      case 'Home':
        e.preventDefault();
        seekTo(0);
        break;
      case 'End':
        e.preventDefault();
        seekTo(1);
        break;
    }
  };

  // Volume control
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Auto-play when segment index advances (skip initial mount)
  useEffect(() => {
    if (isFirstSegmentAdvanceRef.current) {
      isFirstSegmentAdvanceRef.current = false;
      return;
    }
    if (!audioRef.current) return;
    audioRef.current.load();
    audioRef.current.play().catch(() => {});
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(true);
  }, [activeSegmentIndex]);

  // Resume from buffering when new segment arrives
  useEffect(() => {
    if (!isBuffering || !segmentUrls) return;
    const nextIndex = activeSegmentIndex + 1;
    if (nextIndex < segmentUrls.length && segmentUrls[nextIndex]) {
      setIsBuffering(false);
      setActiveSegmentIndex(nextIndex);
    }
  }, [segmentUrls, activeSegmentIndex, isBuffering]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(v => Math.min(1, v + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(v => Math.max(0, v - 0.1));
          break;
        case 'm':
          e.preventDefault();
          setIsMuted(m => !m);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause]);

  const formatTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentOutput) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Music className="w-5 h-5 mr-2" />
        No audio available
      </div>
    );
  }

  // Construct the playback URL — active segment URL takes highest precedence, then directUrl, then constructed path
  const activeSegmentUrl = isSegmentMode ? segmentUrls?.[activeSegmentIndex] : undefined;
  const audioUrl = activeSegmentUrl || directUrl || resolveAudioUrl(currentOutput.filePath);

  return (
    <div className="space-y-4">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Player Controls */}
      <Card className="p-4" data-testid="audio-player">
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            data-testid="audio-play-pause-button"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </button>

          <div className="flex-1 space-y-1">
            {/* Progress bar */}
            <div
              ref={progressRef}
              role="slider"
              tabIndex={0}
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(currentTime)}
              aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
              onMouseDown={handleProgressMouseDown}
              onKeyDown={handleProgressKeyDown}
              className="h-2 bg-muted rounded-full cursor-pointer overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <div
                className="h-full brand-gradient-bar rounded-full transition-all duration-100 pointer-events-none"
                style={{ width: `${progress}%` }}
              />
            </div>
            {/* Time display */}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>
                {duration
                  ? formatTime(duration)
                  : currentOutput.durationSeconds
                  ? formatTime(currentOutput.durationSeconds)
                  : '--:--'}
              </span>
            </div>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMuted(!isMuted)}
              aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
              className="p-2 rounded-full hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={isMuted ? 0 : Math.round(volume * 100)}
              onChange={(e) => {
                setVolume(Number(e.target.value) / 100);
                setIsMuted(false);
              }}
              aria-label="Volume"
              className="w-16 h-1 accent-blue-500"
            />
          </div>
        </div>
      </Card>

      {/* Buffer indicator — shown when player has caught up to available audio */}
      {isBuffering && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
          <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
          <span>Preparing…</span>
        </div>
      )}

      {/* Download Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Music className="w-4 h-4" aria-hidden="true" />
          <span>{currentOutput.fileName}</span>
        </div>
        <Button variant="outline" size="sm" asChild data-testid="download-button">
          <a href={audioUrl} download={currentOutput.fileName}>
            <Download className="w-4 h-4 mr-2" aria-hidden="true" />
            Download
          </a>
        </Button>
      </div>

      {/* Track List (if multiple outputs) */}
      {outputs.length > 1 && (
        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-medium text-foreground mb-3">All Outputs</h4>
          <div className="space-y-1" role="listbox" aria-label="Audio tracks">
            {outputs.map((output, index) => (
              <button
                key={output.id}
                role="option"
                aria-selected={index === currentTrack}
                onClick={() => {
                  setCurrentTrack(index);
                  setIsPlaying(false);
                  setProgress(0);
                  setCurrentTime(0);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                  index === currentTrack
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'hover:bg-accent text-foreground'
                }`}
              >
                <div className={`w-8 h-8 flex items-center justify-center rounded-full ${
                  index === currentTrack
                    ? 'bg-blue-500 text-white'
                    : 'bg-muted'
                }`} aria-hidden="true">
                  {index === currentTrack && isPlaying ? (
                    <Pause className="w-3 h-3" />
                  ) : (
                    <Play className="w-3 h-3 ml-0.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm truncate block">{output.fileName}</span>
                  {output.durationSeconds && (
                    <span className="text-xs text-muted-foreground">
                      {formatTime(output.durationSeconds)}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
