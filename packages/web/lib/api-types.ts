/**
 * Shared API types imported from the orchestrator package.
 * This ensures type safety between frontend and backend.
 *
 * When orchestrator schemas change, TypeScript will catch mismatches at build time.
 */
export type {
  DirectorJSON,
  Scene,
  DialogueLine,
  AudioCue,
  GenerateScenesRequest,
  GenerateScenesResponse,
  OrchestrateRequest,
  OrchestrateResponse,
  ValidationReport,
} from '@story-magic/orchestrator/schemas';

// Re-export Zod schemas if runtime validation is needed
export {
  DirectorJSONSchema,
  SceneSchema,
  DialogueLineSchema,
  AudioCueSchema,
  GenerateScenesRequestSchema,
  OrchestrateRequestSchema,
} from '@story-magic/orchestrator/schemas';
