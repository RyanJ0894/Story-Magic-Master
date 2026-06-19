/**
 * Parallel TTS Worker - Process all dialogue across scenes in parallel
 *
 * This worker implements storygraph-aware parallel processing:
 * 1. Extracts all dialogue lines from all scenes
 * 2. Groups into parallel batches respecting rate limits
 * 3. Processes batches concurrently
 * 4. Reports per-line and per-scene progress
 */

import pLimit from 'p-limit';
import { ttsKey, hash } from '../../lib/idempotency.js';
import { getVoiceForCharacter, upsertVoiceMap } from '../../lib/db.js';
import { readStemByKey, writeStem } from '../../lib/storage.js';
import { ttsGenerate } from '../../lib/audio.js';
import { prisma } from '../../lib/prisma.js';
import { log } from '../../lib/logger.js';
import type { DirectorJSON, Scene, DialogueLine } from '../../schemas/director-json.js';

// Maps emotion enum values to ElevenLabs expression audio tag prefixes.
// Only v3 ElevenLabs models support these tags. Disabled by default; enable
// by setting ELEVENLABS_EXPRESSION_TAGS=true in the environment.
const EMOTION_TAG_MAP: Record<string, string> = {
  WHISPERED: '[whispers]',
  NERVOUS: '[nervously]',
  EXCITED: '[excited]',
  SARCASTIC: '[sarcastically]',
  TENDER: '[tenderly]',
  ANGRY: '[angrily]',
  SORROWFUL: '[sadly]',
  JOYFUL: '[joyfully]',
  AUTHORITATIVE: '[authoritatively]',
};

export function applyEmotionTag(text: string, emotion: string): string {
  if (process.env.ELEVENLABS_EXPRESSION_TAGS !== 'true') return text;
  const tag = EMOTION_TAG_MAP[emotion.toUpperCase()];
  if (!tag) return text;
  return `${tag} ${text}`;
}

export interface StemResult {
  scene_id: string;
  line_id: string;
  path: string;
  duration_ms?: number;
}

export interface TTSProgressCallback {
  (progress: TTSProgress): void;
}

export interface TTSProgress {
  total_lines: number;
  completed_lines: number;
  current_scene: string;
  scenes_complete: number;
  total_scenes: number;
  percent: number;
  current_line?: string;
  current_character?: string;
}

export interface SceneStemMap {
  [scene_id: string]: StemResult[];
}

export interface ParallelTTSResult {
  stems_by_scene: SceneStemMap;
  total_lines: number;
  cached_lines: number;
  generated_lines: number;
}

interface LineTask {
  scene_id: string;
  scene_index: number;
  line: DialogueLine;
  line_index: number;
}

/**
 * Process all TTS for a director JSON in parallel
 *
 * @param director - The full director JSON with all scenes
 * @param onProgress - Optional callback for progress updates
 * @param concurrency - Max concurrent ElevenLabs API calls (default: 12)
 */
export async function parallelTTSGenerate(
  director: DirectorJSON,
  onProgress?: TTSProgressCallback,
  concurrency: number = 12,
  emotionOverrides: Record<string, string> = {},
  // B-003b (2026-06-15): per-user audio tuning. Currently only narrationSpeed
  // affects TTS (applied to Narrator-character lines).
  options: { narrationSpeed?: number } = {},
): Promise<ParallelTTSResult> {
  const project_id = director.project_id;

  // 1. Extract all line tasks from all scenes
  const allTasks: LineTask[] = [];

  for (let sceneIndex = 0; sceneIndex < director.scenes.length; sceneIndex++) {
    const scene = director.scenes[sceneIndex];
    for (let lineIndex = 0; lineIndex < scene.dialogue.length; lineIndex++) {
      allTasks.push({
        scene_id: scene.scene_id,
        scene_index: sceneIndex,
        line: scene.dialogue[lineIndex],
        line_index: lineIndex,
      });
    }
  }

  const totalLines = allTasks.length;
  const totalScenes = director.scenes.length;

  log.info('Parallel TTS: starting batch processing', {
    totalLines,
    totalScenes,
    concurrency,
  });

  // 2. Initialize results structure
  const stemsByScene: SceneStemMap = {};
  for (const scene of director.scenes) {
    stemsByScene[scene.scene_id] = [];
  }

  // Track progress
  let completedLines = 0;
  let cachedLines = 0;
  let generatedLines = 0;
  const sceneLinesComplete = new Map<string, number>();
  const sceneTotalLines = new Map<string, number>();

  // Count lines per scene
  for (const scene of director.scenes) {
    sceneTotalLines.set(scene.scene_id, scene.dialogue.length);
    sceneLinesComplete.set(scene.scene_id, 0);
  }

  // 3. Create rate-limited processor
  const limit = pLimit(concurrency);

  // 4. Process all tasks in parallel
  const results = await Promise.all(
    allTasks.map((task) =>
      limit(async (): Promise<StemResult> => {
        const { scene_id, line, line_index } = task;

        // Report progress before starting
        if (onProgress) {
          onProgress({
            total_lines: totalLines,
            completed_lines: completedLines,
            current_scene: scene_id,
            scenes_complete: countCompleteScenes(sceneLinesComplete, sceneTotalLines),
            total_scenes: totalScenes,
            percent: Math.round((completedLines / totalLines) * 100),
            current_line: line.line_id,
            current_character: line.character,
          });
        }

        // Get voice for this line
        const voice = line.voice_key
          ? { voice_id: line.voice_key, params_json: {} }
          : (await getVoiceForCharacter(project_id, line.character)) ||
            (await upsertVoiceMap(project_id, line.character));

        // B-003b: narrator-only speed override + cache-key invalidation.
        const speedOverride = line.character === 'Narrator' ? options.narrationSpeed : undefined;
        const keyParams = speedOverride !== undefined
          ? { ...voice.params_json, _speedOverride: speedOverride }
          : voice.params_json;

        // Generate cache key
        const key = ttsKey(
          project_id,
          scene_id,
          line.line_id,
          voice.voice_id,
          keyParams,
          line.text
        );

        // Check cache first
        const cached = await readStemByKey(key);
        if (cached) {
          cachedLines++;
          completedLines++;
          sceneLinesComplete.set(scene_id, (sceneLinesComplete.get(scene_id) || 0) + 1);

          log.debug('Using cached TTS stem', { lineId: line.line_id, character: line.character });

          return {
            scene_id,
            line_id: line.line_id,
            path: cached.path,
          };
        }

        // Generate new TTS
        log.info('Generating TTS stem', {
          lineId: line.line_id,
          character: line.character,
          textPreview: line.text.substring(0, 40),
        });

        const effectiveEmotion = emotionOverrides[line.line_id] ?? line.emotion;
        const ttsText = effectiveEmotion
          ? applyEmotionTag(line.text, effectiveEmotion)
          : line.text;
        const wav = await ttsGenerate({ voice, text: ttsText, speedOverride });
        const stemPath = await writeStem(project_id, scene_id, line.line_id, wav, key);

        // Store in database via Prisma raw SQL
        try {
          const textHash = hash(line.text);
          const voiceHash = hash(voice.voice_id + JSON.stringify(voice.params_json));

          // ${project_id}::uuid is required since migration 0040 changed the
          // column type from TEXT to UUID. Prisma binds JS strings as TEXT;
          // the cast happens server-side.
          await prisma.$executeRaw`
            INSERT INTO tts_stems (project_id, scene_id, line_id, text_hash, voice_hash, path, duration_s)
            VALUES (${project_id}::uuid, ${scene_id}, ${line.line_id}, ${textHash}, ${voiceHash}, ${stemPath}, NULL)
            ON CONFLICT (project_id, scene_id, line_id)
            DO UPDATE SET text_hash = ${textHash}, voice_hash = ${voiceHash}, path = ${stemPath}, duration_s = NULL
          `;
        } catch (err) {
          log.error('Failed to save TTS stem to DB', err instanceof Error ? err : undefined, {
            project_id, scene_id, line_id: line.line_id,
          });
        }

        generatedLines++;
        completedLines++;
        sceneLinesComplete.set(scene_id, (sceneLinesComplete.get(scene_id) || 0) + 1);

        return {
          scene_id,
          line_id: line.line_id,
          path: stemPath,
        };
      })
    )
  );

  // 5. Organize results by scene (preserving original order)
  for (const result of results) {
    stemsByScene[result.scene_id].push(result);
  }

  // Sort each scene's stems by line_id to maintain order
  for (const scene_id of Object.keys(stemsByScene)) {
    stemsByScene[scene_id].sort((a, b) => {
      // Extract numeric part from line_id (e.g., "line_001" -> 1)
      const aNum = parseInt(a.line_id.replace(/\D/g, ''), 10) || 0;
      const bNum = parseInt(b.line_id.replace(/\D/g, ''), 10) || 0;
      return aNum - bNum;
    });
  }

  // Final progress report
  if (onProgress) {
    onProgress({
      total_lines: totalLines,
      completed_lines: totalLines,
      current_scene: director.scenes[director.scenes.length - 1]?.scene_id || '',
      scenes_complete: totalScenes,
      total_scenes: totalScenes,
      percent: 100,
    });
  }

  log.info('Parallel TTS complete', {
    totalLines,
    cachedLines,
    cachedPercent: Math.round((cachedLines / totalLines) * 100),
    generatedLines,
  });

  return {
    stems_by_scene: stemsByScene,
    total_lines: totalLines,
    cached_lines: cachedLines,
    generated_lines: generatedLines,
  };
}

/**
 * Count how many scenes have all their lines complete
 */
function countCompleteScenes(
  complete: Map<string, number>,
  total: Map<string, number>
): number {
  let count = 0;
  for (const [sceneId, totalLines] of total) {
    if ((complete.get(sceneId) || 0) >= totalLines) {
      count++;
    }
  }
  return count;
}

/**
 * Get stems for a specific scene (for progressive processing)
 */
export function getStemsForScene(
  result: ParallelTTSResult,
  scene_id: string
): StemResult[] {
  return result.stems_by_scene[scene_id] || [];
}

/**
 * Check if a scene's TTS is complete
 */
export function isSceneComplete(
  result: ParallelTTSResult,
  scene: Scene
): boolean {
  const stems = result.stems_by_scene[scene.scene_id] || [];
  return stems.length >= scene.dialogue.length;
}
