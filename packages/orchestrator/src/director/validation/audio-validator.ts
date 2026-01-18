/**
 * Scene Audio Validator - Validates and auto-corrects Scene Audio JSON output
 *
 * This is the TypeScript port of Python's SceneAudioValidator.
 */

import { ValidationError, AudioValidationErrorTypes } from './validation-error.js';
import type {
  DirectorJSON,
  SceneAudioJSON,
  Scene,
  SceneAudioEntry,
  AudioCue,
} from '../../schemas/director-json.js';

/**
 * Locations that REQUIRE ambience
 */
const MANDATORY_AMBIENCE_LOCATIONS: Record<string, string> = {
  FOREST: 'a_forest_calm_01.mp3',
  WOODS: 'a_forest_calm_01.mp3',
  PARKING_LOT: 'a_parking_lot_small_calm_crowds_01',
  HOSPITAL: 'a_hospital_hallway_01',
  CAFETERIA: 'a_public_spaces_people_mall_01',
  CAFE: 'a_public_spaces_people_mall_01',
  RESTAURANT: 'a_public_spaces_people_mall_01',
  OFFICE: 'a_office_cubicles_01',
  STREET: 'a_city_streets_busy_01',
  CITY: 'a_city_streets_busy_01',
  PARK: 'a_countryside_birds_01',
  BEACH: 'a_beach_waves_01',
  OCEAN: 'a_beach_waves_01',
  RIVER: 'a_forest_calm_01.mp3',
  MILITARY: 'a_military_medical_tent_01',
  ARMY: 'a_military_medical_tent_01',
};

/**
 * Generic interiors that may skip ambience
 */
const GENERIC_INTERIORS = ['BEDROOM', 'LIVING ROOM', 'KITCHEN', 'BATHROOM'];

export class SceneAudioValidator {
  private errors: ValidationError[];

  constructor() {
    this.errors = [];
  }

  /**
   * Validate Scene Audio JSON against knowledge base rules
   */
  validate(
    sceneAudioJson: SceneAudioJSON,
    directorJson: DirectorJSON
  ): { isValid: boolean; errors: ValidationError[] } {
    this.errors = [];

    console.log('=== STARTING SCENE AUDIO VALIDATION ===');

    // Validate each scene's audio selections
    for (const sceneAudio of sceneAudioJson.scenes || []) {
      const sceneId = sceneAudio.scene_id;

      // Find corresponding scene in director JSON
      const directorScene = this.findScene(directorJson, sceneId);
      if (!directorScene) {
        console.warn(`Could not find director scene for ${sceneId}`);
        continue;
      }

      console.log(`Validating audio for ${sceneId}`);

      // Validate music
      this.validateMusic(sceneAudio, directorScene, sceneId);

      // Validate ambience
      this.validateAmbience(sceneAudio, directorScene, sceneId);

      // Validate SFX
      this.validateSfx(sceneAudio, directorScene, sceneId);
    }

    console.log(`Scene audio validation complete: ${this.errors.length} errors found`);

    return { isValid: this.errors.length === 0, errors: this.errors };
  }

  /**
   * Auto-correct validation errors
   */
  autoCorrect(
    sceneAudioJson: SceneAudioJSON,
    directorJson: DirectorJSON
  ): SceneAudioJSON {
    const { isValid, errors } = this.validate(sceneAudioJson, directorJson);

    if (isValid) {
      console.log('No validation errors found - no corrections needed');
      return sceneAudioJson;
    }

    console.warn(`Found ${errors.length} validation errors - applying auto-corrections`);

    let corrected: SceneAudioJSON = JSON.parse(JSON.stringify(sceneAudioJson));

    for (const error of errors) {
      switch (error.errorType) {
        case AudioValidationErrorTypes.MISSING_MUSIC:
          corrected = this.fixMissingMusic(corrected, error);
          break;
        case AudioValidationErrorTypes.MISSING_AMBIENCE:
          corrected = this.fixMissingAmbience(corrected, error);
          break;
      }
    }

    // Validate again
    const { errors: remainingErrors } = this.validate(corrected, directorJson);

    if (remainingErrors.length > 0) {
      console.warn(`Auto-correction incomplete - ${remainingErrors.length} errors remain`);
    } else {
      console.log('All validation errors successfully corrected');
    }

    return corrected;
  }

  /**
   * Find the corresponding scene in Director JSON
   */
  private findScene(directorJson: DirectorJSON, sceneId: string): Scene | null {
    for (const scene of directorJson.scenes || []) {
      if (scene.scene_id === sceneId) {
        return scene;
      }
    }
    return null;
  }

  /**
   * Extract scene header from dialogue (usually first Narrator line)
   */
  private extractSceneHeader(directorScene: Scene): string {
    for (const line of directorScene.dialogue || []) {
      if (line.character === 'Narrator') {
        return line.text.toUpperCase();
      }
    }
    return '';
  }

  /**
   * Check if scene header is for an interior location
   */
  private isInterior(sceneHeader: string): boolean {
    return sceneHeader.includes('INT.') || sceneHeader.includes('INTERIOR');
  }

  /**
   * Check if scene header is for an exterior location
   */
  private isExterior(sceneHeader: string): boolean {
    return sceneHeader.includes('EXT.') || sceneHeader.includes('EXTERIOR');
  }

  /**
   * Check if scene header is a generic interior that can skip ambience
   */
  private isGenericInterior(sceneHeader: string): boolean {
    return GENERIC_INTERIORS.some((loc) => sceneHeader.includes(loc));
  }

  /**
   * Get required ambience for a scene header
   */
  private getRequiredAmbience(sceneHeader: string): string | null {
    for (const [keyword, ambienceFile] of Object.entries(MANDATORY_AMBIENCE_LOCATIONS)) {
      if (sceneHeader.includes(keyword.replace('_', ' ')) || sceneHeader.includes(keyword)) {
        return ambienceFile;
      }
    }
    return null;
  }

  /**
   * Validate music selection for scene
   */
  private validateMusic(sceneAudio: SceneAudioEntry, directorScene: Scene, sceneId: string): void {
    const music = sceneAudio.music || [];

    // RULE 1: Every scene should have music
    if (music.length === 0) {
      console.warn(`No music selected for ${sceneId}`);
      this.errors.push(
        new ValidationError(
          AudioValidationErrorTypes.MISSING_MUSIC,
          `Scene ${sceneId} has no music - every scene should have background music`,
          sceneId,
          { scene_id: sceneId }
        )
      );
      return;
    }

    // RULE 2: Check mood consistency (basic check)
    const musicFile = music[0].file?.toLowerCase() || '';
    const sceneMood = directorScene.mood?.toLowerCase() || '';

    // Check for obvious mood contradictions
    if (sceneMood.includes('sad') && (musicFile.includes('uplifting') || musicFile.includes('groovy'))) {
      console.warn(`Music mood contradiction in ${sceneId}: sad scene has uplifting music`);
      this.errors.push(
        new ValidationError(
          AudioValidationErrorTypes.MOOD_CONTRADICTION,
          `Scene ${sceneId} has sad mood but uplifting/groovy music`,
          sceneId,
          { scene_id: sceneId }
        )
      );
    }

    if (sceneMood.includes('tense') && musicFile.includes('playful')) {
      console.warn(`Music mood contradiction in ${sceneId}: tense scene has playful music`);
      this.errors.push(
        new ValidationError(
          AudioValidationErrorTypes.MOOD_CONTRADICTION,
          `Scene ${sceneId} has tense mood but playful music`,
          sceneId,
          { scene_id: sceneId }
        )
      );
    }
  }

  /**
   * Validate ambience selection for scene
   */
  private validateAmbience(
    sceneAudio: SceneAudioEntry,
    directorScene: Scene,
    sceneId: string
  ): void {
    const ambience = sceneAudio.ambience || [];
    const sceneHeader = this.extractSceneHeader(directorScene);

    // Check if scene requires ambience
    const requiredAmbience = this.getRequiredAmbience(sceneHeader);

    if (requiredAmbience && ambience.length === 0) {
      // Scene header contains mandatory location but no ambience selected
      console.error(`VALIDATION ERROR: ${sceneId} requires ambience for location but has none`);
      this.errors.push(
        new ValidationError(
          AudioValidationErrorTypes.MISSING_AMBIENCE,
          `Scene ${sceneId} requires ambience based on location (${sceneHeader.slice(0, 50)}...)`,
          sceneId,
          {
            scene_id: sceneId,
            location: sceneHeader,
            expected_ambience: requiredAmbience,
          }
        )
      );
    }

    // Check INT/EXT consistency
    if (ambience.length > 0) {
      const ambienceFile = ambience[0].file?.toLowerCase() || '';
      const isInt = this.isInterior(sceneHeader);
      const isExt = this.isExterior(sceneHeader);

      // Interior scenes should not have outdoor ambience
      if (isInt && !isExt) {
        const outdoorKeywords = ['forest', 'beach', 'street', 'countryside', 'nature', 'city'];
        const hasOutdoorAmbience = outdoorKeywords.some((kw) => ambienceFile.includes(kw));

        if (hasOutdoorAmbience && !sceneHeader.includes('WINDOW')) {
          console.warn(`Interior scene ${sceneId} has outdoor ambience`);
          this.errors.push(
            new ValidationError(
              AudioValidationErrorTypes.AMBIENCE_LOCATION_MISMATCH,
              `Interior scene ${sceneId} has outdoor ambience - should use indoor ambience`,
              sceneId,
              { scene_id: sceneId }
            )
          );
        }
      }
    }
  }

  /**
   * Validate SFX selection for scene
   */
  private validateSfx(sceneAudio: SceneAudioEntry, directorScene: Scene, sceneId: string): void {
    const sfx = sceneAudio.sfx || [];

    // RULE: Max 3 SFX per scene
    if (sfx.length > 3) {
      console.warn(`Scene ${sceneId} has ${sfx.length} SFX - maximum is 3`);
    }

    // Validate each SFX has a start_at line_id
    for (const effect of sfx) {
      if (!effect.start_at) {
        console.warn(`SFX in ${sceneId} missing start_at line_id`);
        this.errors.push(
          new ValidationError(
            AudioValidationErrorTypes.INVALID_SFX_TRIGGER,
            `SFX in scene ${sceneId} missing start_at line reference`,
            sceneId,
            { scene_id: sceneId }
          )
        );
      }
    }
  }

  /**
   * Fix missing music
   */
  private fixMissingMusic(sceneAudioJson: SceneAudioJSON, error: ValidationError): SceneAudioJSON {
    const sceneId = error.fixData.scene_id;

    console.log(`Fixing missing music for ${sceneId}`);

    // Find the scene and add default music
    for (const scene of sceneAudioJson.scenes) {
      if (scene.scene_id === sceneId) {
        scene.music = [
          {
            file: 'music/m_cinematic_neutral_01.mp3',
            reasoning: 'Auto-corrected: Added default neutral music',
          },
        ];
        console.log(`✓ Added default music to ${sceneId}`);
        break;
      }
    }

    return sceneAudioJson;
  }

  /**
   * Fix missing ambience
   */
  private fixMissingAmbience(
    sceneAudioJson: SceneAudioJSON,
    error: ValidationError
  ): SceneAudioJSON {
    const sceneId = error.fixData.scene_id;
    const expectedAmbience = error.fixData.expected_ambience;

    console.log(`Fixing missing ambience for ${sceneId}`);

    // Find the scene and add ambience
    for (const scene of sceneAudioJson.scenes) {
      if (scene.scene_id === sceneId && expectedAmbience) {
        scene.ambience = [
          {
            file: `ambience/${expectedAmbience}`,
            reasoning: 'Auto-corrected: Added required ambience for location',
          },
        ];
        console.log(`✓ Added ambience ${expectedAmbience} to ${sceneId}`);
        break;
      }
    }

    return sceneAudioJson;
  }
}
