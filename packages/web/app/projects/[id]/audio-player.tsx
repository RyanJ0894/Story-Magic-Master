'use client';

import { useState, useRef } from 'react';

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
    const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
    setProgress(progress || 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const time = (parseFloat(e.target.value) / 100) * audioRef.current.duration;
    audioRef.current.currentTime = time;
    setProgress(parseFloat(e.target.value));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentOutput) {
    return <p className="text-gray-500">No audio available</p>;
  }

  // Construct the download URL
  const audioUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${currentOutput.file_path}`;

  return (
    <div className="space-y-4">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Player Controls */}
      <div className="flex items-center gap-4 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg">
        <button
          onClick={togglePlayPause}
          className="w-12 h-12 flex items-center justify-center bg-brand-600 text-white rounded-full hover:bg-brand-700 transition"
        >
          {isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <div className="flex-1">
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={handleSeek}
            className="w-full h-2 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>
              {audioRef.current ? formatTime(audioRef.current.currentTime) : '0:00'}
            </span>
            <span>
              {audioRef.current && audioRef.current.duration
                ? formatTime(audioRef.current.duration)
                : currentOutput.duration_seconds
                ? formatTime(currentOutput.duration_seconds)
                : '--:--'}
            </span>
          </div>
        </div>
      </div>

      {/* Download Button */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {currentOutput.file_name}
        </span>
        <a
          href={audioUrl}
          download={currentOutput.file_name}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition text-sm font-medium"
        >
          Download MP3
        </a>
      </div>

      {/* Track List (if multiple outputs) */}
      {outputs.length > 1 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="text-sm font-medium mb-2">All Outputs</h4>
          <div className="space-y-2">
            {outputs.map((output, index) => (
              <button
                key={output.id}
                onClick={() => {
                  setCurrentTrack(index);
                  setIsPlaying(false);
                  setProgress(0);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg transition ${
                  index === currentTrack
                    ? 'bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span className="text-sm">{output.file_name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
