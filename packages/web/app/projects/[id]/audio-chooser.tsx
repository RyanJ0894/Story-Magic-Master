'use client';

/**
 * AudioChooser - Scene-level audio override UI
 *
 * Displays AI-selected music, ambience, and SFX per scene from director_json.
 * Users can browse alternative tracks (scored by semantic fit) and override selections.
 * Overrides persist to the database and are applied during generation.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api/fetch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import {
  Music,
  TreePine,
  Zap,
  Play,
  Pause,
  Lock,
  Unlock,
  ArrowRightLeft,
  Plus,
  X,
  Search,
  Loader2,
  Volume2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CopyCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  AudioCategory,
  AudioOverride,
  AudioTrackMetadata,
  ScoredAudioTrack,
  SceneContext,
  MatchLabel,
} from '@/lib/types/audio';
import { getTracksByCategory, getTrackById, getUniqueGroups, getUniqueMoods } from '@/lib/audio-catalog';
import { getScoredTracks } from '@/lib/audio-scoring';
import { PreviewButton } from './preview-button';

// =============================================================================
// Types
// =============================================================================

interface AudioChooserProps {
  projectId: string;
  directorJson?: {
    scenes?: Array<{
      scene_id: string;
      summary?: string;
      mood?: string;
      intensity?: number;
      setting?: string;
      music?: Array<{ file: string; reasoning?: string }>;
      ambience?: Array<{ file: string; reasoning?: string }>;
      sfx?: Array<{ file: string; reasoning?: string }>;
      dialogue?: Array<{ character?: string; text?: string }>;
    }>;
  };
  disabled?: boolean;
  remainingPreviews?: number;
  onRemainingPreviewsChanged?: (remaining: number) => void;
}

interface SelectionDialogState {
  open: boolean;
  sceneId: string;
  category: AudioCategory;
  cueIndex: number;
  sceneMood?: string;
  sceneSummary?: string;
  sceneIntensity?: number;
}

// =============================================================================
// Constants
// =============================================================================

const CATEGORY_CONFIG: Record<AudioCategory, {
  label: string;
  icon: typeof Music;
  color: string;
  bgColor: string;
}> = {
  music: { label: 'Music', icon: Music, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  ambience: { label: 'Ambience', icon: TreePine, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  sfx: { label: 'SFX', icon: Zap, color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
};

const MATCH_LABEL_COLORS: Record<MatchLabel, string> = {
  Excellent: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Good: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Fair: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  Low: 'bg-muted text-muted-foreground',
};

// =============================================================================
// Audio Preview Hook
// =============================================================================

function useAudioPreview() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const play = useCallback((trackId: string, file: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playingId === trackId) {
      setPlayingId(null);
      return;
    }

    const audio = new Audio(`/api/audio-preview/${file}`);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
    audio.play().catch(() => setPlayingId(null));
    audioRef.current = audio;
    setPlayingId(trackId);
  }, [playingId]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return { playingId, play, stop };
}

// =============================================================================
// Match Score Badge
// =============================================================================

function MatchBadge({ label, score }: { label: MatchLabel; score: number }) {
  return (
    <Badge variant="outline" className={cn('text-xs', MATCH_LABEL_COLORS[label])}>
      {label} ({Math.round(score * 100)}%)
    </Badge>
  );
}

// =============================================================================
// Audio Track Card (inline display of current selection)
// =============================================================================

function AudioTrackCard({
  file,
  category,
  cueIndex,
  override,
  sceneContext,
  onChangeClick,
  onLockToggle,
  onRemove,
  disabled,
}: {
  file: string;
  category: AudioCategory;
  cueIndex: number;
  override?: AudioOverride;
  sceneContext: SceneContext;
  onChangeClick: () => void;
  onLockToggle: () => void;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  const { playingId, play } = useAudioPreview();

  // Resolve track metadata from catalog
  const trackId = override?.track_id || file.split('/').pop()?.replace(/\.mp3$/, '') || '';
  const track = getTrackById(trackId);
  const title = override?.title || track?.title || trackId;
  const isLocked = override?.locked || false;
  const isUserSelected = override?.user_selected || false;

  // Score the current track
  const scoredTrack = useMemo(() => {
    if (!track) return null;
    const tracks = getTracksByCategory(category);
    const scored = getScoredTracks(tracks, sceneContext, category);
    return scored.find(s => s.track.id === track.id) || null;
  }, [track, category, sceneContext]);

  const config = CATEGORY_CONFIG[category];
  const Icon = config.icon;

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg border',
      isUserSelected ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20' : 'border-border',
    )}>
      <button
        type="button"
        onClick={() => play(trackId, file)}
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          config.bgColor,
        )}
      >
        {playingId === trackId ? (
          <Pause className={cn('w-4 h-4', config.color)} />
        ) : (
          <Play className={cn('w-4 h-4', config.color)} />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{title}</span>
          {isUserSelected && (
            <Badge variant="outline" className="text-xs border-blue-300 text-blue-600 dark:text-blue-400">
              Custom
            </Badge>
          )}
          {scoredTrack && (
            <MatchBadge label={scoredTrack.matchLabel} score={scoredTrack.score} />
          )}
        </div>
        {track && (
          <p className="text-xs text-muted-foreground truncate">
            {track.group} &middot; {track.style}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onLockToggle}
          disabled={disabled}
          className="h-8 w-8 p-0"
          title={isLocked ? 'Unlock (AI can change)' : 'Lock (prevent AI changes)'}
        >
          {isLocked ? (
            <Lock className="w-3.5 h-3.5 text-amber-500" />
          ) : (
            <Unlock className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onChangeClick}
          disabled={disabled}
          className="h-8"
        >
          <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />
          Change
        </Button>

        {onRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={disabled}
            className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Audio Category Section (within a scene card)
// =============================================================================

function AudioCategorySection({
  category,
  cues,
  sceneId,
  sceneContext,
  overrides,
  onChangeClick,
  onLockToggle,
  onRemoveCue,
  onAddCue,
  disabled,
}: {
  category: AudioCategory;
  cues: Array<{ file: string; reasoning?: string }>;
  sceneId: string;
  sceneContext: SceneContext;
  overrides: AudioOverride[];
  onChangeClick: (cueIndex: number) => void;
  onLockToggle: (cueIndex: number) => void;
  onRemoveCue?: (cueIndex: number) => void;
  onAddCue?: () => void;
  disabled?: boolean;
}) {
  const config = CATEGORY_CONFIG[category];
  const Icon = config.icon;
  const isSfx = category === 'sfx';

  if (cues.length === 0 && !isSfx) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={cn('w-4 h-4', config.color)} />
        <span className="text-sm font-medium">{config.label}</span>
        {cues.length > 0 && (
          <span className="text-xs text-muted-foreground">({cues.length})</span>
        )}
      </div>

      {cues.map((cue, index) => {
        const override = overrides.find(
          o => o.scene_id === sceneId && o.category === category && o.cue_index === index
        );

        return (
          <AudioTrackCard
            key={`${sceneId}-${category}-${index}`}
            file={override?.file || cue.file}
            category={category}
            cueIndex={index}
            override={override}
            sceneContext={sceneContext}
            onChangeClick={() => onChangeClick(index)}
            onLockToggle={() => onLockToggle(index)}
            onRemove={isSfx ? () => onRemoveCue?.(index) : undefined}
            disabled={disabled}
          />
        );
      })}

      {cues.length === 0 && isSfx && (
        <p className="text-xs text-muted-foreground italic pl-6">No sound effects assigned</p>
      )}

      {isSfx && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddCue}
          disabled={disabled}
          className="ml-6 text-xs"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add SFX
        </Button>
      )}
    </div>
  );
}

// =============================================================================
// Scene Audio Card
// =============================================================================

function SceneAudioCard({
  scene,
  sceneIndex,
  overrides,
  onOpenDialog,
  onLockToggle,
  onRemoveCue,
  onAddCue,
  disabled,
  projectId,
  remainingPreviews,
  onRemainingPreviewsChanged,
  regeneratingScene,
  onRegenerateScene,
  isExpanded,
  onToggleExpand,
  onApplyToAll,
}: {
  scene: NonNullable<AudioChooserProps['directorJson']>['scenes'] extends (infer S)[] | undefined ? S : never;
  sceneIndex: number;
  overrides: AudioOverride[];
  onOpenDialog: (sceneId: string, category: AudioCategory, cueIndex: number) => void;
  onLockToggle: (sceneId: string, category: AudioCategory, cueIndex: number) => void;
  onRemoveCue: (sceneId: string, category: AudioCategory, cueIndex: number) => void;
  onAddCue: (sceneId: string, category: AudioCategory) => void;
  disabled?: boolean;
  projectId: string;
  remainingPreviews: number;
  onRemainingPreviewsChanged?: (remaining: number) => void;
  regeneratingScene: number | null;
  onRegenerateScene: (sceneIndex: number) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onApplyToAll: (fromSceneId: string) => void;
}) {
  const sceneId = scene.scene_id;
  const sceneOverrides = overrides.filter(o => o.scene_id === sceneId);

  const sceneContext: SceneContext = {
    scene_id: sceneId,
    summary: scene.summary,
    mood: scene.mood,
    intensity: scene.intensity,
    setting: scene.setting,
    action_keywords: scene.dialogue
      ?.slice(0, 5)
      .map(d => d.text || '')
      .filter(Boolean),
  };

  const overrideCount = sceneOverrides.filter(o => o.user_selected).length;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Clickable header — always visible */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <div className="min-w-0">
            <h4 className="font-medium text-sm">Scene {sceneIndex + 1}</h4>
            {!isExpanded && scene.summary && (
              <p className="text-xs text-muted-foreground truncate max-w-md">{scene.summary}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {scene.mood && (
            <Badge variant="secondary" className="text-xs">{scene.mood}</Badge>
          )}
          {overrideCount > 0 && (
            <Badge variant="outline" className="text-xs border-blue-300 text-blue-600">
              {overrideCount} override{overrideCount !== 1 ? 's' : ''}
            </Badge>
          )}
          {overrideCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onApplyToAll(sceneId)}
              disabled={disabled}
              className="h-7 text-xs px-2"
              title="Copy these audio selections to all scenes"
            >
              <CopyCheck className="w-3 h-3 mr-1" />
              Apply to all
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRegenerateScene(sceneIndex)}
            disabled={disabled || regeneratingScene !== null}
            className="h-7 text-xs"
            title="Regenerate this scene's audio"
          >
            {regeneratingScene === sceneIndex ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Regen…
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3 mr-1" />
                Regen
              </>
            )}
          </Button>
          <PreviewButton
            projectId={projectId}
            sceneId={scene.scene_id}
            sceneSummary={scene.summary}
            disabled={disabled}
            remainingPreviews={remainingPreviews}
            onRemainingChanged={onRemainingPreviewsChanged}
          />
        </div>
      </div>

      {/* Collapsible body */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/50">
          {scene.summary && (
            <p className="text-xs text-muted-foreground pt-2">{scene.summary}</p>
          )}
          <AudioCategorySection
            category="music"
            cues={scene.music || []}
            sceneId={sceneId}
            sceneContext={sceneContext}
            overrides={sceneOverrides}
            onChangeClick={(idx) => onOpenDialog(sceneId, 'music', idx)}
            onLockToggle={(idx) => onLockToggle(sceneId, 'music', idx)}
            disabled={disabled}
          />

          <AudioCategorySection
            category="ambience"
            cues={scene.ambience || []}
            sceneId={sceneId}
            sceneContext={sceneContext}
            overrides={sceneOverrides}
            onChangeClick={(idx) => onOpenDialog(sceneId, 'ambience', idx)}
            onLockToggle={(idx) => onLockToggle(sceneId, 'ambience', idx)}
            disabled={disabled}
          />

          <AudioCategorySection
            category="sfx"
            cues={scene.sfx || []}
            sceneId={sceneId}
            sceneContext={sceneContext}
            overrides={sceneOverrides}
            onChangeClick={(idx) => onOpenDialog(sceneId, 'sfx', idx)}
            onLockToggle={(idx) => onLockToggle(sceneId, 'sfx', idx)}
            onRemoveCue={(idx) => onRemoveCue(sceneId, 'sfx', idx)}
            onAddCue={() => onAddCue(sceneId, 'sfx')}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Audio Selection Dialog
// =============================================================================

function AudioSelectionDialog({
  state,
  onClose,
  onSelect,
}: {
  state: SelectionDialogState;
  onClose: () => void;
  onSelect: (track: AudioTrackMetadata) => void;
}) {
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [moodFilter, setMoodFilter] = useState<string>('all');
  const [intensityRange, setIntensityRange] = useState<[number, number]>([0, 100]);
  const { playingId, play, stop } = useAudioPreview();

  const config = CATEGORY_CONFIG[state.category];
  const allTracks = getTracksByCategory(state.category);
  const groups = getUniqueGroups(state.category);
  const moods = getUniqueMoods(state.category);

  const sceneContext: SceneContext = {
    scene_id: state.sceneId,
    mood: state.sceneMood,
    summary: state.sceneSummary,
    intensity: state.sceneIntensity,
  };

  // Score and filter tracks
  const scoredAndFiltered = useMemo(() => {
    const scored = getScoredTracks(allTracks, sceneContext, state.category);

    return scored.filter(({ track }) => {
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${track.title} ${track.group} ${track.style} ${track.mood.join(' ')} ${track.tags.join(' ')}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (groupFilter !== 'all' && track.group !== groupFilter) return false;
      if (moodFilter !== 'all' && !track.mood.includes(moodFilter)) return false;
      if (track.intensity < intensityRange[0] || track.intensity > intensityRange[1]) return false;
      return true;
    });
  }, [allTracks, sceneContext, state.category, search, groupFilter, moodFilter, intensityRange]);

  // Stop audio when dialog closes
  useEffect(() => {
    if (!state.open) stop();
  }, [state.open, stop]);

  return (
    <Dialog open={state.open} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <config.icon className={cn('w-5 h-5', config.color)} />
            Select {config.label} Track
          </DialogTitle>
          <DialogDescription>
            Browse and preview tracks. Sorted by match quality for this scene.
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="space-y-3 border-b pb-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tracks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="All Groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {groups.map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={moodFilter} onValueChange={setMoodFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="All Moods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Moods</SelectItem>
                {moods.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Intensity:</span>
              <Slider
                value={intensityRange}
                onValueChange={(v) => setIntensityRange(v as [number, number])}
                min={0}
                max={100}
                step={5}
                className="w-32"
              />
              <span>{intensityRange[0]}-{intensityRange[1]}</span>
            </div>
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-1 py-2">
            {scoredAndFiltered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No tracks match your filters. Try broadening your search.
              </p>
            )}
            {scoredAndFiltered.map(({ track, score, matchLabel }) => (
              <div
                key={track.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent group"
              >
                <button
                  type="button"
                  onClick={() => play(track.id, track.file)}
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                    config.bgColor,
                  )}
                >
                  {playingId === track.id ? (
                    <Pause className={cn('w-4 h-4', config.color)} />
                  ) : (
                    <Play className={cn('w-4 h-4', config.color)} />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{track.title}</span>
                    <MatchBadge label={matchLabel} score={score} />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {track.group} &middot; {track.style} &middot; Intensity {track.intensity}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelect(track)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-7 text-xs"
                >
                  Select
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="text-xs text-muted-foreground pt-2 border-t">
          {scoredAndFiltered.length} of {allTracks.length} tracks
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function AudioChooser({ projectId, directorJson, disabled, remainingPreviews: initialRemaining = 0, onRemainingPreviewsChanged }: AudioChooserProps) {
  const [remainingPreviews, setRemainingPreviews] = useState(initialRemaining);
  const [overrides, setOverrides] = useState<AudioOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regeneratingScene, setRegeneratingScene] = useState<number | null>(null);
  const [expandedScenes, setExpandedScenes] = useState<Set<number>>(new Set([0]));
  const [dialogState, setDialogState] = useState<SelectionDialogState>({
    open: false,
    sceneId: '',
    category: 'music',
    cueIndex: 0,
  });

  const scenes = directorJson?.scenes || [];

  // Load saved overrides
  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch(`/api/projects/${projectId}/audio-overrides`);
        if (res.ok) {
          const data = await res.json();
          setOverrides(data.overrides || []);
        }
      } catch {
        // ignore load errors
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  // Save overrides to API
  const saveOverrides = useCallback(async (newOverrides: AudioOverride[]) => {
    setOverrides(newOverrides);
    setSaving(true);
    try {
      await apiFetch(`/api/projects/${projectId}/audio-overrides`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: newOverrides }),
      });
    } catch {
      // ignore save errors silently
    } finally {
      setSaving(false);
    }
  }, [projectId]);

  // Open selection dialog
  const handleOpenDialog = useCallback((sceneId: string, category: AudioCategory, cueIndex: number) => {
    const scene = scenes.find(s => s.scene_id === sceneId);
    setDialogState({
      open: true,
      sceneId,
      category,
      cueIndex,
      sceneMood: scene?.mood,
      sceneSummary: scene?.summary,
      sceneIntensity: scene?.intensity,
    });
  }, [scenes]);

  // Handle track selection from dialog
  const handleSelectTrack = useCallback((track: AudioTrackMetadata) => {
    const { sceneId, category, cueIndex } = dialogState;

    const newOverride: AudioOverride = {
      scene_id: sceneId,
      category,
      cue_index: cueIndex,
      track_id: track.id,
      file: track.file,
      title: track.title,
      user_selected: true,
      locked: false,
    };

    const filtered = overrides.filter(
      o => !(o.scene_id === sceneId && o.category === category && o.cue_index === cueIndex)
    );

    saveOverrides([...filtered, newOverride]);
    setDialogState(prev => ({ ...prev, open: false }));
  }, [dialogState, overrides, saveOverrides]);

  // Toggle lock on an override
  const handleLockToggle = useCallback((sceneId: string, category: AudioCategory, cueIndex: number) => {
    const existing = overrides.find(
      o => o.scene_id === sceneId && o.category === category && o.cue_index === cueIndex
    );

    if (existing) {
      const updated = overrides.map(o =>
        o.scene_id === sceneId && o.category === category && o.cue_index === cueIndex
          ? { ...o, locked: !o.locked }
          : o
      );
      saveOverrides(updated);
    } else {
      // Create an override for the AI-selected track just to lock it
      const scene = scenes.find(s => s.scene_id === sceneId);
      const cueArray = scene?.[category];
      const cue = cueArray?.[cueIndex];
      if (!cue) return;

      const trackId = cue.file.split('/').pop()?.replace(/\.mp3$/, '') || '';
      const track = getTrackById(trackId);

      const newOverride: AudioOverride = {
        scene_id: sceneId,
        category,
        cue_index: cueIndex,
        track_id: trackId,
        file: cue.file,
        title: track?.title || trackId,
        user_selected: false,
        locked: true,
      };

      saveOverrides([...overrides, newOverride]);
    }
  }, [overrides, scenes, saveOverrides]);

  // Remove SFX cue (revert to AI selection by removing override)
  const handleRemoveCue = useCallback((sceneId: string, category: AudioCategory, cueIndex: number) => {
    const filtered = overrides.filter(
      o => !(o.scene_id === sceneId && o.category === category && o.cue_index === cueIndex)
    );
    saveOverrides(filtered);
  }, [overrides, saveOverrides]);

  // Handle preview budget changes
  const handleRemainingPreviewsChanged = useCallback((remaining: number) => {
    setRemainingPreviews(remaining);
    onRemainingPreviewsChanged?.(remaining);
  }, [onRemainingPreviewsChanged]);

  // Regenerate a single scene's audio
  const handleRegenerateScene = useCallback(async (sceneIndex: number) => {
    setRegeneratingScene(sceneIndex);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/regenerate-scene`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneIndex }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to queue scene regeneration');
      }
      // Poll for job completion could be added here
      // For now, user refreshes to see updated audio
    } catch {
      // Error handling — toast could be added here
    } finally {
      setRegeneratingScene(null);
    }
  }, [projectId]);

  // Add SFX cue (opens dialog for a new cue at the end)
  const handleAddCue = useCallback((sceneId: string, category: AudioCategory) => {
    const scene = scenes.find(s => s.scene_id === sceneId);
    const cueArray = scene?.[category] || [];
    setDialogState({
      open: true,
      sceneId,
      category,
      cueIndex: cueArray.length, // next index
      sceneMood: scene?.mood,
      sceneSummary: scene?.summary,
      sceneIntensity: scene?.intensity,
    });
  }, [scenes]);

  // Toggle scene expand/collapse
  const handleToggleScene = useCallback((index: number) => {
    setExpandedScenes(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }, []);

  // Apply all user-selected overrides from one scene to all other scenes
  const handleApplyToAllScenes = useCallback((fromSceneId: string) => {
    const sourceOverrides = overrides.filter(o => o.scene_id === fromSceneId && o.user_selected);
    if (sourceOverrides.length === 0) return;
    const otherSceneIds = scenes.map(s => s.scene_id).filter(id => id !== fromSceneId);
    const newOverrides = overrides.filter(o => o.scene_id === fromSceneId); // keep source as-is
    for (const targetId of otherSceneIds) {
      // Remove existing user overrides for this scene, then add copies from source
      const kept = overrides.filter(o => o.scene_id === targetId && !o.user_selected);
      const copies = sourceOverrides.map(o => ({ ...o, scene_id: targetId }));
      newOverrides.push(...kept, ...copies);
    }
    saveOverrides(newOverrides);
  }, [overrides, scenes, saveOverrides]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading audio selections...</span>
      </div>
    );
  }

  if (scenes.length === 0) {
    return (
      <div className="text-center py-8">
        <Volume2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
        <p className="text-sm text-muted-foreground">
          Generate your script first to see AI-selected audio tracks.
        </p>
      </div>
    );
  }

  const totalOverrides = overrides.filter(o => o.user_selected).length;

  const allExpanded = expandedScenes.size === scenes.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-medium">Audio Selections</span>
          {totalOverrides > 0 && (
            <Badge variant="outline" className="text-xs border-blue-300 text-blue-600">
              {totalOverrides} custom
            </Badge>
          )}
          {saving && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving...
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setExpandedScenes(allExpanded ? new Set() : new Set(scenes.map((_, i) => i)))}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
          <span className="text-xs text-muted-foreground">
            {remainingPreviews} preview{remainingPreviews !== 1 ? 's' : ''} remaining
          </span>
          <span className="text-xs text-muted-foreground">{scenes.length} scene{scenes.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {scenes.map((scene, index) => (
        <SceneAudioCard
          key={scene.scene_id}
          scene={scene}
          sceneIndex={index}
          overrides={overrides}
          onOpenDialog={handleOpenDialog}
          onLockToggle={handleLockToggle}
          onRemoveCue={handleRemoveCue}
          onAddCue={handleAddCue}
          disabled={disabled}
          projectId={projectId}
          remainingPreviews={remainingPreviews}
          onRemainingPreviewsChanged={handleRemainingPreviewsChanged}
          regeneratingScene={regeneratingScene}
          onRegenerateScene={handleRegenerateScene}
          isExpanded={expandedScenes.has(index)}
          onToggleExpand={() => handleToggleScene(index)}
          onApplyToAll={handleApplyToAllScenes}
        />
      ))}

      <AudioSelectionDialog
        state={dialogState}
        onClose={() => setDialogState(prev => ({ ...prev, open: false }))}
        onSelect={handleSelectTrack}
      />
    </div>
  );
}

export default AudioChooser;
