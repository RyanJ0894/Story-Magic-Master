/**
 * Consistency Verifier Agent — Phase E core.
 *
 * After Pass 3 produces a full DirectorJSON, sample N random scenes from
 * the source script and verify the per-scene output is consistent with
 * the sample-driven decisions. Built primarily for the premium tier
 * "advanced consistency check" but the verifier core is independent of
 * any product gating.
 *
 * Checks per sampled scene:
 *
 *   1. Speaker attribution — does every dialogue line attribute to a
 *      character actually present in this scene's text? Catches the
 *      "wrong character spoke this line" class of bug.
 *   2. Voice consistency — does the assigned voice still fit the
 *      character's speech style based on this specific scene? Catches
 *      cases where a character's voice picked from intro pages drifts
 *      across the script (e.g. a character who's shouty in scene 1 and
 *      quiet in scene 30, where the voice pick fits only the loud end).
 *   3. Omissions — are there obvious dialogue lines in the source text
 *      that didn't make it into the parsed scene?
 *   4. Mood / intensity — does the assigned mood/intensity match the
 *      apparent scene tone?
 *
 * Output: a Verdict object per scene. A "verdict passed = false" triggers
 * the caller's repair pathway (Phase E task E-5).
 *
 * Uses Haiku 4.5 by default. The verifier reads a small slice of source
 * + a parsed Scene + returns a tiny verdict — cheap and fast (~$0.02 per
 * scene). 5 verifications per job → ~$0.10 added cost when enabled.
 */

import { z } from 'zod';
import { generateStructuredOutput } from '../../lib/llm-client.js';
import { log } from '../../lib/logger.js';
import type { DirectorJSON, Scene } from '../../schemas/director-json.js';
import type { VoiceMap } from '../../schemas/voice-map.js';

const DEFAULT_MODEL =
  process.env.CONSISTENCY_VERIFIER_MODEL || 'anthropic/claude-haiku-4-5';

export const VerdictSchema = z.object({
  scene_id: z.string(),
  passed: z.boolean(),
  // Required (no .default([])) so the schema's input and output types stay
  // identical — generateStructuredOutput<T> requires both directions to
  // line up. The system prompt tells the LLM to always include the field;
  // empty array is allowed.
  issues: z.array(
    z.object({
      field: z.enum(['speaker', 'voice', 'omission', 'mood', 'intensity', 'other']),
      severity: z.enum(['minor', 'major']),
      description: z.string(),
      suggested_fix: z.string().optional(),
    }),
  ),
  // Free-text rationale for telemetry. Short so it's cheap to log.
  summary: z.string(),
});

export type Verdict = z.infer<typeof VerdictSchema>;

const VERIFIER_SYSTEM_PROMPT = `You are a screenplay-to-audio consistency checker.

You receive:
  1. A scene's RAW SOURCE TEXT from a screenplay
  2. A PARSED SCENE JSON that our pipeline produced for that scene
  3. The VOICE MAP entries for every character in the parsed scene

Your job: verify the parse is consistent with the source. Flag issues
in these categories:

  - speaker:   a dialogue line is attributed to a character not present
               in the source scene, or a line in the source has no
               matching parsed dialogue entry.
  - voice:     the voice assigned to a character (in voice_map) doesn't
               obviously fit the way the character speaks in this scene.
               Be conservative — only flag clear mismatches (e.g. a
               formal voice for a clearly informal character).
  - omission:  a meaningful dialogue line in the source is missing from
               the parsed scene.
  - mood:      the parsed scene's mood field doesn't match the obvious
               tone of the source scene.
  - intensity: the parsed scene's intensity (0–1) is wildly off from
               the apparent emotional intensity of the source.
  - other:     anything else worth surfacing.

Severity:
  - 'minor': worth noting but not necessarily fixing (e.g. a small
             tonal mismatch, a minor formatting quirk).
  - 'major': should be fixed (e.g. wrong-character attribution, a
             missing line, voice obviously wrong for the character).

Set passed = true if and only if there are NO 'major' issues.

Be skeptical — pipelines that produce mostly-right output can be
silently introducing wrong-character attributions or dropping lines.
Don't rubber-stamp.

Output the structured verdict.`;

export interface VerifyInput {
  scene: Scene;
  sourceText: string;
  voiceMap: VoiceMap;
}

/**
 * Verify a single scene. Returns the structured verdict. Throws on
 * LLM error — the caller decides whether to swallow or surface.
 */
export async function verifyScene(
  input: VerifyInput,
  options: { model?: string; projectId?: string } = {},
): Promise<Verdict> {
  const model = options.model || DEFAULT_MODEL;

  // Compact the voice map down to just the characters in this scene to
  // keep token budget tight.
  const sceneCharacters = new Set(input.scene.dialogue.map((d) => d.character));
  const compactVoiceMap: Record<string, { voice_key: string; voice_name?: string }> = {};
  for (const [name, assignment] of Object.entries(input.voiceMap.assignments)) {
    if (sceneCharacters.has(name) || sceneCharacters.has(assignment.canonical_name)) {
      compactVoiceMap[name] = {
        voice_key: assignment.voice_key,
        voice_name: assignment.voice_name,
      };
    }
  }

  const prompt = `SCENE ID: ${input.scene.scene_id}

RAW SOURCE TEXT:
\`\`\`
${input.sourceText}
\`\`\`

PARSED SCENE JSON:
\`\`\`json
${JSON.stringify(
  {
    scene_id: input.scene.scene_id,
    summary: input.scene.summary,
    mood: input.scene.mood,
    intensity: input.scene.intensity,
    dialogue: input.scene.dialogue,
  },
  null,
  2,
)}
\`\`\`

VOICE MAP (scene-relevant subset):
\`\`\`json
${JSON.stringify(compactVoiceMap, null, 2)}
\`\`\`

Verify the parse. Return your structured verdict for scene ${input.scene.scene_id}.`;

  const verdict = await generateStructuredOutput<Verdict>(prompt, {
    model,
    schema: VerdictSchema,
    systemPrompt: VERIFIER_SYSTEM_PROMPT,
    operation: 'consistency_verify',
    projectId: options.projectId,
    maxTokens: 2048,
    temperature: 0.1,
  });

  log.info('[ConsistencyVerifier] verdict', {
    sceneId: input.scene.scene_id,
    passed: verdict.passed,
    issueCount: verdict.issues.length,
    majorIssues: verdict.issues.filter((i) => i.severity === 'major').length,
  });

  return verdict;
}

export interface VerifyBatchOptions {
  /** How many scenes to verify. Defaults to 5 (per design doc Phase E). */
  sampleCount?: number;
  /** Override verifier model. Default Haiku. */
  model?: string;
  /** Project id passed through to LLM call telemetry. */
  projectId?: string;
}

export interface BatchVerdict {
  /** All verdicts, one per sampled scene. */
  verdicts: Verdict[];
  /** Verdicts with passed = false. */
  failures: Verdict[];
  /** Indexes (into DirectorJSON.scenes) of the scenes that were sampled. */
  sampledIndexes: number[];
}

/**
 * Pick N scenes at random (without replacement) and verify each.
 *
 * Source-text slicing is the caller's responsibility — they pass in the
 * original script and the scene boundaries (offsets) so the verifier can
 * see the exact text that produced each parsed scene. We don't re-derive
 * scene boundaries here to avoid drift with the producer.
 */
export async function verifyBatch(
  director: DirectorJSON,
  voiceMap: VoiceMap,
  sceneSourceTexts: string[],
  options: VerifyBatchOptions = {},
): Promise<BatchVerdict> {
  const sampleCount = options.sampleCount ?? 5;
  const sceneCount = director.scenes.length;
  if (sceneCount === 0) {
    return { verdicts: [], failures: [], sampledIndexes: [] };
  }
  if (sceneSourceTexts.length !== sceneCount) {
    log.warn('[ConsistencyVerifier] source/parse scene count mismatch — verifier may be misaligned', {
      sourceCount: sceneSourceTexts.length,
      parsedCount: sceneCount,
    });
  }

  // Pick N distinct random indexes. Deterministic-ish via a simple sweep
  // when sampleCount >= sceneCount.
  const indexes = pickDistinctIndexes(sceneCount, sampleCount);

  const verdicts: Verdict[] = [];
  for (const i of indexes) {
    try {
      const verdict = await verifyScene(
        {
          scene: director.scenes[i],
          sourceText: sceneSourceTexts[i] ?? '',
          voiceMap,
        },
        { model: options.model, projectId: options.projectId },
      );
      verdicts.push(verdict);
    } catch (err) {
      log.warn('[ConsistencyVerifier] verifier call failed (skipping this scene)', {
        sceneIdx: i,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const failures = verdicts.filter((v) => !v.passed);
  log.info('[ConsistencyVerifier] batch complete', {
    sampleCount,
    verdictsReturned: verdicts.length,
    failureCount: failures.length,
    failureRate: verdicts.length === 0 ? 0 : (failures.length / verdicts.length).toFixed(2),
  });

  return {
    verdicts,
    failures,
    sampledIndexes: indexes,
  };
}

function pickDistinctIndexes(total: number, n: number): number[] {
  if (n >= total) return Array.from({ length: total }, (_, i) => i);
  const set = new Set<number>();
  while (set.size < n) set.add(Math.floor(Math.random() * total));
  return Array.from(set).sort((a, b) => a - b);
}
