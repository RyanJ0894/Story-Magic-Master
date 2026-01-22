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
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { DirectorJSON, Scene, DialogueLine } from '../../schemas/director-json.js';

const sb: SupabaseClient | null =
  process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
    : null;

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
  concurrency: number = 12
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

  console.log(`\n🔊 Parallel TTS: Processing ${totalLines} lines across ${totalScenes} scenes`);
  console.log(`   Concurrency: ${concurrency} parallel API calls\n`);

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

        // Generate cache key
        const key = ttsKey(
          project_id,
          scene_id,
          line.line_id,
          voice.voice_id,
          voice.params_json,
          line.text
        );

        // Check cache first
        const cached = await readStemByKey(key);
        if (cached) {
          cachedLines++;
          completedLines++;
          sceneLinesComplete.set(scene_id, (sceneLinesComplete.get(scene_id) || 0) + 1);

          console.log(`   ♻️  Cached: ${line.line_id} (${line.character})`);

          return {
            scene_id,
            line_id: line.line_id,
            path: cached.path,
          };
        }

        // Generate new TTS
        console.log(`   🎙️  Generating: ${line.line_id} (${line.character}) - "${line.text.substring(0, 40)}..."`);

        const wav = await ttsGenerate({ voice, text: line.text });
        const stemPath = await writeStem(project_id, scene_id, line.line_id, wav, key);

        // Store in database
        if (sb) {
          const textHash = hash(line.text);
          const voiceHash = hash(voice.voice_id + JSON.stringify(voice.params_json));

          await sb.from('tts_stems').upsert(
            {
              project_id,
              scene_id,
              line_id: line.line_id,
              text_hash: textHash,
              voice_hash: voiceHash,
              path: stemPath,
              duration_s: null,
            },
            {
              onConflict: 'project_id,scene_id,line_id',
            }
          );
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

  console.log(`\n✅ Parallel TTS Complete:`);
  console.log(`   Total: ${totalLines} lines`);
  console.log(`   Cached: ${cachedLines} lines (${Math.round((cachedLines / totalLines) * 100)}%)`);
  console.log(`   Generated: ${generatedLines} lines\n`);

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
