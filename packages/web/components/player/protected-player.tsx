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
  Maximize2,
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
    seek(percent * duration);
  }, [duration, seek]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
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

    const handlePlay = () => setIsPlaying(true);
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
  }, [duration, initialPosition, onComplete]);

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
        <div className="p-4 border-b bg-slate-50 dark:bg-slate-900">
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
                      <User className="w-3 h-3" />
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
                className={showSceneList ? 'bg-slate-200 dark:bg-slate-800' : ''}
              >
                <List className="w-4 h-4 mr-2" />
                Scenes
              </Button>
            </div>
          </div>
        </div>

        {/* Scene List (collapsible) */}
        {showSceneList && scenes.length > 0 && (
          <div className="max-h-48 overflow-y-auto border-b">
            {scenes.map((scene, index) => (
              <button
                key={scene.scene_id}
                onClick={() => jumpToScene(scene)}
                className={`w-full text-left px-4 py-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors ${
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
          onClick={handleProgressClick}
          className="h-2 bg-slate-200 dark:bg-slate-800 cursor-pointer relative group"
        >
          {/* Buffered */}
          <div
            className="absolute h-full bg-slate-300 dark:bg-slate-700"
            style={{ width: `${buffered}%` }}
          />
          {/* Progress */}
          <div
            className="absolute h-full bg-violet-500"
            style={{ width: `${progress}%` }}
          />
          {/* Hover indicator */}
          <div
            className="absolute h-full w-1 bg-violet-600 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${progress}%`, transform: 'translateX(-50%)' }}
          />
          {/* Scene markers */}
          {scenes.map((scene) => (
            <div
              key={scene.scene_id}
              className="absolute top-0 w-0.5 h-full bg-slate-400 dark:bg-slate-600 opacity-50"
              style={{ left: `${(scene.start_time / duration) * 100}%` }}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="p-4 flex items-center gap-4">
          {/* Time */}
          <div className="text-sm text-muted-foreground tabular-nums w-24">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          {/* Main Controls */}
          <div className="flex items-center gap-2 flex-1 justify-center">
            {scenes.length > 0 && (
              <Button variant="ghost" size="icon" onClick={previousScene}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => skip(-10)}>
              <SkipBack className="w-5 h-5" />
            </Button>
            <Button
              size="icon"
              className="w-12 h-12 rounded-full"
              onClick={togglePlay}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-0.5" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => skip(10)}>
              <SkipForward className="w-5 h-5" />
            </Button>
            {scenes.length > 0 && (
              <Button variant="ghost" size="icon" onClick={nextScene}>
                <ChevronRight className="w-5 h-5" />
              </Button>
            )}
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {/* Volume */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
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
                className="w-20"
              />
            </div>

            {/* Playback Speed */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="tabular-nums">
                  {playbackRate}x
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {PLAYBACK_RATES.map((rate) => (
                  <DropdownMenuItem
                    key={rate}
                    onClick={() => setPlaybackRate(rate)}
                    className={playbackRate === rate ? 'bg-slate-100 dark:bg-slate-800' : ''}
                  >
                    {rate}x
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Settings */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled>
                  <Clock className="w-4 h-4 mr-2" />
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
          <div className="p-4 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm text-center">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
