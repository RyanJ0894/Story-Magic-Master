/**
 * Voice catalog validator.
 *
 * Probes ElevenLabs to confirm each voice in a set is actually usable. Catches
 * the class of failure where a voice ID exists in our DB and ElevenLabs returns
 * 200 on `/v1/voices/<id>` metadata, but `/v1/text-to-speech/<id>` returns 500
 * (server-side voice degradation) or 403 (account-level voice revoked).
 *
 * Two consumers:
 *   1. Pre-flight check at `/orchestrate` start — fails fast with a useful error
 *      and auto-deactivates broken voices before we burn a 30-second retry budget
 *      per dead chunk.
 *   2. Periodic audit script (scripts/audit-voices.ts) — sweeps the entire
 *      catalog and reports / deactivates broken voices.
 *
 * 2026-06-17 incident: Ryan's project failed with "no audio produced" because
 * one of three assigned voices (f8LQk3K2JqZZlqPDXdsB) was deterministically
 * returning 500 from ElevenLabs even though the catalog entry was isActive=true.
 * The audit found 2 more in the same state (one revoked, one server-degraded).
 */

import { log } from './logger.js';
import { prisma } from './prisma.js';

const ELEVENLABS_BASE = 'https://api.elevenlabs.io';
// Probe with the same model the production pipeline renders with. If the
// pipeline switches model (eleven_v3 etc.), the probe must follow — otherwise
// we'd be validating compatibility against a model that isn't even used.
const PROBE_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5';
// One byte of dialogue — minimum charge against the account, minimum latency.
const PROBE_TEXT = 'a';
const PROBE_TIMEOUT_MS = 5_000;
// 2026-06-25: Ryan's job 3a9db72b had a single voice classified server_degraded
// from one transient ElevenLabs 500 and got permanently deactivated. Retry 5xx
// twice with exponential backoff before classifying as broken, so genuine
// transient blips never escalate to deactivation.
const PROBE_5XX_RETRIES = 2;
const PROBE_5XX_BACKOFF_BASE_MS = 750;
// Reasonable concurrency for probing — don't hammer ElevenLabs with 137 parallel
// requests, but a serial loop takes ~30s. Per the audit run, 4-8 concurrent is
// fine and finishes 135 voices in ~10 seconds.
const PROBE_CONCURRENCY = 6;

export interface VoiceValidationResult {
  voiceId: string;
  ok: boolean;
  status: number;
  /** Truncated response body when !ok, for diagnostic logging. */
  errorBody?: string;
  /** Classification of the failure mode. */
  reason?: 'revoked' | 'server_degraded' | 'not_found' | 'rate_limited' | 'auth' | 'other';
}

export interface PreFlightOutcome {
  /** All voice IDs that probed OK. */
  valid: string[];
  /** All voice IDs that probed broken. */
  broken: VoiceValidationResult[];
  /** Whether any broken voices were auto-deactivated in the catalog. */
  deactivated: number;
  /** True when auto-deactivation was SKIPPED because the failure rate looked
   *  like an ElevenLabs platform incident rather than per-voice degradation. */
  abortedDeactivation?: boolean;
}

/**
 * Peter's 2026-06-17 concern: if ElevenLabs has a platform-wide incident and
 * returns 500 for ALL voices, naive auto-deactivation would nuke the entire
 * catalog. We refuse to deactivate when more than this fraction of probed
 * voices fail with a 5xx — that's the signal it's their problem, not ours.
 *
 * Threshold tuned to: a single bad voice in a 3-voice project = 33% failure
 * rate, well below the limit. A platform-wide outage = 100% failure, well
 * above. Anything in between would lean towards "their problem" — safer to
 * skip deactivation and let the run fail with a clearer error.
 */
const PLATFORM_INCIDENT_FAILURE_RATE_THRESHOLD = 0.5;

/**
 * Probe a single voice ID against the ElevenLabs TTS endpoint. Returns OK / fail
 * with a classified reason. Never throws — network errors become `status: 0`.
 */
export async function probeVoice(voiceId: string, apiKey: string): Promise<VoiceValidationResult> {
  let lastResult: VoiceValidationResult | null = null;

  // Retry 5xx (and only 5xx) up to PROBE_5XX_RETRIES times. Other failure
  // modes (auth/revoked/not_found/rate_limited) are not retryable here —
  // rate_limited recovers on the next pre-flight run, the others won't
  // change between retries within a few hundred ms.
  for (let attempt = 0; attempt <= PROBE_5XX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    try {
      const res = await fetch(
        `${ELEVENLABS_BASE}/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: PROBE_TEXT, model_id: PROBE_MODEL }),
          signal: controller.signal,
        },
      );

      if (res.ok) {
        return { voiceId, ok: true, status: res.status };
      }

      const errorBody = (await res.text()).slice(0, 300);
      let reason: VoiceValidationResult['reason'] = 'other';
      if (res.status === 401 || res.status === 402) reason = 'auth';
      else if (res.status === 403) reason = 'revoked';
      else if (res.status === 404) reason = 'not_found';
      else if (res.status === 429) reason = 'rate_limited';
      else if (res.status >= 500) reason = 'server_degraded';

      lastResult = { voiceId, ok: false, status: res.status, errorBody, reason };

      // Only 5xx is worth retrying. Everything else short-circuits.
      if (reason !== 'server_degraded') return lastResult;
    } catch (err) {
      lastResult = {
        voiceId,
        ok: false,
        status: 0,
        errorBody: `network error: ${err instanceof Error ? err.message : String(err)}`,
        reason: 'other',
      };
      // Network errors aren't classified as server_degraded; don't loop on them.
      return lastResult;
    } finally {
      clearTimeout(timeoutId);
    }

    // 5xx and we still have retries — back off and try again.
    if (attempt < PROBE_5XX_RETRIES) {
      const backoff = PROBE_5XX_BACKOFF_BASE_MS * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }

  // All retries exhausted and we're still seeing 5xx.
  return lastResult!;
}

/**
 * Probe many voices concurrently (up to PROBE_CONCURRENCY at a time).
 * Order of results is NOT guaranteed to match input order.
 */
export async function probeVoices(
  voiceIds: string[],
  apiKey: string,
): Promise<VoiceValidationResult[]> {
  const results: VoiceValidationResult[] = [];
  const queue = [...voiceIds];

  async function worker() {
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) break;
      const r = await probeVoice(id, apiKey);
      results.push(r);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(PROBE_CONCURRENCY, voiceIds.length) }, () => worker()),
  );
  return results;
}

/**
 * Pre-flight check for a generation run. Validates that every unique voice ID
 * that will be used is actually functional, and auto-deactivates any that
 * permanently fail (revoked / server-degraded) so subsequent runs pick a
 * different voice during assignment.
 *
 * Rate-limit failures and network errors are NOT auto-deactivated (transient).
 *
 * Behavior:
 *   - Empty input → success ({ valid: [], broken: [], deactivated: 0 })
 *   - All voices OK → success (broken: [])
 *   - Some broken → caller decides whether to fail the run or substitute
 *
 * The caller (orchestrate route) inspects `broken` and returns a 422 to the
 * web app, which can then re-run the director step to pick replacement voices.
 */
export async function preFlightVoices(voiceIds: string[]): Promise<PreFlightOutcome> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    // Don't block the run on a config error — the orchestrator's main path will
    // surface a clearer 401 from ElevenLabs when the actual TTS calls fire.
    log.warn('[voice-validator] ELEVENLABS_API_KEY missing — skipping pre-flight');
    return { valid: voiceIds, broken: [], deactivated: 0 };
  }

  if (voiceIds.length === 0) {
    return { valid: [], broken: [], deactivated: 0 };
  }

  // De-dupe — a single voice used by 50 lines should only be probed once.
  const unique = Array.from(new Set(voiceIds));
  log.info('[voice-validator] pre-flight probe start', { count: unique.length });
  const start = Date.now();

  const results = await probeVoices(unique, apiKey);
  const valid = results.filter((r) => r.ok).map((r) => r.voiceId);
  const broken = results.filter((r) => !r.ok);

  // Platform-incident guard (Peter, 2026-06-17): if too many voices fail with
  // the same upstream-server-error pattern, that's almost certainly an
  // ElevenLabs incident rather than per-voice degradation. Skip auto-deactivation
  // to avoid nuking the entire catalog during their outage. The pre-flight
  // still returns broken so the orchestrator surfaces a clean 422.
  const serverDegraded = broken.filter((r) => r.reason === 'server_degraded').length;
  const failureRate = unique.length > 0 ? serverDegraded / unique.length : 0;
  let abortedDeactivation = false;
  if (failureRate > PLATFORM_INCIDENT_FAILURE_RATE_THRESHOLD) {
    log.warn('[voice-validator] high server-degraded rate — looks like an ElevenLabs incident; skipping auto-deactivation', {
      probed: unique.length,
      serverDegraded,
      failureRate,
      threshold: PLATFORM_INCIDENT_FAILURE_RATE_THRESHOLD,
    });
    abortedDeactivation = true;
  }

  // Auto-deactivate permanently-broken voices. Transient failures (429 rate
  // limit, 0 network error, AND 5xx server_degraded) are NOT deactivated —
  // they recover on the next pre-flight. Platform-incident detection above
  // can skip this entirely.
  //
  // 2026-06-25: server_degraded was previously in this list. A single transient
  // ElevenLabs 500 in Ryan's job 3a9db72b nuked a paid clone voice; the >50%
  // platform-incident guard didn't catch it (3-voice job, 1 bad probe = 33%
  // failure rate). probeVoice now retries 5xx twice before classifying as
  // broken, AND server_degraded survives that to no longer trigger
  // auto-deactivation. Only revoked (403) and not_found (404) — true
  // permanent signals — flip isActive=false here.
  let deactivated = 0;
  const deactivateReasons: VoiceValidationResult['reason'][] = ['revoked', 'not_found'];
  if (!abortedDeactivation) {
    for (const b of broken.filter((r) => r.reason && deactivateReasons.includes(r.reason))) {
      try {
        await prisma.voiceCatalogEntry.update({
          where: { voiceId: b.voiceId },
          data: { isActive: false },
        });
        deactivated++;
        log.warn('[voice-validator] auto-deactivated broken voice', {
          voiceId: b.voiceId,
          reason: b.reason,
          status: b.status,
          errorBody: b.errorBody,
        });
      } catch (err) {
        log.error(
          '[voice-validator] failed to deactivate broken voice',
          err instanceof Error ? err : undefined,
          { voiceId: b.voiceId },
        );
      }
    }
  }

  const elapsedMs = Date.now() - start;
  log.info('[voice-validator] pre-flight done', {
    count: unique.length,
    ok: valid.length,
    broken: broken.length,
    deactivated,
    elapsedMs,
  });

  return { valid, broken, deactivated, abortedDeactivation };
}

/**
 * For each broken voice ID, find an active catalog substitute of the same
 * gender where possible. Returns a map of brokenId → substituteId.
 * Returns an empty map if the catalog has no active voices at all.
 */
export async function pickVoiceSubstitutes(
  brokenVoiceIds: string[],
): Promise<Map<string, string>> {
  if (brokenVoiceIds.length === 0) return new Map();

  const [brokenEntries, activeVoices] = await Promise.all([
    prisma.voiceCatalogEntry.findMany({
      where: { voiceId: { in: brokenVoiceIds } },
      select: { voiceId: true, gender: true },
    }),
    prisma.voiceCatalogEntry.findMany({
      where: { isActive: true, voiceId: { notIn: brokenVoiceIds } },
      select: { voiceId: true, gender: true },
    }),
  ]);

  if (activeVoices.length === 0) {
    log.warn('[voice-validator] no active substitutes available', { brokenVoiceIds });
    return new Map();
  }

  const brokenGender = new Map(brokenEntries.map((e) => [e.voiceId, e.gender]));
  const substitutionMap = new Map<string, string>();

  for (const voiceId of brokenVoiceIds) {
    const gender = brokenGender.get(voiceId);
    const alreadyUsed = new Set(substitutionMap.values());
    const candidate =
      (gender
        ? activeVoices.find((v) => v.gender === gender && !alreadyUsed.has(v.voiceId))
        : undefined) ?? activeVoices.find((v) => !alreadyUsed.has(v.voiceId));
    if (candidate) substitutionMap.set(voiceId, candidate.voiceId);
  }

  return substitutionMap;
}

/**
 * Patch voice_key fields in scenes in-place, swapping broken IDs for
 * substitutes from the provided map. Returns the number of lines patched.
 */
export function applyVoiceSubstitutions(
  scenes: Array<{ dialogue?: Array<{ voice_key?: string }> }>,
  substitutionMap: Map<string, string>,
): number {
  if (substitutionMap.size === 0) return 0;
  let patched = 0;
  for (const scene of scenes) {
    for (const line of scene.dialogue ?? []) {
      const sub = line.voice_key ? substitutionMap.get(line.voice_key) : undefined;
      if (sub) { line.voice_key = sub; patched++; }
    }
  }
  return patched;
}

/**
 * Extract unique voice IDs from a director-output scene array. Skips lines
 * without a voice_key. Used by the pre-flight wire-up to learn what to probe.
 */
export function extractVoiceIds(scenes: Array<{ dialogue?: Array<{ voice_key?: string }> }>): string[] {
  const ids = new Set<string>();
  for (const scene of scenes ?? []) {
    for (const line of scene.dialogue ?? []) {
      if (line.voice_key) ids.add(line.voice_key);
    }
  }
  return Array.from(ids);
}
