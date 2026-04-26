import { z } from 'zod';

/**
 * CharacterEntry — a single speaking character extracted from a screenplay.
 *
 * Aliases handle character reveals: a character called "THE STRANGER" in act 1
 * is later revealed as "FRANK". Both names appear in the script; the VoiceMap
 * will include an entry for each, both pointing to the same voice.
 */
export const CharacterEntrySchema = z.object({
  name: z.string().describe(
    'Primary name as it appears in the script (ALL CAPS). For aliased characters use the canonical/final name here.'
  ),
  canonical_name: z.string().describe(
    'The definitive character name (the final revealed name or most-used name).'
  ),
  aliases: z.array(z.string()).default([]).describe(
    'Other names used for this same character in the script (e.g., ["THE STRANGER"] when the canonical name is "FRANK").'
  ),
  gender: z.enum(['Male', 'Female']).optional().describe(
    'Inferred from pronouns, dialogue, relationships, or name titles.'
  ),
  age: z.number().int().min(1).max(120).optional().describe(
    'Estimated age in years, inferred from context (e.g., "elderly", "teenager", "in her 30s").'
  ),
  description: z.string().describe(
    'Character role, personality, and vocal attributes implied by their dialogue and context.'
  ),
  sample_dialogue: z.string().optional().describe(
    'A short representative line from this character, used to inform voice selection.'
  ),
  is_narrator: z.boolean().default(false).describe(
    'True only for the special NARRATOR entry that voices action/description lines.'
  ),
});

export const CharacterManifestSchema = z.object({
  project_id: z.string(),
  characters: z.array(CharacterEntrySchema).min(1),
});

export type CharacterEntry = z.infer<typeof CharacterEntrySchema>;
export type CharacterManifest = z.infer<typeof CharacterManifestSchema>;
