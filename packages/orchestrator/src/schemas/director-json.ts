import { z } from 'zod';

// Dialogue line schema - represents a single line of dialogue or narration
export const DialogueLineSchema = z.object({
  line_id: z.string(),
  character: z.string(),
  text: z.string().min(1),
  voice_key: z.string(),
  // Metadata fields (only present on first line per character)
  character_age: z.number().optional(),
  character_gender: z.enum(['Male', 'Female']).optional(),
  character_ethnicity: z.string().optional(),
});

export type DialogueLine = z.infer<typeof DialogueLineSchema>;

// Unified audio cue schema - used across all audio types
// start_at can be a line_id (string) or timestamp (number)
export const AudioCueSchema = z.object({
  file: z.string(),
  reasoning: z.string().optional(),
  start_at: z.union([z.string(), z.number()]).optional(),
  end_at: z.number().optional(),
  duration: z.number().optional(),
  volume: z.number().optional(),
  fade_out: z.number().optional(),
});

export type AudioCue = z.infer<typeof AudioCueSchema>;

// Legacy schemas for backwards compatibility (alias to AudioCue)
export const MusicCueSchema = AudioCueSchema;
export const AmbienceCueSchema = AudioCueSchema;
export const SfxCueSchema = AudioCueSchema;

// Mix parameters schema
export const MixParamsSchema = z.object({
  target_lufs: z.number().default(-16),
  true_peak_db: z.number().default(-1),
  music_gain_db: z.number().optional(),
  ambience_gain_db: z.number().optional(),
  sfx_gain_db: z.number().optional(),
}).partial();

// Scene schema - represents a single scene with dialogue and audio cues
export const SceneSchema = z.object({
  scene_id: z.string(),
  summary: z.string().optional(),
  mood: z.string().optional(),
  intensity: z.number().min(0).max(1).optional(),
  dialogue: z.array(DialogueLineSchema),
  music: z.array(AudioCueSchema).optional(),
  ambience: z.array(AudioCueSchema).optional(),
  sfx: z.array(AudioCueSchema).optional(),
  mix: MixParamsSchema.optional(),
});

export type Scene = z.infer<typeof SceneSchema>;

// Director JSON schema - the main input/output format
export const DirectorJSONSchema = z.object({
  project_id: z.string(),
  script_id: z.string().optional(),
  scenes: z.array(SceneSchema),
});

export type DirectorJSON = z.infer<typeof DirectorJSONSchema>;

// Scene Audio entry schema
export const SceneAudioEntrySchema = z.object({
  scene_id: z.string(),
  music: z.array(AudioCueSchema).optional(),
  ambience: z.array(AudioCueSchema).optional(),
  sfx: z.array(AudioCueSchema).optional(),
});

export type SceneAudioEntry = z.infer<typeof SceneAudioEntrySchema>;

// Scene Audio JSON schema - output from AudioDirectorAgent
export const SceneAudioJSONSchema = z.object({
  project_id: z.string(),
  scenes: z.array(SceneAudioEntrySchema),
});

export type SceneAudioJSON = z.infer<typeof SceneAudioJSONSchema>;

// Validation report schema
export const ValidationErrorSchema = z.object({
  type: z.string(),
  message: z.string(),
  location: z.string(),
  fix_data: z.record(z.unknown()).optional(),
});

export type ValidationErrorData = z.infer<typeof ValidationErrorSchema>;

export const ValidationReportSchema = z.object({
  is_valid: z.boolean(),
  errors_found: z.number(),
  errors: z.array(ValidationErrorSchema),
  auto_corrected: z.boolean().optional(),
});

export type ValidationReport = z.infer<typeof ValidationReportSchema>;

// Pipeline result schema
export const PipelineResultSchema = z.object({
  project_id: z.string(),
  director_json: DirectorJSONSchema,
  scene_audio_json: SceneAudioJSONSchema,
  validation_report: z.object({
    director_validation: ValidationReportSchema,
    audio_validation: ValidationReportSchema,
  }),
});

export type PipelineResult = z.infer<typeof PipelineResultSchema>;

// Request schemas for API endpoints
export const GenerateScenesRequestSchema = z.object({
  project_id: z.string(),
  script_text: z.string().min(1),
  // Optional: character_name -> voice_id mapping for user-selected voices
  voice_overrides: z.record(z.string(), z.string()).optional(),
});

export type GenerateScenesRequest = z.infer<typeof GenerateScenesRequestSchema>;

export const OrchestrateRequestSchema = z.object({
  project_id: z.string(),
  // Scenes can be omitted if script_text is provided (director runs first)
  scenes: z.array(SceneSchema).optional(),
  // Optional: allow passing script_text to run director internally
  script_text: z.string().optional(),
});

export type OrchestrateRequest = z.infer<typeof OrchestrateRequestSchema>;

// Response schemas
export const GenerateScenesResponseSchema = z.object({
  project_id: z.string(),
  success: z.boolean(),
  scene_count: z.number().optional(),
  processing_time: z.number().optional(),
  message: z.string().optional(),
});

export type GenerateScenesResponse = z.infer<typeof GenerateScenesResponseSchema>;

export const OrchestrateResponseSchema = z.object({
  status: z.enum(['success', 'error']),
  project_id: z.string(),
  audio_urls: z.array(z.string()).optional(),
  playback_manifest: z.any().optional(),
  message: z.string().optional(),
});

export type OrchestrateResponse = z.infer<typeof OrchestrateResponseSchema>;
