/**
 * Shared utility: concatenate dialogue stems into a single audio file.
 *
 * Used by pipeline.ts, preview-pipeline.ts, and progressive-stitch.ts.
 */

import { execa } from 'execa';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';

const ffmpeg = ffmpegStatic as unknown as string;

export interface Stem {
  path: string;
  [key: string]: unknown;
}

/**
 * Concatenate audio stems into a single M4A file using FFmpeg concat.
 * Throws if stems array is empty. For a single stem, copies directly.
 */
export async function concatenateDialogueStems(stems: Stem[], outputPath: string): Promise<void> {
  if (!stems || stems.length === 0) {
    throw new Error('No dialogue stems to concatenate');
  }

  if (stems.length === 1) {
    fs.copyFileSync(stems[0].path, outputPath);
    return;
  }

  const concatList = stems.map((s) => `file '${s.path}'`).join('\n');
  const concatFilePath = path.join(path.dirname(outputPath), `concat-${Date.now()}.txt`);
  fs.writeFileSync(concatFilePath, concatList);

  try {
    await execa(ffmpeg, [
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFilePath,
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '48000',
      '-y',
      outputPath,
    ]);
  } finally {
    if (fs.existsSync(concatFilePath)) {
      fs.unlinkSync(concatFilePath);
    }
  }
}
