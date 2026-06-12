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
 */
export async function ttsForScene(project_id: string, scene: Scene): Promise<StemResult[]> {
  // Increase concurrency to 8 for faster processing
  // ElevenLabs Creator tier supports higher concurrency
  const limit = pLimit(8);

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

        const key = ttsKey(
          project_id,
          scene.scene_id,
          line.line_id,
          voice.voice_id,
          voice.params_json,
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
        const wav = await ttsGenerate({ voice, text: line.text });
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
