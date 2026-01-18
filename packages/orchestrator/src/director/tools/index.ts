/**
 * Director Tools - Export all LLM-callable tools
 */

// Voice search tools
export {
  searchVoicesTool,
  getVoiceByIdTool,
  listVoiceLabelsTool,
  resetUsedVoices,
  markVoiceUsed,
  getUsedVoiceIds,
} from './voice-search.js';

// Audio search tools
export {
  searchMusicTool,
  searchAmbienceTool,
  searchSfxTool,
  listAudioGroupsTool,
  getAudioByIdTool,
} from './audio-search.js';

/**
 * Get all tools for the DirectorAgent
 */
export function getDirectorTools() {
  return {
    search_voices: require('./voice-search.js').searchVoicesTool,
    get_voice: require('./voice-search.js').getVoiceByIdTool,
    list_voice_labels: require('./voice-search.js').listVoiceLabelsTool,
  };
}

/**
 * Get all tools for the AudioDirectorAgent
 */
export function getAudioDirectorTools() {
  return {
    search_music: require('./audio-search.js').searchMusicTool,
    search_ambience: require('./audio-search.js').searchAmbienceTool,
    search_sfx: require('./audio-search.js').searchSfxTool,
    list_audio_groups: require('./audio-search.js').listAudioGroupsTool,
    get_audio: require('./audio-search.js').getAudioByIdTool,
  };
}
