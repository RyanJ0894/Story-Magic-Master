'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, Pause, Download, Music } from 'lucide-react';

interface AudioOutput {
  id: string;
  file_name: string;
  file_path: string;
  duration_seconds?: number;
  format: string;
}

interface AudioPlayerProps {
  outputs: AudioOutput[];
}

export default function AudioPlayer({ outputs }: AudioPlayerProps) {
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const currentOutput = outputs[currentTrack];

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
    if (!audioRef.current) return;
    const progressPercent = (audioRef.current.currentTime / audioRef.current.duration) * 100;
    setProgress(progressPercent || 0);
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const time = percentage * audioRef.current.duration;
    audioRef.current.currentTime = time;
    setProgress(percentage * 100);
  };

  const formatTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentOutput) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-500">
        <Music className="w-5 h-5 mr-2" />
        No audio available
      </div>
    );
  }

  // Construct the download URL
  const audioUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${currentOutput.file_path}`;

  return (
    <div className="space-y-4">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Player Controls */}
      <Card className="p-4" data-testid="audio-player">
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlayPause}
            className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-full hover:from-violet-600 hover:to-purple-700 transition-all shadow-lg shadow-violet-500/25"
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
              onClick={handleSeek}
              className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full cursor-pointer overflow-hidden"
            >
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-full transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
            {/* Time display */}
            <div className="flex justify-between text-xs text-slate-500">
              <span>{formatTime(currentTime)}</span>
              <span>
                {duration
                  ? formatTime(duration)
                  : currentOutput.duration_seconds
                  ? formatTime(currentOutput.duration_seconds)
                  : '--:--'}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Download Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Music className="w-4 h-4" />
          <span>{currentOutput.file_name}</span>
        </div>
        <Button variant="outline" size="sm" asChild data-testid="download-button">
          <a href={audioUrl} download={currentOutput.file_name}>
            <Download className="w-4 h-4 mr-2" />
            Download
          </a>
        </Button>
      </div>

      {/* Track List (if multiple outputs) */}
      {outputs.length > 1 && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
          <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-3">All Outputs</h4>
          <div className="space-y-1">
            {outputs.map((output, index) => (
              <button
                key={output.id}
                onClick={() => {
                  setCurrentTrack(index);
                  setIsPlaying(false);
                  setProgress(0);
                  setCurrentTime(0);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition text-left ${
                  index === currentTrack
                    ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className={`w-8 h-8 flex items-center justify-center rounded-full ${
                  index === currentTrack
                    ? 'bg-violet-500 text-white'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}>
                  {index === currentTrack && isPlaying ? (
                    <Pause className="w-3 h-3" />
                  ) : (
                    <Play className="w-3 h-3 ml-0.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm truncate block">{output.file_name}</span>
                  {output.duration_seconds && (
                    <span className="text-xs text-slate-500">
                      {formatTime(output.duration_seconds)}
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
