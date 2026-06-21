/**
 * Director JSON Validator - Validates and auto-corrects Director JSON output
 *
 * This is the TypeScript port of Python's DirectorJSONValidator.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { log } from '../../lib/logger.js';
import { ValidationError, DirectorValidationErrorTypes } from './validation-error.js';
import type { DirectorJSON, Scene, DialogueLine } from '../../schemas/director-json.js';
import { searchVoicesHybrid, getAgeRange, type AgeRange } from '../tools/hybrid-voice-search.js';
import {
  DEFAULT_NARRATOR_VOICE,
  DEFAULT_MALE_VOICE,
  DEFAULT_FEMALE_VOICE,
} from '../../schemas/voice-map.js';

// Pattern to detect placeholder voice IDs (not real ElevenLabs IDs)
// Real IDs are 20-char alphanumeric strings
const PLACEHOLDER_PATTERNS = [
  /^REPLACE_WITH_/i,
  /voice_id$/i,
  /placeholder/i,
  /^narrator_voice/i,
  /^character_voice/i,
  /voice_here/i,
  /^xxx/i,
  /^TODO/i,
];

function isPlaceholderVoiceId(voiceId: string): boolean {
  if (!voiceId) return true;

  // Check against known placeholder patterns
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(voiceId)) {
      return true;
    }
  }

  // Real ElevenLabs IDs are 20 characters, alphanumeric
  // If it's too long, has spaces, or underscores in wrong places, it's likely a placeholder
  if (voiceId.length > 30 || voiceId.includes(' ') || voiceId.includes('_')) {
    return true;
  }

  return false;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to voice catalog
const VOICE_CATALOG_PATH = join(__dirname, '../../../knowledge_bases/voice_embeddings_store/voices_metadata.json');

interface VoiceMetadata {
  voice_id: string;
  name: string;
  label: string;
  gender: 'Male' | 'Female';
  tone: string[] | string;
  style: string;
  description?: string;
}

interface CharacterInfo {
  name: string;
  age?: number;
  gender?: string;
  ethnicity?: string;
  voice_key?: string;
}

export class DirectorJSONValidator {
  private voiceCatalog: VoiceMetadata[];
  private errors: ValidationError[];

  constructor(voiceCatalog?: VoiceMetadata[]) {
    if (voiceCatalog) {
      this.voiceCatalog = voiceCatalog;
    } else {
      // Auto-load voice catalog
      try {
        const catalogJson = readFileSync(VOICE_CATALOG_PATH, 'utf-8');
        this.voiceCatalog = JSON.parse(catalogJson);
        log.info('DirectorValidator loaded voices for validation', { count: this.voiceCatalog.length });
      } catch (err) {
        log.warn('DirectorValidator voice catalog not found', { error: String(err) });
        this.voiceCatalog = [];
      }
    }
    this.errors = [];
  }

  /**
   * Validate Director JSON
   */
  validate(directorJson: DirectorJSON): { isValid: boolean; errors: ValidationError[] } {
    this.errors = [];

    if (this.voiceCatalog.length === 0) {
      log.warn('DirectorValidator: voice catalog is empty — teen/ethnicity voice checks are disabled. Check that voice_embeddings_store/voices_metadata.json is present.');
    }

    log.info('Starting Director JSON validation', { voiceCatalogSize: this.voiceCatalog.length, sceneCount: directorJson.scenes?.length || 0 });

    // Extract character metadata from dialogue
    const characters = this.extractCharacterInfo(directorJson);

    log.debug('Characters detected', { characters: Object.fromEntries(Object.entries(characters).map(([name, info]) => [name, { age: info.age, ethnicity: info.ethnicity, voice: info.voice_key }])) });

    // Check for placeholder voice IDs first (critical error)
    this.validateNoPlaceholderVoices(directorJson);

    // Validate voice assignments
    this.validateVoiceAssignments(directorJson, characters);

    // Validate voice uniqueness
    this.validateVoiceUniqueness(directorJson);

    // A-005 (2026-06-15): Ryan's batch 2026-06-15 reported character voices
    // occasionally reading parts of action lines / parentheticals. The
    // director-agent prompt RULE 2 already says action goes to Narrator, but
    // the model sometimes ignores it. Catch + auto-fix the violations.
    this.autoReassignStageDirectionsToNarrator(directorJson);

    log.info('Validation complete', { errorCount: this.errors.length });

    return { isValid: this.errors.length === 0, errors: this.errors };
  }

  /**
   * A-005 — When a character line's text looks like stage direction (all-caps
   * action, leading parenthetical, screenplay-only words like FADE TO, CUT TO,
   * INT./EXT.), silently reassign it to "Narrator" instead of speaking it in
   * the character's voice. This mutates `directorJson` in place because
   * fixing this kind of issue is always safe (it can only ever degrade to
   * "the narrator says this instead of CharacterX saying it" — both legal
   * outputs, the narrator one matches script intent).
   *
   * Not added to `this.errors` because it's not a true validation failure —
   * the JSON is structurally valid, just slightly off-intent. A log line is
   * enough to surface it during triage.
   */
  private autoReassignStageDirectionsToNarrator(directorJson: DirectorJSON): void {
    let reassigned = 0;

    // Patterns that strongly suggest a line is stage direction, not dialogue.
    // Kept conservative — we'd rather miss a true positive than mis-reassign
    // an actual line of dialogue that happens to look like action.
    //
    // 2026-06-21 — Ryan reproducer expanded coverage:
    //   1. Third-person openings (He/She/They/It + verb)
    //   2. Environmental subjects (The X verbs / A X rises / Outside…)
    //   3. Beat / Pause / Silence single-word direction
    //   4. Camera prepositions (Off her / On the / Through the)
    //   5. Cinematic narration (WE SEE / WE HEAR / WE FEEL)
    //   6. Additional transitions (BACK TO / END FLASHBACK / INTERCUT WITH)
    //   7. ALL-CAPS character name + lowercase action verb ("JACK turns…")
    //   8. Wrapped action markers ([whispering] / *action* / {action})
    //   9. Closed SFX vocab (BANG. CRASH. BOOM!) — short ALL-CAPS slipped past
    //      the >20-char isMostlyUppercase guard.
    //
    // Negative-case discipline: every pattern below was checked against the
    // existing positive-dialogue cases in director-validator-a005.test.ts
    // AND director-validator-a005-edges.test.ts so it can't mis-reassign
    // shouted "STOP IT!" or first-person lines starting with "I ".
    const STAGE_DIRECTION_PATTERNS: RegExp[] = [
      // ── Original 16 patterns ──────────────────────────────────────
      /^\s*\(/,                                  // Leading parenthetical (whispering), (V.O.), etc.
      /^\s*(?:INT|EXT|INT\.\/EXT|I\/E)\b\.?\s/i, // Scene headers
      /^\s*FADE (?:IN|OUT|TO)\b/i,               // Transitions
      /^\s*CUT TO\b/i,
      /^\s*DISSOLVE TO\b/i,
      /^\s*SMASH CUT\b/i,
      /^\s*MATCH CUT\b/i,
      /^\s*CLOSE ON\b/i,
      /^\s*ANGLE ON\b/i,
      /^\s*PAN (?:UP|DOWN|LEFT|RIGHT|TO|ACROSS)\b/i,
      /^\s*POV[\s:]/i,
      /^\s*SUPER:/i,
      /^\s*TITLE:/i,
      /^\s*BEGIN MONTAGE\b/i,
      /^\s*END MONTAGE\b/i,
      /^\s*REVEAL:/i,
      // ── 2026-06-21 additions ─────────────────────────────────────
      // 1. Third-person + verb-s: "He turns", "She walks", "They both stare",
      //    "It begins to rain". First-person "I" + "You" are NOT included
      //    because they're the typical dialogue grammar.
      /^\s*(?:He|She|They|It)\s+\w+(?:s|ed|ing)?\s/,
      // 2. Environmental description: "The wind blows", "The clock ticks",
      //    "Rain begins", "A whisper rises", "Outside, a car passes".
      /^\s*The\s+\w+\s+(?:blows|ticks|passes|begins|falls|rises|drips|slams|opens|closes|howls|whistles|creaks|groans|crashes|whispers|echoes|hums|buzzes|drones|chimes|rings|rumbles)\b/i,
      /^\s*(?:Outside|Inside|Above|Below|Behind|Beside|Across|Around)\b[,\s]/i,
      /^\s*(?:A|An)\s+\w+\s+(?:rises|falls|begins|ticks|howls|drips|crashes|whispers|echoes|hums|drones|chimes|appears|enters|exits|passes|sounds)\b/i,
      /^\s*(?:Rain|Snow|Wind|Thunder|Lightning|Silence|Sound|Music|Footsteps|Time|Memories)\s+\w+/i,
      // 3. Beat / Pause / Silence single-word beats
      /^\s*(?:Beat|Pause|Silence|Quiet|Stillness)\s*[.!?]?\s*$/i,
      // 4. Camera preposition shorthand: "Off her stare.", "On the radio.",
      //    "Through the window." — require a determiner so we don't catch
      //    spoken "Off you go!" or "On a Thursday".
      /^\s*(?:Off|On|Through|Above|Below|Beside|Behind|Beneath)\s+(?:her|his|their|its|the|a|an)\b/i,
      // 5. Cinematic narration WE SEE / WE HEAR / WE FEEL / WE WATCH
      /^\s*WE\s+(?:SEE|HEAR|FEEL|WATCH|FOLLOW|FIND|PAN|MOVE)\b/i,
      // 6. Additional transitions
      /^\s*INTERCUT\s+WITH\b/i,
      /^\s*BACK\s+TO\b/i,
      /^\s*END\s+(?:FLASHBACK|MONTAGE|DREAM|SEQUENCE)\b/i,
      /^\s*FLASHBACK\s*(?::|\b)/i,
      // 7. ALL-CAPS character name + lowercase action verb: "JACK turns…"
      //    Requires 2+ uppercase letters, a space, then a known action verb.
      //    The closed verb vocab keeps this from matching "OK then" or shouts.
      /^\s*[A-Z]{2,}\s+(?:turns|walks|runs|stops|enters|exits|reaches|grabs|sits|stands|points|looks|backs|sets|picks|pulls|pushes|opens|closes|slams|stares|glares|nods|shakes|smiles|frowns|cries|laughs|whispers|shouts|screams|gasps|sighs|breathes|moves|crosses|approaches|leaves|returns|hesitates|kneels|rises|falls|drops|lifts|holds|gestures)\b/,
      // 8. Wrapped action markers
      /^\s*\[/,        // [whispering] Get down.
      /^\s*\*[^*]/,    // *She looks down.*  (require non-* after to avoid italic emphasis in middle of dialogue)
      /^\s*\{/,        // {action: glares}
      // 9. SFX vocab — short ALL-CAPS one-words that slip past the
      //    isMostlyUppercase >20-char guard. Vocab list keeps "STOP!" /
      //    "NO!" / "HELP!" out of the false-positive bucket.
      /^\s*(?:BANG|CRASH|BOOM|THUD|SLAM|POW|BAM|WHOOSH|SMASH|ROAR|RUMBLE|SCREECH|HONK|BUZZ|BEEP|CLICK|DING|GONG|CHIME|TICK|TOCK|KNOCK|TAP|RAP|SNAP|CRACK|HISS|SIZZLE|SPLASH|SPLAT|GUSH|PLOP|WHACK|THWACK|CLANG|CLATTER|RATTLE|CREAK|GROAN|GRUNT)[.!?]\s*$/i,
    ];

    // Heuristic: a sentence that's >50% UPPERCASE and >20 chars is almost
    // certainly stage direction (real dialogue rarely shouts that hard).
    const isMostlyUppercase = (text: string): boolean => {
      const letters = text.replace(/[^a-zA-Z]/g, '');
      if (letters.length < 20) return false;
      const upper = letters.replace(/[^A-Z]/g, '').length;
      return upper / letters.length > 0.5;
    };

    for (const scene of directorJson.scenes || []) {
      for (const line of scene.dialogue || []) {
        if (line.character === 'Narrator') continue;
        if (!line.text || line.text.length === 0) continue;

        const looksLikeStageDirection =
          STAGE_DIRECTION_PATTERNS.some((p) => p.test(line.text)) ||
          isMostlyUppercase(line.text);

        if (looksLikeStageDirection) {
          log.warn('[A-005] reassigning character line that looks like stage direction to Narrator', {
            originalCharacter: line.character,
            preview: line.text.slice(0, 80),
            sceneId: scene.scene_id,
            lineId: line.line_id,
          });
          line.character = 'Narrator';
          // Drop the voice_key so voice-assignment picks the narrator voice.
          // We can't just substitute the narrator voice_key here because
          // the validator may not have access to it (depends on call order).
          line.voice_key = undefined as unknown as string;
          reassigned++;
        }
      }
    }

    if (reassigned > 0) {
      log.info('[A-005] reassigned stage-direction lines to Narrator', { count: reassigned });
    }
  }

  /**
   * Automatically fix validation errors
   */
  autoCorrect(directorJson: DirectorJSON): DirectorJSON {
    // First validate to find errors
    const { isValid, errors } = this.validate(directorJson);

    if (isValid) {
      log.info('No validation errors found - no corrections needed');
      return directorJson;
    }

    log.warn('Found validation errors - applying auto-corrections', { errorCount: errors.length });

    let corrected: DirectorJSON = JSON.parse(JSON.stringify(directorJson));

    // First pass: fix placeholder voice IDs (most critical)
    corrected = this.fixPlaceholderVoices(corrected);

    // Second pass: fix other validation errors
    for (const error of errors) {
      switch (error.errorType) {
        case DirectorValidationErrorTypes.TEEN_VOICE_WRONG_LABEL:
          corrected = this.fixTeenVoice(corrected, error);
          break;
        case DirectorValidationErrorTypes.ETHNICITY_MISMATCH:
          corrected = this.fixEthnicityMismatch(corrected, error);
          break;
        case DirectorValidationErrorTypes.DUPLICATE_VOICE:
          corrected = this.fixDuplicateVoice(corrected, error);
          break;
        // INVALID_VOICE_ID is handled by fixPlaceholderVoices
      }
    }

    // Validate again to confirm fixes
    const { errors: remainingErrors } = this.validate(corrected);

    if (remainingErrors.length > 0) {
      log.warn('Auto-correction incomplete', { remainingErrors: remainingErrors.length });
    } else {
      log.info('All validation errors successfully corrected');
    }

    return corrected;
  }

  /**
   * Extract character names, ages, ethnicities from Director JSON metadata fields
   */
  private extractCharacterInfo(directorJson: DirectorJSON): Record<string, CharacterInfo> {
    const characters: Record<string, CharacterInfo> = {};

    for (const scene of directorJson.scenes || []) {
      for (const line of scene.dialogue || []) {
        const charName = line.character;

        if (charName && charName !== 'Narrator') {
          if (!characters[charName]) {
            characters[charName] = {
              name: charName,
              age: undefined,
              ethnicity: undefined,
              gender: undefined,
              voice_key: line.voice_key,
            };
          }

          // Extract metadata from this line if present
          if (line.character_age != null) {
            characters[charName].age = line.character_age;
            log.debug('Found age metadata', { character: charName, age: line.character_age });
          }

          if (line.character_gender) {
            characters[charName].gender = line.character_gender;
            log.debug('Found gender metadata', { character: charName, gender: line.character_gender });
          }

          if (line.character_ethnicity) {
            characters[charName].ethnicity = line.character_ethnicity;
            log.debug('Found ethnicity metadata', { character: charName, ethnicity: line.character_ethnicity });
          }
        }
      }
    }

    return characters;
  }

  /**
   * Validate that no placeholder voice IDs are used
   */
  private validateNoPlaceholderVoices(directorJson: DirectorJSON): void {
    for (const scene of directorJson.scenes || []) {
      for (const line of scene.dialogue || []) {
        if (isPlaceholderVoiceId(line.voice_key)) {
          log.error('Validation error: placeholder voice ID detected', undefined, { voiceKey: line.voice_key, character: line.character });
          this.errors.push(
            new ValidationError(
              DirectorValidationErrorTypes.INVALID_VOICE_ID,
              `Placeholder voice ID "${line.voice_key}" used for character "${line.character}"`,
              `line:${line.line_id}`,
              {
                character: line.character,
                line_id: line.line_id,
                placeholder_voice: line.voice_key,
              }
            )
          );
        }
      }
    }
  }

  /**
   * Validate that voice assignments match character attributes
   */
  private validateVoiceAssignments(
    directorJson: DirectorJSON,
    characters: Record<string, CharacterInfo>
  ): void {
    // Create voice lookup
    const voiceMetadata = new Map<string, VoiceMetadata>();
    for (const voice of this.voiceCatalog) {
      voiceMetadata.set(voice.voice_id, voice);
    }

    for (const [charName, charInfo] of Object.entries(characters)) {
      const voiceKey = charInfo.voice_key;

      if (!voiceKey) {
        log.warn('No voice assigned to character', { character: charName });
        continue;
      }

      if (!voiceMetadata.has(voiceKey)) {
        log.warn('Voice not found in catalog', { voiceKey, character: charName });
        continue;
      }

      const voice = voiceMetadata.get(voiceKey)!;
      const voiceLabel = voice.label || '';
      const voiceStyle = voice.style || '';

      // Check teen age validation (17-19 years old)
      const charAge = charInfo.age;
      if (charAge !== undefined && charAge >= 17 && charAge <= 19) {
        // Teen character MUST have "Teen" in voice label
        if (!voiceLabel.includes('Teen')) {
          log.error('Validation error: teen character has wrong voice label', undefined, { character: charName, age: charAge, voiceLabel });
          this.errors.push(
            new ValidationError(
              DirectorValidationErrorTypes.TEEN_VOICE_WRONG_LABEL,
              `Character '${charName}' is ${charAge} years old but has voice label '${voiceLabel}' instead of 'Teen'`,
              `character:${charName}`,
              {
                character: charName,
                age: charAge,
                current_voice: voiceKey,
                current_label: voiceLabel,
              }
            )
          );
        }
      }

      // Check ethnicity matching
      const charEthnicity = charInfo.ethnicity;
      if (charEthnicity === 'African American') {
        if (voiceStyle !== 'African American') {
          log.error('Validation error: ethnicity mismatch', undefined, { character: charName, expectedStyle: 'African American', voiceStyle });
          this.errors.push(
            new ValidationError(
              DirectorValidationErrorTypes.ETHNICITY_MISMATCH,
              `Character '${charName}' is African American but voice style is '${voiceStyle}'`,
              `character:${charName}`,
              {
                character: charName,
                expected_style: 'African American',
                current_voice: voiceKey,
                current_style: voiceStyle,
              }
            )
          );
        }
      }
    }
  }

  /**
   * Validate that each character has a unique voice
   */
  private validateVoiceUniqueness(directorJson: DirectorJSON): void {
    const voiceUsage = new Map<string, string[]>();

    for (const scene of directorJson.scenes || []) {
      for (const line of scene.dialogue || []) {
        const charName = line.character;
        const voiceKey = line.voice_key;

        if (charName === 'Narrator' || !voiceKey) {
          continue;
        }

        if (!voiceUsage.has(voiceKey)) {
          voiceUsage.set(voiceKey, []);
        }

        const chars = voiceUsage.get(voiceKey)!;
        if (!chars.includes(charName)) {
          chars.push(charName);
        }
      }
    }

    // Find duplicates
    for (const [voiceKey, characters] of voiceUsage) {
      if (characters.length > 1) {
        log.error('Validation error: duplicate voice assignment', undefined, { voiceKey, characters });
        this.errors.push(
          new ValidationError(
            DirectorValidationErrorTypes.DUPLICATE_VOICE,
            `Voice ${voiceKey} assigned to multiple characters: ${characters.join(', ')}`,
            `voice:${voiceKey}`,
            { voice_key: voiceKey, characters }
          )
        );
      }
    }
  }

  /**
   * Fix all placeholder voice IDs by assigning real voices from catalog
   * Uses hybrid voice search to find best-matching voices based on character attributes
   */
  private fixPlaceholderVoices(directorJson: DirectorJSON): DirectorJSON {
    // Build a mapping of character name -> voice ID
    const characterVoices = new Map<string, string>();

    // First, extract character info for intelligent voice matching
    const characters = this.extractCharacterInfo(directorJson);

    // Track characters needing voice assignment
    const charactersNeedingVoices: string[] = [];

    for (const scene of directorJson.scenes || []) {
      for (const line of scene.dialogue || []) {
        const charName = line.character;

        if (isPlaceholderVoiceId(line.voice_key)) {
          if (!charactersNeedingVoices.includes(charName) && !characterVoices.has(charName)) {
            charactersNeedingVoices.push(charName);
          }
        } else {
          // Valid voice ID - track it
          if (!characterVoices.has(charName)) {
            characterVoices.set(charName, line.voice_key);
          }
        }
      }
    }

    // Now assign voices using hybrid search - we'll use sync version for validator
    // Process synchronously to avoid async complexity in validator
    for (const charName of charactersNeedingVoices) {
      const charInfo = characters[charName];
      const excludeVoiceIds = Array.from(characterVoices.values());

      let newVoice: string;

      if (charName === 'Narrator') {
        // Use narrator voice
        newVoice =
          this.voiceCatalog.find((v) => v.label?.includes('Narrator') && !excludeVoiceIds.includes(v.voice_id))
            ?.voice_id || DEFAULT_NARRATOR_VOICE;
      } else {
        // Find best matching voice using character attributes
        const gender = charInfo?.gender as 'Male' | 'Female' | undefined;
        const age = charInfo?.age;
        const ageRange = age ? getAgeRange(age) : undefined;
        const ethnicity = charInfo?.ethnicity;

        // Search local catalog with filters
        let matchingVoice = this.findMatchingVoice({
          gender,
          ageRange,
          style: ethnicity,
          excludeVoiceIds,
        });

        if (matchingVoice) {
          newVoice = matchingVoice;
          log.debug('Found matching voice for character', { voiceId: newVoice, character: charName, gender, age, ethnicity });
        } else {
          // Fallback: any unused voice
          const availableVoice = this.voiceCatalog.find((v) => !excludeVoiceIds.includes(v.voice_id));
          if (availableVoice) {
            newVoice = availableVoice.voice_id;
          } else {
            // Ultimate fallback: use defaults based on gender hint
            newVoice = gender === 'Female' ? DEFAULT_FEMALE_VOICE : DEFAULT_MALE_VOICE;
          }
        }
      }

      characterVoices.set(charName, newVoice);
      log.debug('Assigned voice to character', { voiceId: newVoice, character: charName });
    }

    // Now update all lines with the assigned voices
    for (const scene of directorJson.scenes || []) {
      for (const line of scene.dialogue || []) {
        if (isPlaceholderVoiceId(line.voice_key)) {
          const newVoice = characterVoices.get(line.character);
          if (newVoice) {
            line.voice_key = newVoice;
          }
        }
      }
    }

    return directorJson;
  }

  /**
   * Find a voice matching the given criteria from the local catalog
   */
  private findMatchingVoice(criteria: {
    gender?: 'Male' | 'Female';
    ageRange?: AgeRange;
    style?: string;
    excludeVoiceIds?: string[];
  }): string | null {
    const { gender, ageRange, style, excludeVoiceIds = [] } = criteria;

    // Priority 1: Match all criteria
    for (const voice of this.voiceCatalog) {
      if (excludeVoiceIds.includes(voice.voice_id)) continue;

      // Check gender
      if (gender && voice.gender !== gender) continue;

      // Check age range via label
      if (ageRange) {
        const label = voice.label?.toLowerCase() || '';
        const patterns = this.getAgeLabelPatterns(ageRange);
        if (!patterns.some((p) => label.includes(p.toLowerCase()))) continue;
      }

      // Check style/ethnicity
      if (style && voice.style?.toLowerCase() !== style.toLowerCase()) continue;

      return voice.voice_id;
    }

    // Priority 2: Match gender and style (relax age)
    if (gender || style) {
      for (const voice of this.voiceCatalog) {
        if (excludeVoiceIds.includes(voice.voice_id)) continue;
        if (gender && voice.gender !== gender) continue;
        if (style && voice.style?.toLowerCase() !== style.toLowerCase()) continue;

        return voice.voice_id;
      }
    }

    // Priority 3: Match gender only
    if (gender) {
      for (const voice of this.voiceCatalog) {
        if (excludeVoiceIds.includes(voice.voice_id)) continue;
        if (voice.gender === gender) return voice.voice_id;
      }
    }

    // Priority 4: Any unused voice
    for (const voice of this.voiceCatalog) {
      if (!excludeVoiceIds.includes(voice.voice_id)) {
        return voice.voice_id;
      }
    }

    return null;
  }

  /**
   * Get label patterns for an age range
   */
  private getAgeLabelPatterns(ageRange: AgeRange): string[] {
    switch (ageRange) {
      case 'child':
        return ['Under 10', 'Child'];
      case 'teen':
        return ['Teen'];
      case 'young_adult':
        return ['20s to 30s', 'Young Adult', '20s', '30s'];
      case 'older':
        return ['Older', 'Mature', '40s', '50s', '60s'];
    }
  }

  /**
   * Fix teen character with wrong voice label
   */
  private fixTeenVoice(directorJson: DirectorJSON, error: ValidationError): DirectorJSON {
    const charName = error.fixData.character;
    const charAge = error.fixData.age;
    const currentVoice = error.fixData.current_voice;

    log.info('Attempting to fix teen voice', { character: charName, age: charAge, currentVoice });

    // Get current voice to match gender if possible
    const currentVoiceData = this.voiceCatalog.find((v) => v.voice_id === currentVoice);
    const currentGender = currentVoiceData?.gender;

    // Find teen voices, prefer same gender
    let teenVoices = this.voiceCatalog.filter((v) => v.label?.includes('Teen'));

    if (teenVoices.length === 0) {
      log.warn('No teen voices available in catalog', { character: charName });
      return directorJson;
    }

    // Try to match gender if known
    if (currentGender) {
      const matchingGender = teenVoices.filter((v) => v.gender === currentGender);
      if (matchingGender.length > 0) {
        teenVoices = matchingGender;
      }
    }

    // Get already used voices to avoid duplicates
    const usedVoices = this.getUsedVoices(directorJson);

    // Find unused teen voice
    let newVoice: string | null = null;
    for (const voice of teenVoices) {
      if (!usedVoices.has(voice.voice_id) || voice.voice_id === currentVoice) {
        newVoice = voice.voice_id;
        break;
      }
    }

    if (!newVoice) {
      // If all used, just take first teen voice
      newVoice = teenVoices[0].voice_id;
    }

    // Update all instances of this character
    let updatedCount = 0;
    for (const scene of directorJson.scenes || []) {
      for (const line of scene.dialogue || []) {
        if (line.character === charName) {
          line.voice_key = newVoice;
          updatedCount++;
        }
      }
    }

    log.info('Fixed teen voice', { character: charName, oldVoice: currentVoice, newVoice, updatedCount });
    return directorJson;
  }

  /**
   * Fix ethnicity mismatch between character and voice
   */
  private fixEthnicityMismatch(directorJson: DirectorJSON, error: ValidationError): DirectorJSON {
    const charName = error.fixData.character;
    const expectedStyle = error.fixData.expected_style;
    const currentVoice = error.fixData.current_voice;

    log.info('Attempting to fix ethnicity mismatch', { character: charName, expectedStyle });

    // Find voices matching ethnicity
    const matchingVoices = this.voiceCatalog.filter((v) => v.style === expectedStyle);

    if (matchingVoices.length === 0) {
      log.warn('No matching ethnicity voices available', { character: charName, expectedStyle });
      return directorJson;
    }

    // Get used voices
    const usedVoices = this.getUsedVoices(directorJson);

    // Find unused matching voice
    let newVoice: string | null = null;
    for (const voice of matchingVoices) {
      if (!usedVoices.has(voice.voice_id)) {
        newVoice = voice.voice_id;
        break;
      }
    }

    if (!newVoice) {
      newVoice = matchingVoices[0].voice_id;
    }

    // Update all instances
    let updatedCount = 0;
    for (const scene of directorJson.scenes || []) {
      for (const line of scene.dialogue || []) {
        if (line.character === charName) {
          line.voice_key = newVoice;
          updatedCount++;
        }
      }
    }

    log.info('Fixed ethnicity mismatch', { character: charName, expectedStyle, newVoice, updatedCount });
    return directorJson;
  }

  /**
   * Fix duplicate voice assignments
   */
  private fixDuplicateVoice(directorJson: DirectorJSON, error: ValidationError): DirectorJSON {
    const voiceKey = error.fixData.voice_key;
    const characters = error.fixData.characters || [];

    log.info('Fixing duplicate voice assignment', { voiceKey, characters });

    // Keep first character with this voice, reassign others
    for (const charName of characters.slice(1)) {
      // Find alternative voice
      const alternative = this.findAlternativeVoice(directorJson);

      if (alternative) {
        // Update all instances
        let updatedCount = 0;
        for (const scene of directorJson.scenes || []) {
          for (const line of scene.dialogue || []) {
            if (line.character === charName) {
              line.voice_key = alternative;
              updatedCount++;
            }
          }
        }

        log.info('Fixed duplicate voice', { character: charName, oldVoice: voiceKey, newVoice: alternative, updatedCount });
      }
    }

    return directorJson;
  }

  /**
   * Get all currently used voices
   */
  private getUsedVoices(directorJson: DirectorJSON): Set<string> {
    const usedVoices = new Set<string>();
    for (const scene of directorJson.scenes || []) {
      for (const line of scene.dialogue || []) {
        if (line.voice_key) {
          usedVoices.add(line.voice_key);
        }
      }
    }
    return usedVoices;
  }

  /**
   * Find an alternative voice not currently in use
   */
  private findAlternativeVoice(directorJson: DirectorJSON): string | null {
    const usedVoices = this.getUsedVoices(directorJson);

    // Find unused voice from catalog
    for (const voice of this.voiceCatalog) {
      if (!usedVoices.has(voice.voice_id)) {
        return voice.voice_id;
      }
    }

    // If all voices used, return first available (fallback)
    return this.voiceCatalog.length > 0 ? this.voiceCatalog[0].voice_id : null;
  }
}
