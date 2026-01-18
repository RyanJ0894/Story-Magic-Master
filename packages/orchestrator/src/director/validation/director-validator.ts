/**
 * Director JSON Validator - Validates and auto-corrects Director JSON output
 *
 * This is the TypeScript port of Python's DirectorJSONValidator.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ValidationError, DirectorValidationErrorTypes } from './validation-error.js';
import type { DirectorJSON, Scene, DialogueLine } from '../../schemas/director-json.js';

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
        console.log(`[DirectorValidator] Loaded ${this.voiceCatalog.length} voices for validation`);
      } catch (err) {
        console.warn(`[DirectorValidator] Voice catalog not found: ${err}`);
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

    console.log('=== STARTING DIRECTOR JSON VALIDATION ===');
    console.log(`Voice catalog size: ${this.voiceCatalog.length}`);
    console.log(`Scenes to validate: ${directorJson.scenes?.length || 0}`);

    // Extract character metadata from dialogue
    const characters = this.extractCharacterInfo(directorJson);

    console.log(`Characters detected: ${Object.keys(characters).join(', ')}`);
    for (const [charName, info] of Object.entries(characters)) {
      console.log(`  ${charName}: age=${info.age}, ethnicity=${info.ethnicity}, voice=${info.voice_key}`);
    }

    // Validate voice assignments
    this.validateVoiceAssignments(directorJson, characters);

    // Validate voice uniqueness
    this.validateVoiceUniqueness(directorJson);

    console.log(`Validation complete: ${this.errors.length} errors found`);

    return { isValid: this.errors.length === 0, errors: this.errors };
  }

  /**
   * Automatically fix validation errors
   */
  autoCorrect(directorJson: DirectorJSON): DirectorJSON {
    // First validate to find errors
    const { isValid, errors } = this.validate(directorJson);

    if (isValid) {
      console.log('No validation errors found - no corrections needed');
      return directorJson;
    }

    console.warn(`Found ${errors.length} validation errors - applying auto-corrections`);

    let corrected: DirectorJSON = JSON.parse(JSON.stringify(directorJson));

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
      }
    }

    // Validate again to confirm fixes
    const { errors: remainingErrors } = this.validate(corrected);

    if (remainingErrors.length > 0) {
      console.warn(`Auto-correction incomplete - ${remainingErrors.length} errors remain`);
    } else {
      console.log('All validation errors successfully corrected');
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
          if (line.character_age !== undefined) {
            characters[charName].age = line.character_age;
            console.log(`✓ Found age metadata: ${charName} = ${line.character_age} years old`);
          }

          if (line.character_gender) {
            characters[charName].gender = line.character_gender;
            console.log(`✓ Found gender metadata: ${charName} = ${line.character_gender}`);
          }

          if (line.character_ethnicity) {
            characters[charName].ethnicity = line.character_ethnicity;
            console.log(`✓ Found ethnicity metadata: ${charName} = ${line.character_ethnicity}`);
          }
        }
      }
    }

    return characters;
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
        console.warn(`No voice assigned to ${charName}`);
        continue;
      }

      if (!voiceMetadata.has(voiceKey)) {
        console.warn(`Voice ${voiceKey} not found in catalog for ${charName}`);
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
          console.error(
            `VALIDATION ERROR: ${charName} is ${charAge} years old but has voice '${voiceLabel}' (not Teen)`
          );
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
          console.error(
            `VALIDATION ERROR: ${charName} is African American but has voice style '${voiceStyle}'`
          );
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
        console.error(
          `VALIDATION ERROR: Voice ${voiceKey} assigned to multiple characters: ${characters.join(', ')}`
        );
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
   * Fix teen character with wrong voice label
   */
  private fixTeenVoice(directorJson: DirectorJSON, error: ValidationError): DirectorJSON {
    const charName = error.fixData.character;
    const charAge = error.fixData.age;
    const currentVoice = error.fixData.current_voice;

    console.log(`Attempting to fix teen voice for ${charName} (age ${charAge}, current: ${currentVoice})`);

    // Get current voice to match gender if possible
    const currentVoiceData = this.voiceCatalog.find((v) => v.voice_id === currentVoice);
    const currentGender = currentVoiceData?.gender;

    // Find teen voices, prefer same gender
    let teenVoices = this.voiceCatalog.filter((v) => v.label?.includes('Teen'));

    if (teenVoices.length === 0) {
      console.warn(`No teen voices available in catalog to fix ${charName}`);
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

    console.log(
      `✓ Fixed ${charName}: Changed voice from ${currentVoice} to ${newVoice} (${updatedCount} lines updated)`
    );
    return directorJson;
  }

  /**
   * Fix ethnicity mismatch between character and voice
   */
  private fixEthnicityMismatch(directorJson: DirectorJSON, error: ValidationError): DirectorJSON {
    const charName = error.fixData.character;
    const expectedStyle = error.fixData.expected_style;
    const currentVoice = error.fixData.current_voice;

    console.log(`Attempting to fix ethnicity for ${charName} (needs ${expectedStyle})`);

    // Find voices matching ethnicity
    const matchingVoices = this.voiceCatalog.filter((v) => v.style === expectedStyle);

    if (matchingVoices.length === 0) {
      console.warn(`No ${expectedStyle} voices available to fix ${charName}`);
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

    console.log(
      `✓ Fixed ${charName}: Changed to ${expectedStyle} voice ${newVoice} (${updatedCount} lines updated)`
    );
    return directorJson;
  }

  /**
   * Fix duplicate voice assignments
   */
  private fixDuplicateVoice(directorJson: DirectorJSON, error: ValidationError): DirectorJSON {
    const voiceKey = error.fixData.voice_key;
    const characters = error.fixData.characters || [];

    console.log(`Fixing duplicate voice ${voiceKey} used by: ${characters.join(', ')}`);

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

        console.log(
          `✓ Fixed duplicate: ${charName} reassigned from ${voiceKey} to ${alternative} (${updatedCount} lines)`
        );
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
