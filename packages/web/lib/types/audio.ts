/**
 * Audio Types for Story Magic - Audio Chooser Feature
 */

// =============================================================================
// Audio Catalog Types
// =============================================================================

export type AudioCategory = 'music' | 'ambience' | 'sfx';

export interface AudioTrackMetadata {
  id: string;
  file: string;
  title: string;
  group: string;
  style: string;
  mood: string[];
  intensity: number; // 0-100
  loopable: boolean;
  tags: string[];
}

export interface AudioCatalog {
  music: AudioTrackMetadata[];
  ambience: AudioTrackMetadata[];
  sfx: AudioTrackMetadata[];
}

// =============================================================================
// Audio Cue (from Director JSON scenes)
// =============================================================================

export interface AudioCue {
  file: string;
  reasoning?: string;
  volume?: number;
  fade_in?: number;
  fade_out?: number;
}

// =============================================================================
// Audio Override (stored per-project in JSONB)
// =============================================================================

export interface AudioOverride {
  scene_id: string;
  category: AudioCategory;
  cue_index: number;       // which cue within the category (0 = first)
  track_id: string;        // catalog id, e.g. "m_string_orchestra_uplifting_01"
  file: string;            // e.g. "music/m_string_orchestra_uplifting_01.mp3"
  title: string;           // display name
  user_selected: boolean;
  locked: boolean;
}

// =============================================================================
// Scored Audio Track (client-side scoring result)
// =============================================================================

export type MatchLabel = 'Excellent' | 'Good' | 'Fair' | 'Low';

export interface ScoredAudioTrack {
  track: AudioTrackMetadata;
  score: number;
  matchLabel: MatchLabel;
}

// =============================================================================
// Scene Context (for scoring)
// =============================================================================

export interface SceneContext {
  scene_id: string;
  summary?: string;
  mood?: string;
  intensity?: number; // 0-100
  setting?: string;
  action_keywords?: string[];
}
