/**
 * Shared constants for Story Magic Orchestrator
 */

// =============================================================================
// Job & Project Status
// =============================================================================
export const JOB_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export const PROJECT_STATUS = {
  DRAFT: 'draft',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type ProjectStatus = (typeof PROJECT_STATUS)[keyof typeof PROJECT_STATUS];

// =============================================================================
// Pipeline Steps
// =============================================================================
export const PIPELINE_STEP = {
  QUEUED: 'queued',
  INITIALIZING: 'initializing',
  PARSING: 'parsing',
  PARSING_COMPLETE: 'parsing_complete',
  GENERATING_AUDIO: 'generating_audio',
  ALIGNING: 'aligning',
  MIXING: 'mixing',
  UPLOADING: 'uploading',
  FINALIZING: 'finalizing',
  DONE: 'done',
  FAILED: 'failed',
} as const;

export type PipelineStep = (typeof PIPELINE_STEP)[keyof typeof PIPELINE_STEP];

// =============================================================================
// TTS Configuration
// =============================================================================
export const TTS_CONFIG = {
  // Concurrency limit for ElevenLabs API calls
  CONCURRENCY: 8,
  // Default voice ID if character mapping fails
  DEFAULT_VOICE_ID: 'pMsXgVXv3BLzUgSXRplE', // Brian
  // Retry settings
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
} as const;

// =============================================================================
// Audio Configuration
// =============================================================================
export const AUDIO_CONFIG = {
  // Target loudness for EBU R128
  TARGET_LUFS: -16,
  // True peak limit
  TRUE_PEAK_DB: -1,
  // Crossfade duration between scenes
  CROSSFADE_MS: 1500,
  // Output format
  OUTPUT_FORMAT: 'm4a',
  // Sample rate
  SAMPLE_RATE: 48000,
} as const;

// =============================================================================
// Error Codes
// =============================================================================
export const ERROR_CODES = {
  // Authentication
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_DIRECTOR_JSON: 'INVALID_DIRECTOR_JSON',

  // TTS
  TTS_ERROR: 'TTS_ERROR',
  TTS_QUOTA_EXCEEDED: 'TTS_QUOTA_EXCEEDED',

  // Pipeline
  PIPELINE_ERROR: 'PIPELINE_ERROR',
  MIXING_ERROR: 'MIXING_ERROR',

  // System
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
