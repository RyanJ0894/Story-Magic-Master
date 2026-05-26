'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Settings,
  List,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';

interface Scene {
  scene_id: string;
  title: string;
  start_time: number;
  duration: number;
  characters: string[];
}

interface ProtectedPlayerProps {
  projectId: string;
  projectName: string;
  audioUrl: string;
  duration: number;
  scenes?: Scene[];
  initialPosition?: number;
  onPositionChange?: (position: number) => void;
  onPlay?: () => void;
  onComplete?: () => void;
  allowDownload?: boolean;
}

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2];

export function ProtectedPlayer({
  projectId,
  projectName,
  audioUrl,
  duration,
  scenes = [],
  initialPosition = 0,
  onPositionChange,
  onPlay,
  onComplete,
  allowDownload = false,
}: ProtectedPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialPosition);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSceneList, setShowSceneList] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Get current scene
  const currentScene = scenes.find(
    (scene) => currentTime >= scene.start_time && currentTime < scene.start_time + scene.duration
  );

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

  // Play/Pause
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  }, [isPlaying]);

  // Seek
  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(time, duration));
  }, [duration]);

  // Seek by percentage
  const seekToPercent = useCallback((percent: number) => {
    const clamped = Math.max(0, Math.min(1, percent));
    seek(clamped * duration);
  }, [duration, seek]);

  // Skip forward/backward
  const skip = useCallback((seconds: number) => {
    if (!audioRef.current) return;
    seek(audioRef.current.currentTime + seconds);
  }, [seek]);

  // Jump to scene
  const jumpToScene = useCallback((scene: Scene) => {
    seek(scene.start_time);
    setShowSceneList(false);
  }, [seek]);

  // Previous/Next scene
  const previousScene = useCallback(() => {
    const currentIndex = scenes.findIndex(
      (scene) => currentTime >= scene.start_time && currentTime < scene.start_time + scene.duration
    );
    if (currentIndex > 0) {
      jumpToScene(scenes[currentIndex - 1]);
    } else if (currentIndex === 0) {
      seek(0);
    }
  }, [currentTime, scenes, jumpToScene, seek]);

  const nextScene = useCallback(() => {
    const currentIndex = scenes.findIndex(
      (scene) => currentTime >= scene.start_time && currentTime < scene.start_time + scene.duration
    );
    if (currentIndex < scenes.length - 1) {
      jumpToScene(scenes[currentIndex + 1]);
    }
  }, [currentTime, scenes, jumpToScene]);

  // Handle progress bar click
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    seekToPercent(percent);
  }, [seekToPercent]);

  // Drag-to-seek on progress bar (mouse)
  const handleProgressMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handleProgressClick(e);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!progressRef.current) return;
      const rect = progressRef.current.getBoundingClientRect();
      const percent = (moveEvent.clientX - rect.left) / rect.width;
      seekToPercent(percent);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [handleProgressClick, seekToPercent]);

  // Drag-to-seek on progress bar (touch — for iPad/iPhone share recipients)
  const handleProgressTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault(); // prevent page scroll while seeking
    setIsDragging(true);

    const applyTouch = (touch: Touch) => {
      if (!progressRef.current) return;
      const rect = progressRef.current.getBoundingClientRect();
      const percent = (touch.clientX - rect.left) / rect.width;
      seekToPercent(percent);
    };

    applyTouch(e.touches[0]);

    const handleTouchMove = (moveEvent: TouchEvent) => {
      moveEvent.preventDefault();
      applyTouch(moveEvent.touches[0]);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  }, [seekToPercent]);

  // Progress bar keyboard navigation
  const handleProgressKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!audioRef.current) return;
    const step = 0.02;
    const current = audioRef.current.currentTime / duration;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        seekToPercent(current + step);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        seekToPercent(current - step);
        break;
      case 'Home':
        e.preventDefault();
        seekToPercent(0);
        break;
      case 'End':
        e.preventDefault();
        seekToPercent(1);
        break;
    }
  }, [duration, seekToPercent]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!isDragging) {
        setCurrentTime(audio.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      setIsLoading(false);
      if (initialPosition > 0) {
        audio.currentTime = initialPosition;
      }
    };

    const handleProgress = () => {
      if (audio.buffered.length > 0) {
        const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
        setBuffered((bufferedEnd / duration) * 100);
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
      if (onPlay) onPlay();
    };
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      if (onComplete) onComplete();
    };
    const handleError = () => {
      setError('Failed to load audio. Please try again.');
      setIsLoading(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('progress', handleProgress);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('progress', handleProgress);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [duration, initialPosition, onPlay, onComplete, isDragging]);

  // Save position periodically
  useEffect(() => {
    if (isPlaying && onPositionChange) {
      saveIntervalRef.current = setInterval(() => {
        onPositionChange(currentTime);
      }, 10000); // Save every 10 seconds
    }

    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, [isPlaying, currentTime, onPositionChange]);

  // Save position on pause
  useEffect(() => {
    if (!isPlaying && onPositionChange && currentTime > 0) {
      onPositionChange(currentTime);
    }
  }, [isPlaying, currentTime, onPositionChange]);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Update playback rate
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(10);
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
  }, [togglePlay, skip]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Card className="overflow-hidden">
      {/* Hidden audio element - no controls, no download */}
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        crossOrigin="anonymous"
        controlsList="nodownload"
      />

      <CardContent className="p-0">
        {/* Now Playing Info */}
        <div className="p-4 border-b bg-muted">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{projectName}</h3>
              {currentScene && (
                <p className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-xs font-mono">
                    {currentScene.scene_id}
                  </Badge>
                  {currentScene.characters.length > 0 && (
                    <>
                      <User className="w-3 h-3" aria-hidden="true" />
                      <span>{currentScene.characters.join(', ')}</span>
                    </>
                  )}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSceneList(!showSceneList)}
                aria-expanded={showSceneList}
                aria-label="Toggle scene list"
                className={showSceneList ? 'bg-muted' : ''}
              >
                <List className="w-4 h-4 mr-2" aria-hidden="true" />
                <span className="hidden sm:inline">Scenes</span>
                <span className="sr-only sm:hidden">Scenes</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Scene List (collapsible) */}
        {showSceneList && scenes.length > 0 && (
          <div className="max-h-48 overflow-y-auto border-b" role="listbox" aria-label="Scenes">
            {scenes.map((scene, index) => (
              <button
                key={scene.scene_id}
                role="option"
                aria-selected={currentScene?.scene_id === scene.scene_id}
                onClick={() => jumpToScene(scene)}
                className={`w-full text-left px-4 py-2 flex items-center justify-between hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 ${
                  currentScene?.scene_id === scene.scene_id
                    ? 'bg-violet-50 dark:bg-violet-950 border-l-2 border-violet-500'
                    : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-6">{index + 1}</span>
                  <span className="text-sm font-medium">{scene.title || scene.scene_id}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatTime(scene.start_time)}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Progress Bar */}
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
          onTouchStart={handleProgressTouchStart}
          onKeyDown={handleProgressKeyDown}
          className="h-2 bg-muted cursor-pointer relative group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          {/* Buffered */}
          <div
            className="absolute h-full bg-muted-foreground/30 pointer-events-none"
            style={{ width: `${buffered}%` }}
          />
          {/* Progress */}
          <div
            className="absolute h-full bg-violet-500 pointer-events-none"
            style={{ width: `${progress}%` }}
          />
          {/* Hover indicator */}
          <div
            className="absolute h-full w-1 bg-violet-600 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ left: `${progress}%`, transform: 'translateX(-50%)' }}
          />
          {/* Scene markers */}
          {scenes.map((scene) => (
            <div
              key={scene.scene_id}
              className="absolute top-0 w-0.5 h-full bg-muted-foreground opacity-50 pointer-events-none"
              style={{ left: `${(scene.start_time / duration) * 100}%` }}
            />
          ))}
        </div>

        {/* Controls - responsive layout */}
        <div className="p-3 sm:p-4 flex flex-wrap items-center gap-2 sm:gap-4">
          {/* Time */}
          <div className="text-xs sm:text-sm text-muted-foreground tabular-nums w-auto sm:w-24 order-2 sm:order-1">
            <span>{formatTime(currentTime)}</span>
            <span className="mx-1">/</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Main Controls */}
          <div className="flex items-center gap-1 sm:gap-2 flex-1 justify-center order-1 sm:order-2" role="group" aria-label="Playback controls">
            {scenes.length > 0 && (
              <Button variant="ghost" size="icon" onClick={previousScene} aria-label="Previous scene" className="hidden sm:inline-flex">
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => skip(-10)} aria-label="Skip back 10 seconds">
              <SkipBack className="w-5 h-5" aria-hidden="true" />
            </Button>
            <Button
              size="icon"
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              onClick={togglePlay}
              disabled={isLoading}
              aria-label={isLoading ? 'Loading audio' : isPlaying ? 'Pause' : 'Play'}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" aria-hidden="true" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
              ) : (
                <Play className="w-5 h-5 sm:w-6 sm:h-6 ml-0.5" aria-hidden="true" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => skip(10)} aria-label="Skip forward 10 seconds">
              <SkipForward className="w-5 h-5" aria-hidden="true" />
            </Button>
            {scenes.length > 0 && (
              <Button variant="ghost" size="icon" onClick={nextScene} aria-label="Next scene" className="hidden sm:inline-flex">
                <ChevronRight className="w-5 h-5" aria-hidden="true" />
              </Button>
            )}
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1 sm:gap-2 order-3">
            {/* Volume */}
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMuted(!isMuted)}
                aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <Volume2 className="w-5 h-5" aria-hidden="true" />
                )}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume * 100]}
                onValueChange={(values: number[]) => {
                  setVolume(values[0] / 100);
                  setIsMuted(false);
                }}
                max={100}
                step={1}
                aria-label="Volume"
                className="w-16 sm:w-20 hidden sm:flex"
              />
            </div>

            {/* Playback Speed */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="tabular-nums" aria-label={`Playback speed ${playbackRate}x`}>
                  {playbackRate}x
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {PLAYBACK_RATES.map((rate) => (
                  <DropdownMenuItem
                    key={rate}
                    onClick={() => setPlaybackRate(rate)}
                    className={playbackRate === rate ? 'bg-muted' : ''}
                  >
                    {rate}x
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Settings */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Player settings">
                  <Settings className="w-5 h-5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled>
                  <Clock className="w-4 h-4 mr-2" aria-hidden="true" />
                  Sleep Timer
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  Keyboard Shortcuts
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm text-center" role="alert">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
