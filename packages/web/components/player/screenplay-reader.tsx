'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ThumbsUp,
  ThumbsDown,
  Clock,
  StickyNote,
  X,
  Send,
  Trash2,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { resolveAudioUrl } from '@/lib/resolve-audio-url';
import { apiFetch } from '@/lib/api/fetch';
import { useToast } from '@/hooks/use-toast';

// =============================================================================
// Types
// =============================================================================

interface DialogueLine {
  line_id: string;
  character: string;
  text: string;
  voice_key?: string;
  start_time?: number;
  end_time?: number;
}

interface Scene {
  scene_id?: string;
  scene_header?: string;
  dialogue: DialogueLine[];
}

interface ProjectNote {
  id: string;
  noteText: string;
  lineId: string | null;
  timestamp: number | null;
  createdAt: string;
}

interface AudioOutput {
  id: string;
  fileName: string;
  filePath: string;
  durationSeconds?: number;
  format?: string;
}

export interface ScreenplayReaderProps {
  projectId: string;
  projectName: string;
  audioOutputs: AudioOutput[];
  scenes: Scene[];
  initialReadStatus: 'like' | 'pass' | 'undecided';
  initialNotes: ProjectNote[];
  entryId: string | null;   // ReaderLibrary entry id (null if project owner viewing)
  teamId: string | null;    // Team context for activity logging (null if project owner)
  orchestratorUrl: string;
  isOwner: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// =============================================================================
// Component
// =============================================================================

export function ScreenplayReader({
  projectId,
  projectName,
  audioOutputs,
  scenes,
  initialReadStatus,
  initialNotes,
  entryId,
  teamId,
  orchestratorUrl,
  isOwner,
}: ScreenplayReaderProps) {
  const { toast } = useToast();
  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);

  // Enterprise state
  const [readStatus, setReadStatus] = useState<'like' | 'pass' | 'undecided'>(initialReadStatus);
  const [notes, setNotes] = useState<ProjectNote[]>(initialNotes);
  const [noteInput, setNoteInput] = useState('');
  const [notingLineId, setNotingLineId] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  // Tracking
  const hasLoggedStart = useRef(false);
  const savePositionTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const timingMap = useRef<Map<string, { start: number; end: number }>>(new Map());

  const currentOutput = audioOutputs[0];
  const audioUrl = currentOutput ? resolveAudioUrl(currentOutput.filePath) : '';

  // Build timing map from scene data
  useEffect(() => {
    timingMap.current.clear();
    if (scenes.length === 0) return;

    const totalChars = scenes.reduce(
      (acc, scene) => acc + scene.dialogue.reduce((a, line) => a + line.text.length, 0),
      0
    );
    const estimatedDuration = duration || currentOutput?.durationSeconds || 60;
    const charsPerSecond = totalChars / Math.max(estimatedDuration, 1);

    let offset = 0;
    scenes.forEach((scene) => {
      scene.dialogue.forEach((line) => {
        const lineDuration = line.text.length / charsPerSecond;
        timingMap.current.set(line.line_id, { start: offset, end: offset + lineDuration });
        offset += lineDuration;
      });
    });
  }, [scenes, duration, currentOutput]);

  // Auto-scroll to active line
  useEffect(() => {
    if (activeLineRef.current && isPlaying) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLineId, isPlaying]);

  // Periodic position save
  useEffect(() => {
    if (!entryId) return;
    savePositionTimer.current = setInterval(() => {
      if (isPlaying && audioRef.current) {
        fetch(`/api/reader/library/${entryId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ play_position_seconds: Math.floor(audioRef.current.currentTime) }),
        }).catch(() => {});
      }
    }, 15000);
    return () => {
      if (savePositionTimer.current) clearInterval(savePositionTimer.current);
    };
  }, [entryId, isPlaying]);

  // ---------------------------------------------------------------------------
  // Activity logging
  // ---------------------------------------------------------------------------

  const logActivity = useCallback(
    async (eventType: string, metadata?: Record<string, unknown>) => {
      if (!teamId || isOwner) return;
      try {
        await fetch(`/api/teams/${teamId}/activity`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, eventType, metadata: metadata ?? {} }),
        });
      } catch {
        // non-critical
      }
    },
    [teamId, projectId, isOwner]
  );

  // ---------------------------------------------------------------------------
  // Audio controls
  // ---------------------------------------------------------------------------

  const updateActiveLine = useCallback((time: number) => {
    let found: string | null = null;
    for (const [lineId, timing] of timingMap.current.entries()) {
      if (time >= timing.start && time < timing.end) {
        found = lineId;
        break;
      }
    }
    setActiveLineId(found);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying((p) => !p);
  }, [isPlaying]);

  const handleTimeUpdate = () => {
    if (!audioRef.current || isDragging) return;
    const pct = (audioRef.current.currentTime / audioRef.current.duration) * 100;
    setProgress(pct || 0);
    setCurrentTime(audioRef.current.currentTime);
    updateActiveLine(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const seekTo = useCallback((pct: number) => {
    if (!audioRef.current) return;
    const clamped = Math.max(0, Math.min(1, pct));
    audioRef.current.currentTime = clamped * audioRef.current.duration;
    setProgress(clamped * 100);
    setCurrentTime(clamped * audioRef.current.duration);
  }, []);

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    setIsDragging(true);
    const rect = progressRef.current.getBoundingClientRect();
    seekTo((e.clientX - rect.left) / rect.width);

    const onMove = (ev: MouseEvent) => {
      if (!progressRef.current) return;
      const r = progressRef.current.getBoundingClientRect();
      seekTo((ev.clientX - r.left) / r.width);
    };
    const onUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleProgressTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    setIsDragging(true);
    const rect = progressRef.current.getBoundingClientRect();
    seekTo((e.touches[0].clientX - rect.left) / rect.width);

    const onMove = (ev: TouchEvent) => {
      if (!progressRef.current) return;
      const r = progressRef.current.getBoundingClientRect();
      seekTo((ev.touches[0].clientX - r.left) / r.width);
    };
    const onEnd = () => {
      setIsDragging(false);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd);
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

  const handlePlay = () => {
    setIsPlaying(true);
    if (!hasLoggedStart.current) {
      hasLoggedStart.current = true;
      logActivity('listen_start');
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    logActivity('listen_complete');
    if (entryId) {
      fetch(`/api/reader/library/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      }).catch(() => {});
    }
  };

  // ---------------------------------------------------------------------------
  // Decisions (Like / Pass / Undecided)
  // ---------------------------------------------------------------------------

  const updateReadStatus = async (newStatus: 'like' | 'pass' | 'undecided') => {
    if (isOwner || statusSaving) return;
    const prev = readStatus;
    setReadStatus(newStatus);
    setStatusSaving(true);

    try {
      if (entryId) {
        await fetch(`/api/reader/library/${entryId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ readStatus: newStatus }),
        });
      }
      // Map to activity event type
      const eventMap: Record<string, string> = { like: 'liked', pass: 'passed', undecided: 'undecided' };
      await logActivity(eventMap[newStatus]);
    } catch {
      setReadStatus(prev);
    } finally {
      setStatusSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Notes
  // ---------------------------------------------------------------------------

  const openNoteFor = (lineId: string) => {
    setNotingLineId(lineId);
    setNoteInput('');
  };

  const cancelNote = () => {
    setNotingLineId(null);
    setNoteInput('');
  };

  const submitNote = async () => {
    if (!noteInput.trim() || savingNote) return;
    setSavingNote(true);

    const timing = notingLineId ? timingMap.current.get(notingLineId) : null;

    try {
      // apiFetch sets X-Requested-With so CSRF passes even when the browser
      // strips Origin/Referer headers. Raw fetch was the root cause of #211's
      // 404/403 silent failures.
      const res = await apiFetch(`/api/projects/${projectId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteText: noteInput.trim(),
          lineId: notingLineId ?? undefined,
          timestamp: timing ? Math.floor(timing.start) : undefined,
        }),
      });

      if (res.ok) {
        const note = await res.json() as ProjectNote;
        setNotes((prev) => [...prev, note]);
        cancelNote();
        await logActivity('note_added', { noteSnippet: noteInput.trim().slice(0, 100) });
      } else {
        // Surface the failure — silent drop was #211's debugging nightmare.
        toast({
          title: 'Could not save note',
          description: `Server returned ${res.status}. Please try again.`,
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Could not save note',
        description: err instanceof Error ? err.message : 'Network error',
        variant: 'destructive',
      });
    } finally {
      setSavingNote(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    const prev = notes;
    setNotes((n) => n.filter((note) => note.id !== noteId));
    try {
      const res = await apiFetch(`/api/projects/${projectId}/notes?noteId=${noteId}`, { method: 'DELETE' });
      if (!res.ok) {
        setNotes(prev);
        toast({
          title: 'Could not delete note',
          description: `Server returned ${res.status}.`,
          variant: 'destructive',
        });
      }
    } catch {
      setNotes(prev);
      toast({
        title: 'Could not delete note',
        description: 'Network error.',
        variant: 'destructive',
      });
    }
  };

  const notesForLine = (lineId: string) => notes.filter((n) => n.lineId === lineId);

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        togglePlayPause();
      }
      if (e.key === 'm') { e.preventDefault(); setMuted((m) => !m); }
      if (e.key === 'ArrowRight' && e.shiftKey) {
        e.preventDefault();
        if (audioRef.current) {
          audioRef.current.currentTime = Math.min(audioRef.current.currentTime + 10, audioRef.current.duration);
        }
      }
      if (e.key === 'ArrowLeft' && e.shiftKey) {
        e.preventDefault();
        if (audioRef.current) {
          audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 10, 0);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlayPause]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
  }, [volume, muted]);

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={isOwner ? `/projects/${projectId}` : '/reader/dashboard'}>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ChevronLeft className="w-4 h-4" />
                {isOwner ? 'Project' : 'Library'}
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-1.5 hidden sm:inline-flex">
                Dashboard
              </Button>
            </Link>
            <span className="text-sm font-semibold truncate">{projectName}</span>
          </div>

          {/* Decision Bar */}
          {!isOwner && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:block">Your decision:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateReadStatus('like')}
                  disabled={statusSaving}
                  aria-label="Like"
                  aria-pressed={readStatus === 'like'}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    readStatus === 'like'
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 ring-2 ring-green-500'
                      : 'bg-muted hover:bg-green-50 dark:hover:bg-green-900/20 text-muted-foreground hover:text-green-600'
                  )}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  Like
                </button>
                <button
                  onClick={() => updateReadStatus('undecided')}
                  disabled={statusSaving}
                  aria-label="Undecided"
                  aria-pressed={readStatus === 'undecided'}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    readStatus === 'undecided'
                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500'
                      : 'bg-muted hover:bg-amber-50 dark:hover:bg-amber-900/20 text-muted-foreground hover:text-amber-600'
                  )}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Undecided
                </button>
                <button
                  onClick={() => updateReadStatus('pass')}
                  disabled={statusSaving}
                  aria-label="Dislike"
                  aria-pressed={readStatus === 'pass'}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    readStatus === 'pass'
                      ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 ring-2 ring-red-500'
                      : 'bg-muted hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-600'
                  )}
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                  Dislike
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={handlePlay}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
      />

      {/* Main layout: script left, player/notes right on desktop */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 flex flex-col lg:flex-row gap-6">

        {/* Script Panel */}
        <div className="flex-1 min-w-0">
          <Card className="h-full">
            <ScrollArea className="h-[calc(100vh-220px)]">
              <div className="p-6 space-y-8 font-mono text-sm">
                {scenes.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No screenplay data available.</p>
                ) : (
                  scenes.map((scene, si) => (
                    <div key={scene.scene_id ?? si} className="space-y-4">
                      {scene.scene_header && (
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-2">
                          {scene.scene_header}
                        </p>
                      )}
                      {scene.dialogue.map((line) => {
                        const isActive = activeLineId === line.line_id;
                        const lineNotes = notesForLine(line.line_id);
                        const isAddingNote = notingLineId === line.line_id;

                        return (
                          <div key={line.line_id} className="group">
                            {/* Dialogue line */}
                            <div
                              ref={isActive ? activeLineRef : null}
                              aria-current={isActive ? 'true' : undefined}
                              className={cn(
                                'relative p-3 rounded-lg transition-all',
                                isActive
                                  ? 'bg-violet-100 dark:bg-violet-900/30 ring-2 ring-violet-500'
                                  : 'hover:bg-muted/60'
                              )}
                            >
                              <div className="flex items-start gap-4">
                                {/* Seek-to-line button */}
                                <button
                                  onClick={() => seekToLine(line.line_id)}
                                  aria-label={`Jump to ${line.character}`}
                                  className="shrink-0 text-center w-28"
                                >
                                  <span className={cn(
                                    'text-xs font-bold uppercase',
                                    isActive ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground group-hover:text-foreground'
                                  )}>
                                    {line.character}
                                  </span>
                                </button>
                                <p className={cn(
                                  'flex-1 leading-relaxed',
                                  isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
                                )}>
                                  {line.text}
                                </p>
                                {/* Add note button — visible on hover */}
                                {!isOwner && (
                                  <button
                                    onClick={() => openNoteFor(line.line_id)}
                                    aria-label="Add note to this line"
                                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-opacity shrink-0"
                                  >
                                    <StickyNote className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Existing notes for this line */}
                            {lineNotes.length > 0 && (
                              <div className="ml-32 mt-1 space-y-1">
                                {lineNotes.map((note) => (
                                  <div key={note.id} className="flex items-start gap-2 text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5">
                                    <StickyNote className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                                    <span className="flex-1 text-amber-800 dark:text-amber-200">{note.noteText}</span>
                                    {!isOwner && (
                                      <button
                                        onClick={() => deleteNote(note.id)}
                                        aria-label="Delete note"
                                        className="text-amber-400 hover:text-red-500 transition-colors"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Inline note input */}
                            {isAddingNote && (
                              <div className="ml-32 mt-2 space-y-2">
                                <Textarea
                                  value={noteInput}
                                  onChange={(e) => setNoteInput(e.target.value)}
                                  placeholder="Add a note about this line…"
                                  className="text-xs min-h-[60px] resize-none"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                      e.preventDefault();
                                      submitNote();
                                    }
                                    if (e.key === 'Escape') cancelNote();
                                  }}
                                />
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    onClick={submitNote}
                                    disabled={!noteInput.trim() || savingNote}
                                    className="h-7 text-xs gap-1.5"
                                  >
                                    <Send className="w-3 h-3" />
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={cancelNote}
                                    className="h-7 text-xs gap-1.5"
                                  >
                                    <X className="w-3 h-3" />
                                    Cancel
                                  </Button>
                                  <span className="text-xs text-muted-foreground">⌘↵ to save</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* Right Panel: Player + Notes Summary */}
        <div className="w-full lg:w-72 space-y-4 shrink-0">
          {/* Audio Player */}
          <Card className="p-4">
            <div className="space-y-3">
              {/* Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 10, 0);
                    }
                  }}
                  aria-label="Skip back 10s"
                  className="p-2 rounded-full hover:bg-accent"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={togglePlayPause}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-full hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/25"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>
                <button
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.currentTime = Math.min(audioRef.current.currentTime + 10, audioRef.current.duration);
                    }
                  }}
                  aria-label="Skip forward 10s"
                  className="p-2 rounded-full hover:bg-accent"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>

              {/* Progress Bar */}
              <div>
                <div
                  ref={progressRef}
                  role="slider"
                  tabIndex={0}
                  aria-label="Seek"
                  aria-valuemin={0}
                  aria-valuemax={Math.round(duration)}
                  aria-valuenow={Math.round(currentTime)}
                  onMouseDown={handleProgressMouseDown}
                  onTouchStart={handleProgressTouchStart}
                  className="h-2 bg-muted rounded-full cursor-pointer overflow-hidden"
                >
                  <div
                    className="h-full brand-gradient-bar rounded-full transition-all duration-100 pointer-events-none"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration || currentOutput?.durationSeconds || 0)}</span>
                </div>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMuted((m) => !m)}
                  aria-label={muted ? 'Unmute' : 'Mute'}
                  className="p-1 rounded hover:bg-accent"
                >
                  {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={muted ? 0 : Math.round(volume * 100)}
                  onChange={(e) => {
                    setVolume(Number(e.target.value) / 100);
                    setMuted(false);
                  }}
                  aria-label="Volume"
                  className="flex-1 h-1 accent-violet-500"
                />
              </div>
            </div>
          </Card>

          {/* Now Playing */}
          {activeLineId && (
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Now Playing</p>
              {scenes.flatMap((s) => s.dialogue).filter((l) => l.line_id === activeLineId).map((line) => (
                <div key={line.line_id}>
                  <p className="text-xs font-bold uppercase text-violet-600 dark:text-violet-400">{line.character}</p>
                  <p className="text-sm mt-1 leading-relaxed">&ldquo;{line.text}&rdquo;</p>
                </div>
              ))}
            </Card>
          )}

          {/* Notes Summary */}
          {notes.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <StickyNote className="w-4 h-4 text-amber-500" />
                <p className="text-xs font-medium">Your Notes</p>
                <Badge variant="secondary" className="text-xs ml-auto">{notes.length}</Badge>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {notes.map((note) => (
                  <div key={note.id} className="text-xs text-muted-foreground p-2 rounded bg-muted/50">
                    {note.noteText}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Keyboard shortcuts hint */}
          <div className="text-xs text-muted-foreground space-y-1 px-1">
            <p><kbd className="bg-muted px-1 rounded">Space</kbd> Play / Pause</p>
            <p><kbd className="bg-muted px-1 rounded">M</kbd> Mute</p>
            <p><kbd className="bg-muted px-1 rounded">⇧→</kbd> / <kbd className="bg-muted px-1 rounded">⇧←</kbd> Skip 10s</p>
          </div>
        </div>
      </div>
    </div>
  );
}
