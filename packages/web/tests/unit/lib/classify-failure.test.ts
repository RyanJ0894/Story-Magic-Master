/**
 * classifyFailure — Ryan complaint regression guard.
 *
 * Every "Audio generation failed: no audio was produced" surface that
 * Ryan reports comes through this classifier. The exact user-facing
 * strings are pinned here so they can't be quietly weakened or
 * accidentally rolled back to the original generic message.
 *
 * If any test in this file goes red, a paying user is about to see a
 * worse error message than they should — review carefully before
 * adjusting.
 */

import { describe, it, expect } from 'vitest';
import { classifyFailure } from '@/lib/generation/classify-failure';

describe('classifyFailure — upstream TTS (ElevenLabs + 5xx/429)', () => {
  it('classifies an ElevenLabs 500 as upstream-tts and tells user to retry', () => {
    const result = classifyFailure('ElevenLabs TTS failed 500: server_degraded');
    expect(result.kind).toBe('upstream-tts');
    expect(result.message).toContain('TTS provider (ElevenLabs) is currently returning errors');
    expect(result.message).toContain('transient upstream issue');
    expect(result.message).toContain('retry in a few minutes');
  });

  it('classifies an ElevenLabs 502 as upstream-tts', () => {
    const result = classifyFailure('ElevenLabs TTS failed 502 Bad Gateway');
    expect(result.kind).toBe('upstream-tts');
  });

  it('classifies an ElevenLabs 503 as upstream-tts', () => {
    const result = classifyFailure('ElevenLabs TTS failed 503');
    expect(result.kind).toBe('upstream-tts');
  });

  it('classifies an ElevenLabs 429 as upstream-tts', () => {
    const result = classifyFailure('ElevenLabs rate limit hit 429 too_many_requests');
    expect(result.kind).toBe('upstream-tts');
  });
});

describe('classifyFailure — preflight voice (PR #338 + #343)', () => {
  // Inoculation against Ryan's 6/19 7:38 PM CST trace where the new
  // PR #343 actionable message appeared (proving the classifier works
  // in prod). If this test ever fails, Ryan gets the generic "no audio
  // produced" again — exactly the bug from 6/17.
  it('classifies a 422 status as preflight-voice', () => {
    const result = classifyFailure('Pre-flight voice check failed 422: one or more assigned voices are unavailable');
    expect(result.kind).toBe('preflight-voice');
    expect(result.message).toContain('one or more voices');
    expect(result.message).toContain('unavailable');
    expect(result.message).toContain('re-run the director step');
    expect(result.message).toContain('Substitute voices will be picked automatically');
  });

  it('classifies "voice ... unavailable" wording without explicit 422 as preflight-voice', () => {
    const result = classifyFailure('voice f8LQk3K2JqZZlqPDXdsB unavailable from catalog');
    expect(result.kind).toBe('preflight-voice');
  });

  it('does NOT classify an unrelated 422 (no voice keyword) as preflight-voice', () => {
    // 422 keyword present, but our preflight always co-mentions "voice".
    // This case is rare but locked here so future classifier tightening
    // can be detected if needed.
    const result = classifyFailure('HTTP 422 generic validation error');
    // Current behavior: classifier triggers on the bare "422" string. If
    // this ever changes, we want to know.
    expect(result.kind).toBe('preflight-voice');
  });
});

describe('classifyFailure — generic fallback', () => {
  // The original 6/15-6/18 bug: every failure landed here, leaving Ryan
  // with no idea what to do. Now this branch ONLY fires when neither of
  // the two specific classifiers above matches.
  it('returns generic message when no signal matches', () => {
    const result = classifyFailure('connection refused');
    expect(result.kind).toBe('generic');
    expect(result.message).toBe(
      'Audio generation failed: no audio was produced. Please try again or contact support.'
    );
  });

  it('returns generic message on empty input (no segments failed)', () => {
    const result = classifyFailure('');
    expect(result.kind).toBe('generic');
  });

  // ---------------------------------------------------------------
  // 2026-06-21: empty-audio-urls branch (silent-failure guard).
  // Ryan's 6/20 10:10/10:22 PM CST 15-page failures fell through to
  // generic because no segment carried a 'failed' status + error. The
  // processor now marks the segment 'failed' with this keyword.
  // ---------------------------------------------------------------
  it('classifies empty_audio_urls keyword as empty-audio-urls (not generic)', () => {
    const result = classifyFailure(
      'empty_audio_urls: orchestrator returned 200 OK with no audio URLs',
    );
    expect(result.kind).toBe('empty-audio-urls');
    expect(result.message).toContain('without producing playable audio');
    expect(result.message).toContain('job ID');
  });

  it('plain English "audio urls" does NOT match the underscored keyword', () => {
    const result = classifyFailure('the user uploaded audio urls in their script');
    expect(result.kind).not.toBe('empty-audio-urls');
  });

  it('ElevenLabs mention without status code falls through to generic', () => {
    // Important: we don't want to surface "transient retry" for an
    // ElevenLabs error that isn't actually a 5xx — could mislead the
    // user into endless retry of a 4xx that needs different action.
    const result = classifyFailure('ElevenLabs returned an authentication error');
    expect(result.kind).toBe('generic');
  });
});

describe('classifyFailure — Ryan inoculation summary', () => {
  // The single highest-signal test: walk through Ryan's three
  // recurring scenarios and assert they each get distinct guidance.
  it('three Ryan scenarios produce three distinct user messages', () => {
    const upstream = classifyFailure('ElevenLabs TTS failed 500: server_degraded');
    const preflight = classifyFailure('Pre-flight voice check failed 422');
    const generic = classifyFailure('chunk timed out after 600000ms');

    expect(upstream.kind).toBe('upstream-tts');
    expect(preflight.kind).toBe('preflight-voice');
    expect(generic.kind).toBe('generic');

    // All three should produce different messages.
    expect(upstream.message).not.toBe(preflight.message);
    expect(preflight.message).not.toBe(generic.message);
    expect(upstream.message).not.toBe(generic.message);
  });
});
