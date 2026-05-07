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
import { log } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { VoiceMapSchema, type VoiceMap } from '../schemas/voice-map.js';
import { buildDirectorNotesBlock, type DirectorNotes } from './utils/sanitize-director-notes.js';
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
  // Optional: character_name -> voice_id mapping for user-selected voices
  voice_overrides?: Record<string, string>;
  // Optional: pre-generation creative direction (already serialized JSON string)
  director_notes?: string;
}

// Re-export for convenience
export type { PipelineResult, DirectorJSON, SceneAudioJSON };

/**
 * Load a previously saved VoiceMap for a project.
 * Returns undefined if none exists or the stored data is not a valid VoiceMap.
 */
async function loadVoiceMap(projectId: string): Promise<VoiceMap | undefined> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { voiceAssignments: true },
    });
    if (!project) return undefined;
    const parsed = VoiceMapSchema.safeParse(project.voiceAssignments);
    if (parsed.success) {
      log.info('[Pipeline] loaded cached VoiceMap', {
        projectId,
        assignmentCount: Object.keys(parsed.data.assignments).length,
      });
      return parsed.data;
    }
  } catch (err) {
    log.warn('[Pipeline] failed to load cached VoiceMap', {
      projectId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return undefined;
}

/**
 * Persist a VoiceMap to the project's voiceAssignments field for future re-use.
 * Non-fatal — a save failure does not abort the pipeline.
 */
async function saveVoiceMap(projectId: string, voiceMap: VoiceMap): Promise<void> {
  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { voiceAssignments: JSON.parse(JSON.stringify(voiceMap)) },
    });
    log.info('[Pipeline] saved VoiceMap to project', {
      projectId,
      assignmentCount: Object.keys(voiceMap.assignments).length,
    });
  } catch (err) {
    log.warn('[Pipeline] failed to save VoiceMap (non-fatal)', {
      projectId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Run the full director pipeline: DirectorAgent → AudioDirectorAgent → Validation
 */
export async function processScript(
  input: PipelineInput,
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  // Load cached VoiceMap to skip Pass 2 on re-runs of the same project
  const cachedVoiceMap = await loadVoiceMap(input.project_id);

  const directorAgent = new DirectorAgent({
    model: options.directorModel,
    maxIterations: options.maxIterations,
    cachedVoiceMap,
  });

  const audioDirectorAgent = new AudioDirectorAgent({
    model: options.audioDirectorModel,
    maxIterations: options.maxIterations,
  });

  const directorValidator = new DirectorJSONValidator();
  const audioValidator = new SceneAudioValidator();

  log.info('Pipeline starting script processing', { projectId: input.project_id });

  // Append director notes block to script_text if provided
  let effectiveScriptText = input.script_text;
  if (input.director_notes) {
    try {
      const notes = JSON.parse(input.director_notes) as DirectorNotes;
      const block = buildDirectorNotesBlock(notes);
      if (block) {
        effectiveScriptText = input.script_text + block;
        log.info('[Pipeline] director notes injected', { projectId: input.project_id });
      }
    } catch {
      log.warn('[Pipeline] failed to parse director_notes — skipping injection', { projectId: input.project_id });
    }
  }

  // Phase 1: Run DirectorAgent
  // Agent now returns validated DirectorJSON (Zod-validated at boundary)
  log.info('Pipeline Phase 1: Running DirectorAgent');
  let directorJson = await directorAgent.process({ ...input, script_text: effectiveScriptText });

  // Persist the VoiceMap produced (or used) so subsequent runs skip Pass 2
  const voiceMapToSave = directorAgent.lastVoiceMap ?? cachedVoiceMap;
  if (voiceMapToSave) {
    await saveVoiceMap(input.project_id, voiceMapToSave);
  }

  // Phase 1b: Apply user voice overrides (if any)
  if (input.voice_overrides && Object.keys(input.voice_overrides).length > 0) {
    log.info('Pipeline Phase 1b: Applying user voice overrides');
    directorJson = applyVoiceOverrides(directorJson, input.voice_overrides);
  }

  // Phase 2: Validate and auto-correct Director JSON (business rules)
  log.info('Pipeline Phase 2: Validating Director JSON');
  const directorValidation = directorValidator.validate(directorJson);
  const directorValidationReport: ValidationReport = {
    is_valid: directorValidation.isValid,
    errors_found: directorValidation.errors.length,
    errors: directorValidation.errors.map((e) => e.toJSON()),
  };

  if (!directorValidation.isValid) {
    log.info('Pipeline Phase 2b: Auto-correcting Director JSON');
    directorJson = directorValidator.autoCorrect(directorJson);
    directorValidationReport.auto_corrected = true;
  }

  // Phase 3: Run AudioDirectorAgent
  // Agent now returns validated SceneAudioJSON (Zod-validated at boundary)
  log.info('Pipeline Phase 3: Running AudioDirectorAgent');
  let sceneAudioJson = await audioDirectorAgent.process(directorJson);

  // Phase 4: Validate and auto-correct Scene Audio JSON (business rules)
  log.info('Pipeline Phase 4: Validating Scene Audio JSON');
  const audioValidation = audioValidator.validate(sceneAudioJson, directorJson);
  const audioValidationReport: ValidationReport = {
    is_valid: audioValidation.isValid,
    errors_found: audioValidation.errors.length,
    errors: audioValidation.errors.map((e) => e.toJSON()),
  };

  if (!audioValidation.isValid) {
    log.info('Pipeline Phase 4b: Auto-correcting Scene Audio JSON');
    sceneAudioJson = audioValidator.autoCorrect(sceneAudioJson, directorJson);
    audioValidationReport.auto_corrected = true;
  }

  // Phase 5: Merge results
  log.info('Pipeline Phase 5: Merging results');
  const mergedResult = mergeDirectorAndAudio(directorJson, sceneAudioJson);

  log.info('Pipeline complete');

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
 * Apply user-selected voice overrides to Director JSON
 *
 * Replaces voice_key for all dialogue lines belonging to overridden characters.
 * This runs after DirectorAgent so the AI still handles character detection and
 * scene structure, but the user's voice preferences take priority.
 */
function applyVoiceOverrides(
  directorJson: DirectorJSON,
  overrides: Record<string, string>
): DirectorJSON {
  const result: DirectorJSON = JSON.parse(JSON.stringify(directorJson));
  let overrideCount = 0;

  for (const scene of result.scenes) {
    for (const line of scene.dialogue) {
      // Check both exact match and case-insensitive match
      const overrideVoiceId = overrides[line.character]
        || overrides[line.character.toUpperCase()]
        || overrides[line.character.toLowerCase()];

      if (overrideVoiceId && line.voice_key !== overrideVoiceId) {
        line.voice_key = overrideVoiceId;
        overrideCount++;
      }
    }
  }

  log.info('Pipeline applied voice overrides', { overrideCount, characterCount: Object.keys(overrides).length });
  return result;
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
