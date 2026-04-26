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
  voice_key: z.string().min(1).describe('ElevenLabs voice ID (typically 20 alphanumeric chars).'),
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
  /** Fallback for NARRATOR entries and any unknown narration. */
  default_narrator_voice: z.string().min(1),
  /** Fallback voice_key for unknown male characters. */
  default_male_voice: z.string().min(1),
  /** Fallback voice_key for unknown female characters. */
  default_female_voice: z.string().min(1),
});

export type VoiceAssignment = z.infer<typeof VoiceAssignmentSchema>;
export type VoiceMap = z.infer<typeof VoiceMapSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Default fallback voice IDs (ElevenLabs curated catalog)
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_NARRATOR_VOICE = 'JBFqnCBsd6RMkjVDRZzb'; // George
export const DEFAULT_MALE_VOICE     = 'bIHbv24MWmeRgasZH58o'; // Will
export const DEFAULT_FEMALE_VOICE   = 'cgSgspJ2msm6clMCkdW9'; // Jessica

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
