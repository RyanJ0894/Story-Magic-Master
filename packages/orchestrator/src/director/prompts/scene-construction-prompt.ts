/**
 * Scene Construction Prompt
 *
 * Used by SceneConstructionAgent (Pass 3 of 3).
 * Voice lookup is provided inline — no tool calls are needed.
 */

import type { VoiceMap } from '../../schemas/voice-map.js';
import { SCRIPT_ABBREVIATIONS } from './director-prompt.js';

/**
 * Build the system prompt for one chunk.
 * The VoiceMap is embedded as a readable lookup table so the model can
 * resolve voice_key values without any tool calls.
 *
 * Phase D-1: when `useCueAnnotations` is true, the chunk text contains
 * pre-inserted `[SPEAKER: NAME]` annotations from Phase D-2's cue tagger.
 * The system prompt then tells the LLM to use those annotations as the
 * source of truth for speaker attribution, which saves it the work of
 * detecting cue lines itself.
 */
export function buildSceneConstructionSystemPrompt(
  voiceMap: VoiceMap,
  startSceneNum: number,
  useCueAnnotations = false,
): string {
  const voiceTable = buildVoiceTable(voiceMap);
  const cueAnnotationBlock = useCueAnnotations
    ? `

## CUE ANNOTATIONS (Phase D-2)

The screenplay text below contains pre-inserted \`[SPEAKER: NAME]\` annotations
above every character cue. Use these as the AUTHORITATIVE source of speaker
attribution — every dialogue line directly following a \`[SPEAKER: NAME]\`
annotation should be attributed to that character.

- Do NOT emit \`[SPEAKER: ...]\` text inside any dialogue field.
- Do NOT re-detect or second-guess the annotated speaker.
- Action / description lines (with no preceding annotation) are NARRATOR.

This makes speaker attribution deterministic and frees you to focus on
dialogue cleanup, mood, intensity, and scene metadata.
`
    : '';

  return `You are a screenplay-to-audio conversion specialist.
Parse the screenplay chunk into structured scene JSON.

${SCRIPT_ABBREVIATIONS}
${cueAnnotationBlock}
## VOICE LOOKUP TABLE (use these voice IDs — do NOT invent or search)

${voiceTable}

DEFAULT_NARRATOR → ${voiceMap.default_narrator_voice}
DEFAULT_MALE     → ${voiceMap.default_male_voice}
DEFAULT_FEMALE   → ${voiceMap.default_female_voice}

If a character name is not in the table above, use DEFAULT_MALE or DEFAULT_FEMALE as appropriate.
NARRATOR lines always use DEFAULT_NARRATOR.

## SCENE PARSING RULES

### Scene Boundaries
Each scene begins with a slugline (INT. / EXT. / INT./EXT. header).
One scene object per slugline.

### dialogue Array — INCLUDE EVERY LINE
Every line of the script must appear in the dialogue array, in order:

- **Slugline / scene heading** → do NOT include as a dialogue entry; it becomes the scene metadata (scene_id, mood, intensity).
- **Action / description lines** → { "character": "NARRATOR", "voice_key": "<DEFAULT_NARRATOR>", "text": "<line verbatim>" }
- **Character dialogue** → { "character": "<CHARACTER_NAME>", "voice_key": "<from table>", "text": "<cleaned dialogue>" }

### Text Cleanup
- Remove parenthetical stage directions from dialogue: (O.S.), (V.O.), (CONT'D), (quietly), etc.
- Preserve contractions exactly: "I'm" stays "I'm" — do NOT expand to "I am"
- Expand slugline abbreviations per the SCRIPT ABBREVIATION EXPANSIONS section above
  e.g., "INT. KEVIN'S HOUSE - DAY" → description text "Interior. Kevin's House. Day." (for Narrator)
  but the scene's scene_id/mood uses the original location
- Keep action lines verbatim — do not paraphrase

### scene_id Numbering
First scene in this chunk = scene_${startSceneNum.toString().padStart(3, '0')}
Increment by 1 for each subsequent scene.
Format: "scene_001", "scene_016", etc.

### line_id Numbering
Reset to line_001 at the start of EACH scene.
Format: "line_001", "line_002", etc.

### mood and intensity
- mood: a short phrase describing the scene's emotional tone (e.g., "tense confrontation", "quiet grief")
- intensity: 0.0–1.0
  0.2 = gentle/quiet  |  0.5 = moderate dialogue  |  0.7 = tense/argument  |  1.0 = peak action

### character_age / character_gender / character_ethnicity
Include these on the FIRST appearance of each character (first dialogue line for that character in the scene).
Omit on subsequent lines for the same character within the same scene.

### Audio fields (music, ambience, sfx)
Leave empty / omit entirely. Audio is assigned by a separate agent.

## OUTPUT
Return a JSON object: { "scenes": [ ... ] }
No markdown. No prose. Raw JSON only.
`;
}

/**
 * Build a human-readable lookup table from a VoiceMap.
 * Format: CHARACTER_NAME → voice_key  (voice_name, gender)
 */
function buildVoiceTable(voiceMap: VoiceMap): string {
  const lines: string[] = [];
  for (const [name, assignment] of Object.entries(voiceMap.assignments)) {
    const meta: string[] = [];
    if (assignment.voice_name) meta.push(assignment.voice_name);
    if (assignment.gender) meta.push(assignment.gender);
    if (assignment.age) meta.push(`age ~${assignment.age}`);
    const suffix = meta.length > 0 ? `  (${meta.join(', ')})` : '';
    lines.push(`${name.padEnd(28)} → ${assignment.voice_key}${suffix}`);
  }
  return lines.join('\n');
}

/**
 * Build the user message for one script chunk.
 */
export function buildSceneConstructionUserMessage(chunkText: string): string {
  return `Parse the following screenplay chunk into scene JSON using the voice lookup table in the system prompt.

SCREENPLAY CHUNK:
${chunkText}`;
}
