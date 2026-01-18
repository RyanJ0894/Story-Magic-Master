/**
 * Director Pipeline - Sequential execution of DirectorAgent and AudioDirectorAgent
 *
 * This is the TypeScript port of Python's SequentialAgent and process_script function.
 * Includes validation and auto-correction for both Director JSON and Scene Audio JSON.
 */

import { DirectorAgent } from './agents/director-agent.js';
import { AudioDirectorAgent } from './agents/audio-director-agent.js';
import { DirectorJSONValidator } from './validation/director-validator.js';
import { SceneAudioValidator } from './validation/audio-validator.js';
import type {
  DirectorJSON,
  SceneAudioJSON,
  SceneAudioEntry,
  PipelineResult,
  ValidationReport,
} from '../schemas/director-json.js';

export interface PipelineOptions {
  directorModel?: string;
  audioDirectorModel?: string;
  maxIterations?: number;
}

export interface PipelineInput {
  project_id: string;
  script_text: string;
}

// Re-export for convenience
export type { PipelineResult, DirectorJSON, SceneAudioJSON };

/**
 * Run the full director pipeline: DirectorAgent → AudioDirectorAgent → Validation
 */
export async function processScript(
  input: PipelineInput,
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const directorAgent = new DirectorAgent({
    model: options.directorModel,
    maxIterations: options.maxIterations,
  });

  const audioDirectorAgent = new AudioDirectorAgent({
    model: options.audioDirectorModel,
    maxIterations: options.maxIterations,
  });

  const directorValidator = new DirectorJSONValidator();
  const audioValidator = new SceneAudioValidator();

  console.log(`[Pipeline] Starting script processing for project: ${input.project_id}`);

  // Phase 1: Run DirectorAgent
  // Agent now returns validated DirectorJSON (Zod-validated at boundary)
  console.log('[Pipeline] Phase 1: Running DirectorAgent...');
  let directorJson = await directorAgent.process(input);

  // Phase 2: Validate and auto-correct Director JSON (business rules)
  console.log('[Pipeline] Phase 2: Validating Director JSON...');
  const directorValidation = directorValidator.validate(directorJson);
  const directorValidationReport: ValidationReport = {
    is_valid: directorValidation.isValid,
    errors_found: directorValidation.errors.length,
    errors: directorValidation.errors.map((e) => e.toJSON()),
  };

  if (!directorValidation.isValid) {
    console.log('[Pipeline] Phase 2b: Auto-correcting Director JSON...');
    directorJson = directorValidator.autoCorrect(directorJson);
    directorValidationReport.auto_corrected = true;
  }

  // Phase 3: Run AudioDirectorAgent
  // Agent now returns validated SceneAudioJSON (Zod-validated at boundary)
  console.log('[Pipeline] Phase 3: Running AudioDirectorAgent...');
  let sceneAudioJson = await audioDirectorAgent.process(directorJson);

  // Phase 4: Validate and auto-correct Scene Audio JSON (business rules)
  console.log('[Pipeline] Phase 4: Validating Scene Audio JSON...');
  const audioValidation = audioValidator.validate(sceneAudioJson, directorJson);
  const audioValidationReport: ValidationReport = {
    is_valid: audioValidation.isValid,
    errors_found: audioValidation.errors.length,
    errors: audioValidation.errors.map((e) => e.toJSON()),
  };

  if (!audioValidation.isValid) {
    console.log('[Pipeline] Phase 4b: Auto-correcting Scene Audio JSON...');
    sceneAudioJson = audioValidator.autoCorrect(sceneAudioJson, directorJson);
    audioValidationReport.auto_corrected = true;
  }

  // Phase 5: Merge results
  console.log('[Pipeline] Phase 5: Merging results...');
  const mergedResult = mergeDirectorAndAudio(directorJson, sceneAudioJson);

  console.log('[Pipeline] Complete');

  return {
    project_id: input.project_id,
    director_json: mergedResult,
    scene_audio_json: sceneAudioJson,
    validation_report: {
      director_validation: directorValidationReport,
      audio_validation: audioValidationReport,
    },
  };
}

/**
 * Merge Director JSON with Audio selections
 */
function mergeDirectorAndAudio(
  directorJson: DirectorJSON,
  audioJson: SceneAudioJSON
): DirectorJSON {
  // Deep clone the director JSON
  const result: DirectorJSON = JSON.parse(JSON.stringify(directorJson));

  // Create a map of audio scenes by scene_id
  const audioMap = new Map<string, SceneAudioEntry>();
  for (const scene of audioJson.scenes || []) {
    audioMap.set(scene.scene_id, scene);
  }

  // Merge audio into director scenes
  for (const scene of result.scenes || []) {
    const audioScene = audioMap.get(scene.scene_id);

    if (audioScene) {
      scene.music = audioScene.music || [];
      scene.ambience = audioScene.ambience || [];
      scene.sfx = audioScene.sfx || [];
    } else {
      scene.music = [];
      scene.ambience = [];
      scene.sfx = [];
    }
  }

  return result;
}

/**
 * Create a reusable pipeline instance
 */
export class DirectorPipeline {
  private directorAgent: DirectorAgent;
  private audioDirectorAgent: AudioDirectorAgent;
  private options: PipelineOptions;

  constructor(options: PipelineOptions = {}) {
    this.options = options;
    this.directorAgent = new DirectorAgent({
      model: options.directorModel,
      maxIterations: options.maxIterations,
    });

    this.audioDirectorAgent = new AudioDirectorAgent({
      model: options.audioDirectorModel,
      maxIterations: options.maxIterations,
    });
  }

  /**
   * Process a script through the full pipeline
   */
  async process(input: PipelineInput): Promise<PipelineResult> {
    return processScript(input, this.options);
  }

  /**
   * Run only the DirectorAgent (for testing)
   */
  async runDirector(input: PipelineInput): Promise<DirectorJSON> {
    const result = await this.directorAgent.process(input);
    return result as DirectorJSON;
  }

  /**
   * Run only the AudioDirectorAgent (for testing)
   */
  async runAudioDirector(directorJson: DirectorJSON): Promise<SceneAudioJSON> {
    const result = await this.audioDirectorAgent.process(directorJson);
    return result as SceneAudioJSON;
  }
}
