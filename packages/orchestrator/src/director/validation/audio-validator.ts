/**
 * Scene Audio Validator - Validates and auto-corrects Scene Audio JSON output
 *
 * This is the TypeScript port of Python's SceneAudioValidator.
 */

import { log } from '../../lib/logger.js';
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

    log.info('Starting scene audio validation');

    // Build a scene_id → Scene map once (O(N)) instead of O(N²) linear search per scene
    const directorSceneMap = new Map<string, Scene>();
    for (const scene of directorJson.scenes || []) {
      directorSceneMap.set(scene.scene_id, scene);
    }

    // Validate each scene's audio selections
    for (const sceneAudio of sceneAudioJson.scenes || []) {
      const sceneId = sceneAudio.scene_id;

      // O(1) map lookup
      const directorScene = directorSceneMap.get(sceneId) ?? null;
      if (!directorScene) {
        log.warn('Could not find director scene', { sceneId });
        continue;
      }

      log.debug('Validating audio for scene', { sceneId });

      // Validate music
      this.validateMusic(sceneAudio, directorScene, sceneId);

      // Validate ambience
      this.validateAmbience(sceneAudio, directorScene, sceneId);

      // Validate SFX
      this.validateSfx(sceneAudio, directorScene, sceneId);
    }

    log.info('Scene audio validation complete', { errorCount: this.errors.length });

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
      log.info('No validation errors found - no corrections needed');
      return sceneAudioJson;
    }

    log.warn('Found validation errors - applying auto-corrections', { errorCount: errors.length });

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
      log.warn('Auto-correction incomplete', { remainingErrors: remainingErrors.length });
    } else {
      log.info('All validation errors successfully corrected');
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
      log.warn('No music selected for scene', { sceneId });
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
      log.warn('Music mood contradiction: sad scene has uplifting music', { sceneId });
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
      log.warn('Music mood contradiction: tense scene has playful music', { sceneId });
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
      log.error('Validation error: scene requires ambience for location but has none', undefined, { sceneId });
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
          log.warn('Interior scene has outdoor ambience', { sceneId });
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
      log.warn('Scene exceeds maximum SFX count', { sceneId, sfxCount: sfx.length, max: 3 });
    }

    // Validate each SFX has a start_at line_id
    for (const effect of sfx) {
      if (!effect.start_at) {
        log.warn('SFX missing start_at line_id', { sceneId });
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

    log.info('Fixing missing music', { sceneId });

    // Find the scene and add default music
    for (const scene of sceneAudioJson.scenes) {
      if (scene.scene_id === sceneId) {
        scene.music = [
          {
            file: 'music/m_cinematic_neutral_01.mp3',
            reasoning: 'Auto-corrected: Added default neutral music',
          },
        ];
        log.info('Added default music to scene', { sceneId });
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

    log.info('Fixing missing ambience', { sceneId });

    // Find the scene and add ambience
    for (const scene of sceneAudioJson.scenes) {
      if (scene.scene_id === sceneId && expectedAmbience) {
        scene.ambience = [
          {
            file: `ambience/${expectedAmbience}`,
            reasoning: 'Auto-corrected: Added required ambience for location',
          },
        ];
        log.info('Added ambience to scene', { sceneId, ambience: expectedAmbience });
        break;
      }
    }

    return sceneAudioJson;
  }
}
