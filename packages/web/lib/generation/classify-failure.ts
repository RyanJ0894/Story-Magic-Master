/**
 * Terminal-failure classifier for the generation pipeline.
 *
 * Extracted from processor.ts so the user-message wording is testable in
 * isolation. Each of Ryan's recurring complaints about audio-gen errors
 * comes from this one branch — see `tests/unit/lib/classify-failure.test.ts`
 * for the regression-guard cases.
 */

export type FailureKind = 'upstream-tts' | 'preflight-voice' | 'generic';

export interface ClassifiedFailure {
  kind: FailureKind;
  /** The user-facing message we surface in the toast / job log. */
  message: string;
}

const MSG_UPSTREAM_TTS =
  'Audio generation failed because the TTS provider (ElevenLabs) is currently returning errors. This is a transient upstream issue — please retry in a few minutes.';
const MSG_PREFLIGHT_VOICE =
  'Audio generation failed because one or more voices assigned to this script are unavailable from ElevenLabs. The catalog has been updated — please re-run the director step (Generate Scenes) and try again. Substitute voices will be picked automatically.';
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

  return { kind: 'generic', message: MSG_GENERIC };
}
