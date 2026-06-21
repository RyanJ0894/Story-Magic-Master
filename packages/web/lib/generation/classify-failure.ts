/**
 * Terminal-failure classifier for the generation pipeline.
 *
 * Extracted from processor.ts so the user-message wording is testable in
 * isolation. Each of Ryan's recurring complaints about audio-gen errors
 * comes from this one branch — see `tests/unit/lib/classify-failure.test.ts`
 * for the regression-guard cases.
 */

export type FailureKind =
  | 'upstream-tts'
  | 'preflight-voice'
  | 'empty-audio-urls'
  | 'director-invalid'
  | 'generic';

export interface ClassifiedFailure {
  kind: FailureKind;
  /** The user-facing message we surface in the toast / job log. */
  message: string;
}

const MSG_UPSTREAM_TTS =
  'Audio generation failed because the TTS provider (ElevenLabs) is currently returning errors. This is a transient upstream issue — please retry in a few minutes.';
const MSG_PREFLIGHT_VOICE =
  'Audio generation failed because one or more voices assigned to this script are unavailable from ElevenLabs. The catalog has been updated — please re-run the director step (Generate Scenes) and try again. Substitute voices will be picked automatically.';
const MSG_EMPTY_AUDIO_URLS =
  'Audio generation completed without producing playable audio. This is often a transient orchestrator-side hiccup and resolves on retry. If you see this twice in a row on the same script, send the job ID to support — the trace will pinpoint the step that returned no audio.';
const MSG_DIRECTOR_INVALID =
  'Audio generation failed because the director output is missing required data for some scenes (often a voice assignment). Please re-run the director step (Generate Scenes) and try again. The director will pick valid voices for every line.';
const MSG_GENERIC =
  'Audio generation failed: no audio was produced. Please try again or contact support.';

/**
 * Classify the last segment's recorded error string into one of three
 * user-facing buckets. Patterns:
 *
 *   - "upstream-tts": the error mentions ElevenLabs AND has a 5xx status
 *     or 429. Surface the "transient upstream, retry" message.
 *   - "preflight-voice": the error is a 422 from our pre-flight validator
 *     (PR #338), or explicitly mentions an unavailable voice. Surface the
 *     "re-run director" message — retrying without re-running director
 *     just hits the same broken voice again.
 *   - "generic": anything else. Surface the original "no audio produced"
 *     fallback.
 *
 * The classifier exists because Ryan (and any paying user) needs to know
 * what action to take. "Try again" is correct for transient upstream
 * errors but actively wrong for broken-voice errors.
 */
export function classifyFailure(lastFailure: string): ClassifiedFailure {
  const isUpstreamTts =
    lastFailure.includes('ElevenLabs') &&
    (lastFailure.match(/\b5\d\d\b/) !== null || lastFailure.includes('429'));
  if (isUpstreamTts) return { kind: 'upstream-tts', message: MSG_UPSTREAM_TTS };

  const isPreflightVoice =
    lastFailure.includes('422') ||
    (lastFailure.includes('voice') && lastFailure.includes('unavailable'));
  if (isPreflightVoice) return { kind: 'preflight-voice', message: MSG_PREFLIGHT_VOICE };

  // 2026-06-21: emitted by processor.ts when orchestrator returns 200 OK
  // but with an empty audio_urls array. Pre-this-PR Ryan's 15-page failures
  // on 6/20 fell through to the generic message because no segment carried
  // a 'failed' status + error — the silent failure looked like "all chunks
  // succeeded" but with no actual audio. Now the processor marks the
  // segment 'failed' with this exact keyword and the user sees a message
  // that names the actual issue.
  const isEmptyAudioUrls = lastFailure.includes('empty_audio_urls');
  if (isEmptyAudioUrls) return { kind: 'empty-audio-urls', message: MSG_EMPTY_AUDIO_URLS };

  // 2026-06-21: orchestrator-side DirectorJSONSchema rejection. Surfaces
  // as HTTP 400 with a Zod-style payload like
  //   "Invalid request: [{...,\"path\":[\"scenes\",0,\"dialogue\",29,\"voice_key\"]...}]"
  // Hit when A-005 or any other validator left a required field undefined
  // before the request reached the orchestrator. Telling the user to
  // re-run the director is the correct action — retrying alone hits the
  // same cached directorJson and fails identically.
  const isDirectorInvalid =
    lastFailure.includes('Invalid request') &&
    (lastFailure.includes('invalid_type') || lastFailure.includes('voice_key') || lastFailure.includes('scenes'));
  if (isDirectorInvalid) return { kind: 'director-invalid', message: MSG_DIRECTOR_INVALID };

  return { kind: 'generic', message: MSG_GENERIC };
}
