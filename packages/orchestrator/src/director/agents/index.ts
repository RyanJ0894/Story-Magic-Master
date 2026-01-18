/**
 * Director Agents - Export all agent classes
 */

export { DirectorAgent } from './director-agent.js';
export type { DirectorAgentOptions, DirectorAgentInput } from './director-agent.js';

export { AudioDirectorAgent } from './audio-director-agent.js';
export type { AudioDirectorAgentOptions } from './audio-director-agent.js';

// Re-export prompts
export { DIRECTOR_SYSTEM_PROMPT, SCRIPT_ABBREVIATIONS } from '../prompts/director-prompt.js';
export { AUDIO_DIRECTOR_SYSTEM_PROMPT } from '../prompts/audio-director-prompt.js';
