'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api/fetch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Play, Pause, Lock, Unlock, Search, User, Volume2, Check, RefreshCw, Star, Sparkles } from 'lucide-react';
import type { Voice, DetectedCharacter, CharacterVoiceAssignment } from '@/lib/types/voice';
import { getScoredVoices, type ScoredVoice } from '@/lib/voice-scoring';

interface VoiceChooserProps {
  projectId: string;
  scriptText: string;
  directorJson?: {
    scenes?: Array<{
      dialogue?: Array<{
        character: string;
        text: string;
        voice_key?: string;
      }>;
    }>;
  };
  onAssignmentsChange?: (assignments: CharacterVoiceAssignment[]) => void;
  disabled?: boolean;
}

// =============================================================================
// Voice Preview Component
// =============================================================================
function VoicePreview({
  voice,
  isSelected,
  onSelect,
  matchScore,
  matchLabel,
}: {
  voice: Voice;
  isSelected: boolean;
  onSelect: () => void;
  matchScore?: number;
  matchLabel?: string;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  const handlePlayPreview = useCallback(async () => {
    if (!voice.preview_url) return;

    if (isPlaying && audio) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    const newAudio = new Audio(voice.preview_url);
    newAudio.onended = () => setIsPlaying(false);
    newAudio.onerror = () => setIsPlaying(false);
    setAudio(newAudio);
    setIsPlaying(true);
    await newAudio.play().catch(() => setIsPlaying(false));
  }, [voice.preview_url, isPlaying, audio]);

  return (
    <Card
      className={`cursor-pointer transition-all ${
        isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
      }`}
      onClick={onSelect}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {voice.is_custom && (
                <span title="Custom Voice">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500 flex-shrink-0" />
                </span>
              )}
              <span className="font-medium truncate">{voice.name}</span>
              {isSelected && <Check className="h-4 w-4 text-primary" />}
            </div>
            <div className="flex gap-1 mt-1 flex-wrap">
              {matchLabel && matchScore !== undefined && matchScore > 0 && (
                <Badge
                  variant={matchLabel === 'Excellent' ? 'default' : 'secondary'}
                  className={`text-xs ${
                    matchLabel === 'Excellent' ? 'bg-emerald-600' :
                    matchLabel === 'Good' ? 'bg-blue-500 text-white' :
                    ''
                  }`}
                >
                  {matchLabel} {Math.round(matchScore * 100)}%
                </Badge>
              )}
              {voice.is_custom && (
                <Badge variant="default" className="text-xs bg-amber-500">
                  Custom
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {voice.gender}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {voice.age}
              </Badge>
              {voice.accent && (
                <Badge variant="outline" className="text-xs">
                  {voice.accent}
                </Badge>
              )}
            </div>
          </div>
          {voice.preview_url && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-2"
              onClick={(e) => {
                e.stopPropagation();
                handlePlayPreview();
              }}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Character Card Component
// =============================================================================
function CharacterCard({
  character,
  assignment,
  voices,
  scoredVoices,
  onAssign,
  onToggleLock,
}: {
  character: DetectedCharacter;
  assignment?: CharacterVoiceAssignment;
  voices: Voice[];
  scoredVoices: ScoredVoice[];
  onAssign: (voiceId: string) => void;
  onToggleLock: () => void;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [ageFilter, setAgeFilter] = useState<string>('all');

  const assignedVoice = voices.find((v) => v.voice_id === assignment?.voice_id);
  const assignedScore = scoredVoices.find(sv => sv.voice.voice_id === assignment?.voice_id);

  // Filter scored voices (already sorted by match strength)
  const filteredScoredVoices = scoredVoices.filter((sv) => {
    const voice = sv.voice;
    const matchesSearch =
      !searchQuery ||
      voice.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      voice.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      voice.style?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGender = genderFilter === 'all' || voice.gender === genderFilter;
    const matchesAge = ageFilter === 'all' || voice.age === ageFilter;
    return matchesSearch && matchesGender && matchesAge;
  });

  return (
    <Card className="relative">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">{character.name}</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleLock}
            title={assignment?.locked ? 'Unlock voice' : 'Lock voice'}
          >
            {assignment?.locked ? (
              <Lock className="h-4 w-4 text-amber-500" />
            ) : (
              <Unlock className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
        <CardDescription>
          {character.line_count} line{character.line_count !== 1 ? 's' : ''}
          {character.inferred_gender && ` • ${character.inferred_gender}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Sample line preview */}
        {character.sample_lines[0] && (
          <p className="text-sm text-muted-foreground italic mb-3 line-clamp-2">
            "{character.sample_lines[0]}"
          </p>
        )}

        {/* Current assignment */}
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          {assignedVoice ? (
            <span className="text-sm flex items-center gap-1.5">
              {assignedVoice.name}
              {assignedScore && assignedScore.score > 0 && (
                <Badge
                  variant="secondary"
                  className={`text-xs ${
                    assignedScore.matchLabel === 'Excellent' ? 'bg-emerald-100 text-emerald-700' :
                    assignedScore.matchLabel === 'Good' ? 'bg-blue-100 text-blue-700' :
                    ''
                  }`}
                >
                  {assignedScore.matchLabel}
                </Badge>
              )}
              {assignment?.user_selected && (
                <Badge variant="secondary" className="text-xs">
                  Custom
                </Badge>
              )}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">No voice assigned</span>
          )}
        </div>

        {/* Change voice button */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="mt-3 w-full">
              {assignedVoice ? 'Change Voice' : 'Select Voice'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Select Voice for {character.name}</DialogTitle>
              <DialogDescription className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Voices are sorted by match strength. Best matches appear first.
              </DialogDescription>
            </DialogHeader>

            {/* Filters */}
            <div className="flex gap-2 py-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search voices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={genderFilter} onValueChange={setGenderFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genders</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                </SelectContent>
              </Select>
              <Select value={ageFilter} onValueChange={setAgeFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Age" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ages</SelectItem>
                  <SelectItem value="child">Child</SelectItem>
                  <SelectItem value="teen">Teen</SelectItem>
                  <SelectItem value="young_adult">Young Adult</SelectItem>
                  <SelectItem value="adult">Adult</SelectItem>
                  <SelectItem value="senior">Senior</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Voice grid - sorted by match strength */}
            <div className="flex-1 overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-2">
                {filteredScoredVoices.map((sv) => (
                  <VoicePreview
                    key={sv.voice.voice_id}
                    voice={sv.voice}
                    isSelected={sv.voice.voice_id === assignment?.voice_id}
                    matchScore={sv.score}
                    matchLabel={sv.matchLabel}
                    onSelect={() => {
                      onAssign(sv.voice.voice_id);
                      setIsDialogOpen(false);
                    }}
                  />
                ))}
              </div>
              {filteredScoredVoices.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No voices match your filters
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Main Voice Chooser Component
// =============================================================================
export function VoiceChooser({
  projectId,
  scriptText,
  directorJson,
  onAssignmentsChange,
  disabled = false,
}: VoiceChooserProps) {
  const [characters, setCharacters] = useState<DetectedCharacter[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [assignments, setAssignments] = useState<CharacterVoiceAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedFromDb, setLoadedFromDb] = useState(false);

  // Load saved voice assignments from the database
  useEffect(() => {
    const loadSavedAssignments = async () => {
      try {
        const response = await apiFetch(`/api/projects/${projectId}/voice-assignments`);
        if (response.ok) {
          const data = await response.json();
          if (data.assignments && data.assignments.length > 0) {
            setAssignments(data.assignments);
            setLoadedFromDb(true);
          }
        }
      } catch (err) {
        console.error('[VoiceChooser] Error loading saved assignments:', err);
      }
    };
    loadSavedAssignments();
  }, [projectId]);

  // Persist assignments to the database
  const saveAssignments = useCallback(async (newAssignments: CharacterVoiceAssignment[]) => {
    try {
      await apiFetch(`/api/projects/${projectId}/voice-assignments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: newAssignments }),
      });
    } catch (err) {
      console.error('[VoiceChooser] Error saving assignments:', err);
    }
  }, [projectId]);

  // Extract characters from script or directorJson
  useEffect(() => {
    const extractCharacters = () => {
      // If we have director JSON, use it
      if (directorJson?.scenes) {
        const charMap = new Map<string, DetectedCharacter>();

        directorJson.scenes.forEach((scene) => {
          scene.dialogue?.forEach((line, idx) => {
            const existing = charMap.get(line.character);
            if (existing) {
              existing.line_count++;
              if (existing.sample_lines.length < 3) {
                existing.sample_lines.push(line.text);
              }
            } else {
              charMap.set(line.character, {
                name: line.character,
                line_count: 1,
                first_appearance: idx,
                sample_lines: [line.text],
                assigned_voice: line.voice_key
                  ? { voice_id: line.voice_key, name: '', gender: 'neutral', age: 'adult' }
                  : undefined,
              });
            }
          });
        });

        setCharacters(Array.from(charMap.values()).sort((a, b) => b.line_count - a.line_count));

        // Only initialize assignments from director JSON if we don't have DB-saved ones
        if (!loadedFromDb) {
          const initialAssignments: CharacterVoiceAssignment[] = [];
          charMap.forEach((char, name) => {
            if (char.assigned_voice) {
              initialAssignments.push({
                character_name: name,
                voice_id: char.assigned_voice.voice_id,
                voice_name: '',
                user_selected: false,
                locked: false,
              });
            }
          });
          setAssignments(initialAssignments);
        }
      } else {
        // Parse from script text (basic character detection)
        const lines = scriptText.split('\n');
        const charMap = new Map<string, DetectedCharacter>();

        // Simple heuristic: lines that are ALL CAPS followed by dialogue
        const characterPattern = /^([A-Z][A-Z\s]+)(?:\s*\(.*\))?$/;

        lines.forEach((line, idx) => {
          const trimmed = line.trim();
          const match = trimmed.match(characterPattern);
          if (match && match[1].length > 1 && match[1].length < 30) {
            const name = match[1].trim();
            // Get the next non-empty line as sample dialogue
            const nextLine = lines.slice(idx + 1).find((l) => l.trim().length > 0)?.trim() || '';

            const existing = charMap.get(name);
            if (existing) {
              existing.line_count++;
              if (existing.sample_lines.length < 3 && nextLine) {
                existing.sample_lines.push(nextLine);
              }
            } else {
              charMap.set(name, {
                name,
                line_count: 1,
                first_appearance: idx,
                sample_lines: nextLine ? [nextLine] : [],
              });
            }
          }
        });

        setCharacters(Array.from(charMap.values()).sort((a, b) => b.line_count - a.line_count));
      }
    };

    extractCharacters();
  }, [scriptText, directorJson, loadedFromDb]);

  // Fetch voice catalog from API
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        setIsLoading(true);
        const response = await apiFetch('/api/voices');

        if (!response.ok) {
          throw new Error('Failed to fetch voices');
        }

        const data = await response.json();
        setVoices(data.voices || []);
        setError(null);
      } catch (err) {
        setError('Failed to load voice catalog');
        console.error('[VoiceChooser] Error fetching voices:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVoices();
  }, []);

  // Handle voice assignment
  const handleAssign = (characterName: string, voiceId: string) => {
    const voice = voices.find((v) => v.voice_id === voiceId);
    if (!voice) return;

    setAssignments((prev) => {
      const existing = prev.find((a) => a.character_name === characterName);
      const newAssignments = existing
        ? prev.map((a) =>
            a.character_name === characterName
              ? { ...a, voice_id: voiceId, voice_name: voice.name, user_selected: true }
              : a
          )
        : [
            ...prev,
            {
              character_name: characterName,
              voice_id: voiceId,
              voice_name: voice.name,
              user_selected: true,
              locked: false,
            },
          ];

      onAssignmentsChange?.(newAssignments);
      saveAssignments(newAssignments);
      return newAssignments;
    });
  };

  // Toggle lock
  const handleToggleLock = (characterName: string) => {
    setAssignments((prev) => {
      const newAssignments = prev.map((a) =>
        a.character_name === characterName ? { ...a, locked: !a.locked } : a
      );
      onAssignmentsChange?.(newAssignments);
      saveAssignments(newAssignments);
      return newAssignments;
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading voice catalog...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // Compute scored voices per character (memoized to avoid re-scoring on every render)
  const scoredVoicesByCharacter = useMemo(() => {
    if (voices.length === 0 || characters.length === 0) return new Map<string, ScoredVoice[]>();

    const map = new Map<string, ScoredVoice[]>();
    for (const character of characters) {
      // Exclude voices assigned to OTHER characters (not this one)
      const otherAssignedIds = assignments
        .filter(a => a.character_name !== character.name)
        .map(a => a.voice_id);

      const scored = getScoredVoices(voices, character, otherAssignedIds);
      map.set(character.name, scored);
    }
    return map;
  }, [voices, characters, assignments]);

  if (characters.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            No characters detected in the script. Add dialogue to see character options.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Character Voices</h3>
        <Badge variant="outline">{characters.length} characters</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {characters.map((character) => (
          <CharacterCard
            key={character.name}
            character={character}
            assignment={assignments.find((a) => a.character_name === character.name)}
            voices={voices}
            scoredVoices={scoredVoicesByCharacter.get(character.name) || []}
            onAssign={(voiceId) => handleAssign(character.name, voiceId)}
            onToggleLock={() => handleToggleLock(character.name)}
          />
        ))}
      </div>
    </div>
  );
}
