'use client';

/**
 * RunComparison - Side-by-side A/B comparison of two runs
 *
 * Allows users to:
 * - Listen to both versions simultaneously or separately
 * - See settings differences
 * - Pick a winner
 */

import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Play,
  Pause,
  SkipBack,
  Volume2,
  VolumeX,
  Zap,
  Sliders,
  CheckCircle,
  Trophy,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface AudioOutput {
  id: string;
  fileName: string;
  filePath: string;
  durationSeconds?: number;
}

interface ComparisonRun {
  runNumber: number;
  workflowMode: 'automatic' | 'fine_tuned';
  createdAt: string;
  audioOutputs: AudioOutput[];
}

interface RunComparisonProps {
  open: boolean;
  onClose: () => void;
  runA: ComparisonRun | null;
  runB: ComparisonRun | null;
  onSelectWinner?: (runNumber: number) => void;
}

const modeConfig = {
  automatic: { icon: Zap, label: 'Automatic', color: 'text-amber-500 bg-amber-100 dark:bg-amber-900/30' },
  fine_tuned: { icon: Sliders, label: 'Fine-Tuned', color: 'text-violet-500 bg-violet-100 dark:bg-violet-900/30' },
};

function AudioPlayerPanel({
  label,
  run,
  audioRef,
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  isMuted,
  onToggleMute,
  isWinner,
  onSelectWinner,
}: {
  label: string;
  run: ComparisonRun;
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isWinner: boolean;
  onSelectWinner: () => void;
}) {
  const ModeIcon = modeConfig[run.workflowMode].icon;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className={cn(
      'flex-1 transition-all',
      isWinner && 'ring-2 ring-green-500 bg-green-50/50 dark:bg-green-900/10'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="text-muted-foreground">{label}</span>
            Run #{run.runNumber}
          </CardTitle>
          {isWinner && (
            <Badge className="bg-green-500 gap-1">
              <Trophy className="w-3 h-3" />
              Winner
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className={cn('gap-1', modeConfig[run.workflowMode].color)}>
            <ModeIcon className="w-3 h-3" />
            {modeConfig[run.workflowMode].label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {format(new Date(run.createdAt), 'MMM d, h:mm a')}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hidden audio element */}
        <audio
          ref={audioRef}
          src={run.audioOutputs[0]?.filePath}
          muted={isMuted}
        />

        {/* Waveform / Progress */}
        <div className="space-y-2">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={([value]) => onSeek(value)}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onSeek(0)}
          >
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button
            variant="default"
            size="icon"
            className="w-12 h-12 rounded-full"
            onClick={onPlayPause}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMute}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Select Winner Button */}
        {!isWinner && (
          <Button
            variant="outline"
            className="w-full"
            onClick={onSelectWinner}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Select as Winner
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function RunComparison({
  open,
  onClose,
  runA,
  runB,
  onSelectWinner,
}: RunComparisonProps) {
  const audioRefA = useRef<HTMLAudioElement>(null);
  const audioRefB = useRef<HTMLAudioElement>(null);

  const [isPlayingA, setIsPlayingA] = useState(false);
  const [isPlayingB, setIsPlayingB] = useState(false);
  const [currentTimeA, setCurrentTimeA] = useState(0);
  const [currentTimeB, setCurrentTimeB] = useState(0);
  const [durationA, setDurationA] = useState(0);
  const [durationB, setDurationB] = useState(0);
  const [isMutedA, setIsMutedA] = useState(false);
  const [isMutedB, setIsMutedB] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const [syncPlayback, setSyncPlayback] = useState(false);

  // Update time tracking
  useEffect(() => {
    const audioA = audioRefA.current;
    const audioB = audioRefB.current;

    const handleTimeUpdateA = () => setCurrentTimeA(audioA?.currentTime || 0);
    const handleTimeUpdateB = () => setCurrentTimeB(audioB?.currentTime || 0);
    const handleLoadedA = () => setDurationA(audioA?.duration || 0);
    const handleLoadedB = () => setDurationB(audioB?.duration || 0);
    const handleEndedA = () => setIsPlayingA(false);
    const handleEndedB = () => setIsPlayingB(false);

    audioA?.addEventListener('timeupdate', handleTimeUpdateA);
    audioB?.addEventListener('timeupdate', handleTimeUpdateB);
    audioA?.addEventListener('loadedmetadata', handleLoadedA);
    audioB?.addEventListener('loadedmetadata', handleLoadedB);
    audioA?.addEventListener('ended', handleEndedA);
    audioB?.addEventListener('ended', handleEndedB);

    return () => {
      audioA?.removeEventListener('timeupdate', handleTimeUpdateA);
      audioB?.removeEventListener('timeupdate', handleTimeUpdateB);
      audioA?.removeEventListener('loadedmetadata', handleLoadedA);
      audioB?.removeEventListener('loadedmetadata', handleLoadedB);
      audioA?.removeEventListener('ended', handleEndedA);
      audioB?.removeEventListener('ended', handleEndedB);
    };
  }, [open]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setWinner(null);
      setIsPlayingA(false);
      setIsPlayingB(false);
      setCurrentTimeA(0);
      setCurrentTimeB(0);
    }
  }, [open]);

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      audioRefA.current?.pause();
      audioRefB.current?.pause();
    }
  }, [open]);

  const handlePlayPauseA = () => {
    const audio = audioRefA.current;
    if (!audio) return;

    if (isPlayingA) {
      audio.pause();
      if (syncPlayback) audioRefB.current?.pause();
    } else {
      audio.play();
      if (syncPlayback) {
        audioRefB.current!.currentTime = audio.currentTime;
        audioRefB.current?.play();
      }
    }
    setIsPlayingA(!isPlayingA);
    if (syncPlayback) setIsPlayingB(!isPlayingA);
  };

  const handlePlayPauseB = () => {
    const audio = audioRefB.current;
    if (!audio) return;

    if (isPlayingB) {
      audio.pause();
      if (syncPlayback) audioRefA.current?.pause();
    } else {
      audio.play();
      if (syncPlayback) {
        audioRefA.current!.currentTime = audio.currentTime;
        audioRefA.current?.play();
      }
    }
    setIsPlayingB(!isPlayingB);
    if (syncPlayback) setIsPlayingA(!isPlayingB);
  };

  const handleSeekA = (time: number) => {
    if (audioRefA.current) {
      audioRefA.current.currentTime = time;
      if (syncPlayback && audioRefB.current) {
        audioRefB.current.currentTime = time;
      }
    }
  };

  const handleSeekB = (time: number) => {
    if (audioRefB.current) {
      audioRefB.current.currentTime = time;
      if (syncPlayback && audioRefA.current) {
        audioRefA.current.currentTime = time;
      }
    }
  };

  const handleSelectWinner = (runNumber: number) => {
    setWinner(runNumber);
    onSelectWinner?.(runNumber);
  };

  if (!runA || !runB) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Compare Runs
            <Badge variant="outline">A/B Test</Badge>
          </DialogTitle>
          <DialogDescription>
            Listen to both versions and pick your favorite
          </DialogDescription>
        </DialogHeader>

        {/* Sync Toggle */}
        <div className="flex items-center justify-center gap-2 py-2">
          <Button
            variant={syncPlayback ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSyncPlayback(!syncPlayback)}
          >
            {syncPlayback ? 'Synced Playback On' : 'Enable Synced Playback'}
          </Button>
          {syncPlayback && (
            <span className="text-xs text-muted-foreground">
              Both tracks play/pause together
            </span>
          )}
        </div>

        {/* Side by Side Players */}
        <div className="grid grid-cols-2 gap-4">
          <AudioPlayerPanel
            label="A"
            run={runA}
            audioRef={audioRefA}
            isPlaying={isPlayingA}
            currentTime={currentTimeA}
            duration={durationA}
            onPlayPause={handlePlayPauseA}
            onSeek={handleSeekA}
            isMuted={isMutedA}
            onToggleMute={() => setIsMutedA(!isMutedA)}
            isWinner={winner === runA.runNumber}
            onSelectWinner={() => handleSelectWinner(runA.runNumber)}
          />
          <AudioPlayerPanel
            label="B"
            run={runB}
            audioRef={audioRefB}
            isPlaying={isPlayingB}
            currentTime={currentTimeB}
            duration={durationB}
            onPlayPause={handlePlayPauseB}
            onSeek={handleSeekB}
            isMuted={isMutedB}
            onToggleMute={() => setIsMutedB(!isMutedB)}
            isWinner={winner === runB.runNumber}
            onSelectWinner={() => handleSelectWinner(runB.runNumber)}
          />
        </div>

        {/* Winner Announcement */}
        {winner && (
          <div className="flex items-center justify-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <Trophy className="w-5 h-5 text-green-500" />
            <span className="font-medium">
              Run #{winner} selected as the winner!
            </span>
          </div>
        )}

        {/* Close Button */}
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default RunComparison;
