import { z } from 'zod';

/**
 * VoiceAssignment — a single character → voice binding.
 *
 * Aliases point to the same voice_key as the canonical entry. Example:
 *   assignments["FRANK"]         = { canonical_name: "FRANK", voice_key: "abc..." }
 *   assignments["THE STRANGER"]  = { canonical_name: "FRANK", voice_key: "abc..." }
 *
 * The scene construction pass looks up every character name it encounters in
 * assignments. Both "FRANK" and "THE STRANGER" resolve to the same voice.
 */
export const VoiceAssignmentSchema = z.object({
  canonical_name: z.string().describe('The definitive character name (resolves aliases).'),
  voice_key: z.string().describe('Non-empty ElevenLabs voice ID (typically 20 alphanumeric chars).'),
  voice_name: z.string().optional().describe('Human-readable voice label for debugging.'),
  gender: z.enum(['Male', 'Female']).optional(),
  age: z.number().optional(),
});

export const VoiceMapSchema = z.object({
  project_id: z.string(),
  /**
   * Keyed by ALL normalized character names (canonical + aliases, ALL CAPS).
   * Every name the scene construction agent might encounter must be here.
   */
  assignments: z.record(z.string(), VoiceAssignmentSchema),
  // Note: do not use .min(1) on these — Anthropic rejects minLength in
  // structured-output schemas. The agent post-validates that defaults are set.
  /** Fallback for NARRATOR entries and any unknown narration. */
  default_narrator_voice: z.string().describe('Non-empty ElevenLabs voice ID for narration'),
  /** Fallback voice_key for unknown male characters. */
  default_male_voice: z.string().describe('Non-empty ElevenLabs voice ID for male fallback'),
  /** Fallback voice_key for unknown female characters. */
  default_female_voice: z.string().describe('Non-empty ElevenLabs voice ID for female fallback'),
});

/**
 * LLM-facing variant of VoiceMap.
 *
 * Anthropic's structured-output (`output_config.format.schema`) rejects
 * `additionalProperties: <object>`, which is exactly what `z.record(string,
 * object)` serializes to. So when we ask the model to repair / structure a
 * VoiceMap, we present `assignments` as an array of `{ character_name,
 * ... }` entries (closed-shape objects) and reshape to a record in code.
 *
 * The in-memory shape (`VoiceMap`) is unchanged — every consumer still reads
 * `voiceMap.assignments[CHARACTER]`.
 */
export const VoiceMapLLMSchema = z.object({
  project_id: z.string(),
  assignments: z
    .array(VoiceAssignmentSchema.extend({ character_name: z.string() }))
    .describe('One entry per normalized character name (canonical + alias).'),
  default_narrator_voice: z.string().describe('Non-empty ElevenLabs voice ID for narration'),
  default_male_voice: z.string().describe('Non-empty ElevenLabs voice ID for male fallback'),
  default_female_voice: z.string().describe('Non-empty ElevenLabs voice ID for female fallback'),
});

export type VoiceAssignment = z.infer<typeof VoiceAssignmentSchema>;
export type VoiceMap = z.infer<typeof VoiceMapSchema>;
export type VoiceMapLLM = z.infer<typeof VoiceMapLLMSchema>;

/** Reshape the LLM array variant into the in-memory record form. */
export function llmVoiceMapToVoiceMap(llm: VoiceMapLLM): VoiceMap {
  const assignments: VoiceMap['assignments'] = {};
  for (const entry of llm.assignments) {
    const { character_name, ...rest } = entry;
    assignments[character_name.toUpperCase().trim()] = rest;
  }
  return {
    project_id: llm.project_id,
    assignments,
    default_narrator_voice: llm.default_narrator_voice,
    default_male_voice: llm.default_male_voice,
    default_female_voice: llm.default_female_voice,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Default fallback voice IDs (ElevenLabs curated catalog)
// Override via env: DEFAULT_NARRATOR_VOICE_ID, DEFAULT_MALE_VOICE_ID, DEFAULT_FEMALE_VOICE_ID
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_NARRATOR_VOICE = process.env.DEFAULT_NARRATOR_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb'; // George
export const DEFAULT_MALE_VOICE     = process.env.DEFAULT_MALE_VOICE_ID     || 'bIHbv24MWmeRgasZH58o'; // Will
export const DEFAULT_FEMALE_VOICE   = process.env.DEFAULT_FEMALE_VOICE_ID   || 'cgSgspJ2msm6clMCkdW9'; // Jessica

/**
 * Look up a character's voice_key in the VoiceMap.
 * Returns the appropriate fallback if the character is not found.
 */
export function lookupVoice(
  characterName: string,
  voiceMap: VoiceMap,
  genderHint?: 'Male' | 'Female'
): string {
  const upper = characterName.toUpperCase().trim();
  const assignment = voiceMap.assignments[upper];
  if (assignment) return assignment.voice_key;

  // Check case-insensitive
  for (const [key, val] of Object.entries(voiceMap.assignments)) {
    if (key.toUpperCase() === upper) return val.voice_key;
  }

  // NARRATOR fallback
  if (upper === 'NARRATOR') return voiceMap.default_narrator_voice;

  // Gender-based fallback
  if (genderHint === 'Female') return voiceMap.default_female_voice;
  return voiceMap.default_male_voice;
}
