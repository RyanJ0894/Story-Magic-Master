/**
 * Validation Error Types
 */

export interface ValidationErrorData {
  character?: string;
  age?: number;
  ethnicity?: string;
  current_voice?: string;
  current_label?: string;
  current_style?: string;
  expected_style?: string;
  voice_key?: string;
  characters?: string[];
  scene_id?: string;
  location?: string;
  expected_ambience?: string;
  [key: string]: unknown;
}

export class ValidationError {
  errorType: string;
  message: string;
  location: string;
  fixData: ValidationErrorData;

  constructor(
    errorType: string,
    message: string,
    location: string,
    fixData: ValidationErrorData = {}
  ) {
    this.errorType = errorType;
    this.message = message;
    this.location = location;
    this.fixData = fixData;
  }

  toString(): string {
    return `ValidationError(${this.errorType}: ${this.message} at ${this.location})`;
  }

  toJSON() {
    return {
      type: this.errorType,
      message: this.message,
      location: this.location,
      fix_data: this.fixData,
    };
  }
}

/**
 * Validation error types for Director JSON
 */
export const DirectorValidationErrorTypes = {
  TEEN_VOICE_WRONG_LABEL: 'TEEN_VOICE_WRONG_LABEL',
  ETHNICITY_MISMATCH: 'ETHNICITY_MISMATCH',
  DUPLICATE_VOICE: 'DUPLICATE_VOICE',
  MISSING_VOICE: 'MISSING_VOICE',
  INVALID_VOICE_ID: 'INVALID_VOICE_ID',
} as const;

/**
 * Validation error types for Scene Audio JSON
 */
export const AudioValidationErrorTypes = {
  MISSING_MUSIC: 'MISSING_MUSIC',
  MISSING_AMBIENCE: 'MISSING_AMBIENCE',
  AMBIENCE_LOCATION_MISMATCH: 'AMBIENCE_LOCATION_MISMATCH',
  INVALID_SFX_TRIGGER: 'INVALID_SFX_TRIGGER',
  MOOD_CONTRADICTION: 'MOOD_CONTRADICTION',
} as const;
