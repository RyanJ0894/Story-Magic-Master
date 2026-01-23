/**
 * Voice and Character Types for Story Magic
 */

// =============================================================================
// Voice Catalog Types
// =============================================================================

export interface Voice {
  voice_id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  age: 'child' | 'teen' | 'young_adult' | 'adult' | 'senior';
  accent?: string;
  style?: string;
  tone?: string;
  description?: string;
  preview_url?: string;
  labels?: string[];
  // ElevenLabs specific
  category?: 'premade' | 'cloned' | 'generated' | 'professional' | 'high_quality';
  is_custom?: boolean; // True for voices native to our API key (not premade)
}

export interface VoiceCategory {
  id: string;
  name: string;
  voices: Voice[];
}

// =============================================================================
// Character Types
// =============================================================================

export interface DetectedCharacter {
  name: string;
  line_count: number;
  first_appearance: number; // Line number
  sample_lines: string[];
  inferred_gender?: 'male' | 'female' | 'unknown';
  inferred_age?: string;
  assigned_voice?: Voice;
}

export interface CharacterVoiceAssignment {
  character_name: string;
  voice_id: string;
  voice_name: string;
  user_selected: boolean; // vs AI-assigned
  locked: boolean; // Prevent AI from changing
}

// =============================================================================
// Storygraph Types
// =============================================================================

export type StoryNodeType = 'dialogue' | 'pause' | 'sfx' | 'music' | 'ambience' | 'scene_break';

export type StoryNodeStatus = 'pending' | 'queued' | 'processing' | 'completed' | 'failed';

export interface StoryNode {
  id: string;
  type: StoryNodeType;
  scene_id: string;
  sequence: number; // Order within the scene

  // For dialogue nodes
  character?: string;
  voice_id?: string;
  text?: string;

  // For audio cue nodes
  audio_file?: string;
  cue_type?: 'in' | 'out' | 'crossfade';

  // Processing
  status: StoryNodeStatus;
  dependencies: string[]; // IDs of nodes that must complete first
  duration_ms?: number;
  audio_path?: string;

  // Timing
  start_time_ms?: number;
  end_time_ms?: number;

  // Error tracking
  error?: string;
  retry_count?: number;
}

export interface StoryEdge {
  from: string;
  to: string;
  type: 'sequence' | 'parallel' | 'sync';
}

export interface ParallelGroup {
  id: string;
  node_ids: string[];
  scene_id: string;
  status: StoryNodeStatus;
}

export interface StoryGraph {
  project_id: string;
  version: number;
  created_at: string;

  // Graph structure
  nodes: StoryNode[];
  edges: StoryEdge[];

  // Processing optimization
  parallel_groups: ParallelGroup[];
  critical_path: string[]; // Longest dependency chain

  // Progress tracking
  total_nodes: number;
  completed_nodes: number;
  failed_nodes: number;

  // Timing estimates
  estimated_duration_ms: number;
  actual_duration_ms?: number;
}

// =============================================================================
// Processing Types
// =============================================================================

export interface ProcessingWave {
  wave_number: number;
  node_ids: string[];
  status: 'pending' | 'processing' | 'completed';
  started_at?: string;
  completed_at?: string;
}

export interface StitchSegment {
  id: string;
  node_ids: string[]; // Nodes that make up this segment
  audio_path?: string;
  status: 'pending' | 'stitching' | 'completed';
  start_time_ms: number;
  end_time_ms: number;
}

export interface ProgressiveStitchPlan {
  segments: StitchSegment[];
  final_output_path?: string;
  total_duration_ms: number;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface VoiceCatalogResponse {
  voices: Voice[];
  categories: VoiceCategory[];
  total_count: number;
}

export interface CharacterDetectionResponse {
  characters: DetectedCharacter[];
  total_lines: number;
  narrator_present: boolean;
}

export interface StorygraphResponse {
  graph: StoryGraph;
  processing_waves: ProcessingWave[];
  stitch_plan: ProgressiveStitchPlan;
}
