// Runtime companion to director-json.ts. ESM-only — Node loads this at
// runtime (orchestrator); TypeScript pulls type declarations from the .ts
// file via the package.json `types` mapping. Keep this file's exports
// structurally identical to the .ts file's runtime exports.

export const DIRECTOR_EMOTIONS = [
  'NEUTRAL',
  'EXCITED',
  'NERVOUS',
  'SARCASTIC',
  'TENDER',
  'AUTHORITATIVE',
  'WHISPERED',
  'JOYFUL',
  'SORROWFUL',
  'ANGRY',
];

export function isDirectorJson(value) {
  if (!value || typeof value !== 'object') return false;
  // Only the scenes array is required — project_id is metadata that some
  // legacy persisted rows omit. See director-json.ts JSDoc.
  if (!Array.isArray(value.scenes)) return false;
  return true;
}

export function asDirectorJson(value) {
  return isDirectorJson(value) ? value : null;
}
