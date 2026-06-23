/**
 * TTS Worker - Generates Text-to-Speech audio for dialogue
 */

import pLimit from 'p-limit';
import { ttsKey, hash } from '../../lib/idempotency.js';
import { getVoiceForCharacter, upsertVoiceMap } from '../../lib/db.js';
import { readStemByKey, writeStem } from '../../lib/storage.js';
import { ttsGenerate } from '../../lib/audio.js';
import { prisma } from '../../lib/prisma.js';
import { log } from '../../lib/logger.js';
import type { Scene, DialogueLine } from '../../schemas/director-json.js';

export interface StemResult {
  line_id: string;
  path: string;
}

/**
 * Generate TTS for all dialogue lines in a scene
 *
 * B-003b (2026-06-15): optional `narrationSpeed` overrides the speed on
 * voice_settings for Narrator lines only. Character voices stay at their
 * stored params so a fast narration doesn't ALSO sound like every character
 * is rushing. When undefined, no override is applied.
 */
export async function ttsForScene(
  project_id: string,
  scene: Scene,
  options: { narrationSpeed?: number } = {},
): Promise<StemResult[]> {
  // #378: TTS concurrency now reads TTS_CONCURRENCY env (default 2) so
  // all three TTS call sites (tts.ts, parallel-tts.ts, pipeline.ts)
  // resolve through the same knob. Default 2 matches ElevenLabs grant-
  // tier guidance (Starter/Creator accounts cap at 2–3 parallel before
  // returning too_many_concurrent_requests). Production override via
  // TTS_CONCURRENCY in render.yaml or Doppler.
  const limit = pLimit(parseInt(process.env.TTS_CONCURRENCY || '2', 10));

  log.debug('Processing dialogue lines for scene', {
    sceneId: scene.scene_id,
    lineCount: scene.dialogue.length,
  });

  return Promise.all(
    scene.dialogue.map((line) =>
      limit(async () => {
        log.debug('Processing TTS line', {
          lineId: line.line_id,
          character: line.character,
          textPreview: line.text.substring(0, 50),
          hasVoiceKey: !!line.voice_key,
          voiceKey: line.voice_key || 'MISSING',
        });

        const voice = line.voice_key
          ? { voice_id: line.voice_key, params_json: {} }
          : (await getVoiceForCharacter(project_id, line.character)) ||
            (await upsertVoiceMap(project_id, line.character));

        log.debug('Resolved voice for character', {
          voiceId: voice.voice_id,
          character: line.character,
        });

        // B-003b: narrator lines get a speedOverride when the user has a
        // locked tuning. The override is folded into the cache key (via
        // params) so a speed change invalidates the per-stem cache. Without
        // this, the FIRST narrator line cached at speed=1.0 would replay
        // even after the user locks speed=1.10.
        const speedOverride = line.character === 'Narrator' ? options.narrationSpeed : undefined;
        const keyParams = speedOverride !== undefined
          ? { ...voice.params_json, _speedOverride: speedOverride }
          : voice.params_json;

        const key = ttsKey(
          project_id,
          scene.scene_id,
          line.line_id,
          voice.voice_id,
          keyParams,
          line.text
        );

        const cached = await readStemByKey(key);
        if (cached) {
          log.debug('Using cached TTS stem', { lineId: line.line_id });
          return { line_id: line.line_id, path: cached.path };
        }

        log.info('Generating new TTS stem', {
          lineId: line.line_id,
          voiceId: voice.voice_id,
        });
        // B-003b: speedOverride already computed above for cache-key purposes.
        const wav = await ttsGenerate({ voice, text: line.text, speedOverride });
        const stemPath = await writeStem(project_id, scene.scene_id, line.line_id, wav, key);

        // Store in database via Prisma raw SQL
        try {
          const textHash = hash(line.text);
          const voiceHash = hash(voice.voice_id + JSON.stringify(voice.params_json));

          // ${project_id}::uuid — see migration 0040; the column is UUID, Prisma binds TEXT.
          await prisma.$executeRaw`
            INSERT INTO tts_stems (project_id, scene_id, line_id, text_hash, voice_hash, path, duration_s)
            VALUES (${project_id}::uuid, ${scene.scene_id}, ${line.line_id}, ${textHash}, ${voiceHash}, ${stemPath}, NULL)
            ON CONFLICT (project_id, scene_id, line_id)
            DO UPDATE SET text_hash = ${textHash}, voice_hash = ${voiceHash}, path = ${stemPath}, duration_s = NULL
          `;
        } catch (err) {
          log.error('Failed to save TTS stem to DB', err instanceof Error ? err : undefined, {
            project_id, scene_id: scene.scene_id, line_id: line.line_id,
          });
        }

        return { line_id: line.line_id, path: stemPath };
      })
    )
  );
}
