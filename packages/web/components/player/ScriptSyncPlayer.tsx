'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Play,
  Pause,
  Download,
  Music,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  FileText,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface DialogueLine {
  line_id: string;
  character: string;
  text: string;
  voice_key?: string;
  start_time?: number; // seconds
  end_time?: number; // seconds
}

interface Scene {
  scene_id?: string;
  scene_header?: string;
  dialogue: DialogueLine[];
}

interface AudioOutput {
  id: string;
  fileName: string;
  filePath: string;
  durationSeconds?: number;
  format?: string;
}

interface ScriptSyncPlayerProps {
  outputs: AudioOutput[];
  scenes?: Scene[];
  manifest?: {
    timeline?: Array<{
      type: string;
      line_id?: string;
      start: number;
      end: number;
    }>;
  };
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function ScriptSyncPlayer({
  outputs,
  scenes = [],
  manifest,
  className,
}: ScriptSyncPlayerProps) {
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<'script' | 'player'>('script');
  const [isDragging, setIsDragging] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const scriptRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const currentOutput = outputs[currentTrack];

  // Build timing map from manifest or estimate from dialogue
  const timingMap = useRef<Map<string, { start: number; end: number }>>(new Map());

  useEffect(() => {
    timingMap.current.clear();

    if (manifest?.timeline) {
      // Use timeline data
      manifest.timeline
        .filter((event) => event.type === 'dialogue' && event.line_id)
        .forEach((event) => {
          timingMap.current.set(event.line_id!, { start: event.start, end: event.end });
        });
    } else if (scenes.length > 0) {
      // Estimate timing based on text length and duration
      const totalChars = scenes.reduce(
        (acc, scene) =>
          acc + scene.dialogue.reduce((a, line) => a + line.text.length, 0),
        0
      );
      const estimatedDuration = duration || currentOutput?.durationSeconds || 60;
      const charsPerSecond = totalChars / estimatedDuration;

      let currentTimeOffset = 0;
      scenes.forEach((scene) => {
        scene.dialogue.forEach((line) => {
          const lineDuration = line.text.length / charsPerSecond;
          timingMap.current.set(line.line_id, {
            start: currentTimeOffset,
            end: currentTimeOffset + lineDuration,
          });
          currentTimeOffset += lineDuration;
        });
      });
    }
  }, [manifest, scenes, duration, currentOutput]);

  // Find active line based on current time
  const updateActiveLine = useCallback((time: number) => {
    let foundLine: string | null = null;

    const entries = Array.from(timingMap.current.entries());
    for (const [lineId, timing] of entries) {
      if (time >= timing.start && time < timing.end) {
        foundLine = lineId;
        break;
      }
    }

    setActiveLineId(foundLine);
  }, []);

  // Auto-scroll to active line
  useEffect(() => {
    if (activeLineRef.current && isPlaying) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineId, isPlaying]);

  // Audio controls
  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current || isDragging) return;
    const progressPercent =
      (audioRef.current.currentTime / audioRef.current.duration) * 100;
    setProgress(progressPercent || 0);
    setCurrentTime(audioRef.current.currentTime);
    updateActiveLine(audioRef.current.currentTime);
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
    const step = 0.02;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        seekTo((audioRef.current.currentTime / audioRef.current.duration) + step);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        seekTo((audioRef.current.currentTime / audioRef.current.duration) - step);
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

  const seekToLine = (lineId: string) => {
    if (!audioRef.current) return;
    const timing = timingMap.current.get(lineId);
    if (timing) {
      audioRef.current.currentTime = timing.start;
      if (!isPlaying) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const skipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(
        audioRef.current.currentTime + 10,
        audioRef.current.duration
      );
    }
  };

  const skipBackward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 10, 0);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentOutput) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Music className="w-5 h-5 mr-2" aria-hidden="true" />
        No audio available
      </div>
    );
  }

  const orchestratorUrl = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || process.env.ORCHESTRATOR_URL || '';
  const audioUrl = `${orchestratorUrl}/audio/${currentOutput.filePath}`;

  return (
    <div className={cn('space-y-4', className)}>
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Main Player Card */}
      <Card
        className={cn(
          'overflow-hidden transition-all',
          expanded && 'fixed inset-4 z-50 flex flex-col'
        )}
      >
        {/* Controls Header */}
        <div className="p-4 border-b border-border bg-muted">
          <div className="flex items-center gap-4">
            {/* Play Controls */}
            <div className="flex items-center gap-2" role="group" aria-label="Playback controls">
              <button
                onClick={skipBackward}
                aria-label="Skip back 10 seconds"
                className="p-2 rounded-full hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              >
                <SkipBack className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                onClick={togglePlayPause}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-full hover:from-violet-600 hover:to-purple-700 transition-all shadow-lg shadow-violet-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" aria-hidden="true" />
                )}
              </button>
              <button
                onClick={skipForward}
                aria-label="Skip forward 10 seconds"
                className="p-2 rounded-full hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              >
                <SkipForward className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="flex-1 space-y-1">
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
                className="h-2 bg-muted rounded-full cursor-pointer overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              >
                <div
                  className="h-full brand-gradient-bar rounded-full transition-all duration-100 pointer-events-none"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Volume & Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                aria-label={muted ? 'Unmute' : 'Mute'}
                className="p-2 rounded-full hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              >
                {muted ? <VolumeX className="w-4 h-4" aria-hidden="true" /> : <Volume2 className="w-4 h-4" aria-hidden="true" />}
              </button>
              <Button variant="outline" size="sm" asChild>
                <a href={audioUrl} download={currentOutput.fileName} aria-label={`Download ${currentOutput.fileName}`}>
                  <Download className="w-4 h-4" aria-hidden="true" />
                  <span className="sr-only">Download</span>
                </a>
              </Button>
              <button
                onClick={() => setExpanded(!expanded)}
                aria-label={expanded ? 'Exit fullscreen' : 'Enter fullscreen'}
                className="p-2 rounded-full hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              >
                {expanded ? (
                  <Minimize2 className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Maximize2 className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Script View */}
        {scenes.length > 0 && (
          <div className={cn('flex-1', expanded ? 'min-h-0' : 'max-h-[400px]')}>
            <Tabs value={view} onValueChange={(v) => setView(v as 'script' | 'player')}>
              <TabsList className="w-full justify-start rounded-none border-b">
                <TabsTrigger value="script" className="gap-2">
                  <FileText className="w-4 h-4" aria-hidden="true" />
                  Script
                </TabsTrigger>
                <TabsTrigger value="player" className="gap-2">
                  <Music className="w-4 h-4" aria-hidden="true" />
                  Now Playing
                </TabsTrigger>
              </TabsList>

              <TabsContent value="script" className="m-0">
                <ScrollArea className={cn(expanded ? 'h-[calc(100vh-200px)]' : 'h-[350px]')}>
                  <div ref={scriptRef} className="p-4 space-y-6">
                    {scenes.map((scene, sceneIndex) => (
                      <div key={scene.scene_id || sceneIndex} className="space-y-3">
                        {scene.scene_header && (
                          <h3 className="text-sm font-bold uppercase text-muted-foreground">
                            {scene.scene_header}
                          </h3>
                        )}
                        {scene.dialogue.map((line) => {
                          const isActive = activeLineId === line.line_id;
                          return (
                            <div
                              key={line.line_id}
                              ref={isActive ? activeLineRef : null}
                              role="button"
                              tabIndex={0}
                              aria-label={`${line.character}: ${line.text}`}
                              aria-current={isActive ? 'true' : undefined}
                              onClick={() => seekToLine(line.line_id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  seekToLine(line.line_id);
                                }
                              }}
                              className={cn(
                                'p-3 rounded-lg cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2',
                                isActive
                                  ? 'bg-violet-100 dark:bg-violet-900/30 ring-2 ring-violet-500 scale-[1.02]'
                                  : 'hover:bg-accent'
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <span
                                  className={cn(
                                    'text-xs font-bold uppercase shrink-0 w-24',
                                    isActive
                                      ? 'text-violet-600 dark:text-violet-400'
                                      : 'text-muted-foreground'
                                  )}
                                >
                                  {line.character}
                                </span>
                                <p
                                  className={cn(
                                    'text-sm leading-relaxed',
                                    isActive
                                      ? 'text-foreground font-medium'
                                      : 'text-muted-foreground'
                                  )}
                                >
                                  {line.text}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="player" className="m-0">
                <div className="p-8 text-center">
                  {activeLineId && scenes.length > 0 ? (
                    <div className="space-y-4">
                      {scenes.map((scene) =>
                        scene.dialogue
                          .filter((line) => line.line_id === activeLineId)
                          .map((line) => (
                            <div key={line.line_id} className="space-y-2">
                              <p className="text-sm font-bold uppercase text-violet-600 dark:text-violet-400">
                                {line.character}
                              </p>
                              <p className="text-xl text-foreground leading-relaxed">
                                &ldquo;{line.text}&rdquo;
                              </p>
                            </div>
                          ))
                      )}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">
                      <Music className="w-12 h-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
                      <p>Press play to see the current line</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </Card>
    </div>
  );
}

export default ScriptSyncPlayer;
