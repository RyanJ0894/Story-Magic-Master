/**
 * @story-magic/shared — DirectorJson types
 *
 * Canonical TypeScript shape for the JSON payload produced by the
 * orchestrator's director pipeline and stored in `Project.directorJson`
 * (Prisma `Json?` column).
 *
 * Source of truth: the zod schemas at
 *   packages/orchestrator/src/schemas/director-json.ts
 *
 * These types are kept structurally identical to the orchestrator's
 * `z.infer<typeof DirectorJSONSchema>`. The orchestrator owns parsing
 * and validation; this module exists so web consumers can replace
 * `directorJson as any` with a proper type without dragging zod into
 * the web bundle.
 *
 * If you change a field here, update the orchestrator schema in the
 * same PR — see the schema-consistency test that runs on CI.
 */

/**
 * Closed set of emotions a dialogue line can carry. The orchestrator's
 * zod schema accepts arbitrary strings here for forward-compat with
 * future model output; web consumers should be permissive in reading.
 */
export const DIRECTOR_EMOTIONS = [
  'NEUTRAL',
  'EXCITED',
  'NERVOUS',
  'SARCASTIC',
  'TENDER',
  'AUTHORITATIVE',
  'WHISPERED',
  'JOYFUL',
  'SORROWFUL',
  'ANGRY',
] as const;

export type DirectorEmotion = (typeof DIRECTOR_EMOTIONS)[number];

export interface DirectorDialogueLine {
  line_id: string;
  character: string;
  text: string;
  voice_key: string;
  emotion?: string;
  character_age?: number | null;
  character_gender?: 'Male' | 'Female' | null;
  character_ethnicity?: string | null;
}

export interface DirectorAudioCue {
  file: string;
  reasoning?: string;
  /** line_id (string) or timestamp seconds (number) */
  start_at?: string | number;
  end_at?: number;
  duration?: number;
  volume?: number;
  fade_out?: number;
}

export interface DirectorMixParams {
  target_lufs?: number;
  true_peak_db?: number;
  music_gain_db?: number;
  ambience_gain_db?: number;
  sfx_gain_db?: number;
}

export interface DirectorScene {
  scene_id: string;
  summary?: string;
  mood?: string;
  /** 0.0-1.0 dramatic intensity */
  intensity?: number;
  dialogue: DirectorDialogueLine[];
  music?: DirectorAudioCue[];
  ambience?: DirectorAudioCue[];
  sfx?: DirectorAudioCue[];
  mix?: DirectorMixParams;
}

export interface DirectorJson {
  /**
   * Optional at the type level even though the orchestrator's zod schema
   * makes it required on inbound API calls. Existing rows persisted in
   * `Project.directorJson` predate the validation boundary and may lack
   * this field. The guard intentionally tolerates that — `scenes` is the
   * load-bearing shape signal.
   */
  project_id?: string;
  script_id?: string;
  scenes: DirectorScene[];
}

/**
 * Type guard for reading from Prisma's `JsonValue` at the boundary.
 *
 * Does NOT validate exhaustively — only confirms the top-level shape so
 * downstream `?.scenes` accesses are typed correctly. The orchestrator's
 * zod schema is the source of truth for real validation; this guard is
 * a load-time sanity check for web consumers that previously cast through
 * `any`.
 */
export function isDirectorJson(value: unknown): value is DirectorJson {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  // Only the scenes array is required. project_id is metadata that some
  // legacy persisted rows omit; we don't treat its absence as invalidating
  // the shape (see DirectorJson.project_id JSDoc).
  if (!Array.isArray(v.scenes)) return false;
  return true;
}

/**
 * Narrowing helper for the common web read pattern:
 *   const dj = asDirectorJson(project.directorJson);
 *   if (dj?.scenes.length) { ... }
 *
 * Returns `null` if the value isn't a DirectorJson shape (e.g. the Prisma
 * column is null, or a legacy row from before the schema was added). Lets
 * call sites avoid the `as any` cast that prior code used to bypass
 * Prisma's `JsonValue`.
 */
export function asDirectorJson(value: unknown): DirectorJson | null {
  return isDirectorJson(value) ? value : null;
}
