/**
 * Validation - Export all validation classes and types
 */

export {
  ValidationError,
  DirectorValidationErrorTypes,
  AudioValidationErrorTypes,
} from './validation-error.js';
export type { ValidationErrorData } from './validation-error.js';

export { DirectorJSONValidator } from './director-validator.js';
export { SceneAudioValidator } from './audio-validator.js';

// Re-export Zod-inferred types for convenience
export type {
  DirectorJSON,
  SceneAudioJSON,
  Scene,
  DialogueLine,
  AudioCue,
  ValidationReport,
  PipelineResult,
} from '../../schemas/director-json.js';
