import fs from 'fs';
import path from 'path';
import { log } from './logger.js';
import { getOutputDir } from './env.js';

const PREVIEW_TTL_DAYS = 7;
const FULL_AUDIO_TTL_DAYS = 30;

/**
 * Remove files older than the given TTL (in days)
 */
function removeOldFiles(dir: string, ttlDays: number): { removed: number; errors: number } {
  let removed = 0;
  let errors = 0;
  const cutoff = Date.now() - ttlDays * 24 * 60 * 60 * 1000;

  if (!fs.existsSync(dir)) return { removed, errors };

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        // Recurse into project directories
        const sub = removeOldFiles(fullPath, ttlDays);
        removed += sub.removed;
        errors += sub.errors;

        // Remove empty directories
        const remaining = fs.readdirSync(fullPath);
        if (remaining.length === 0) {
          fs.rmdirSync(fullPath);
        }
      } else if (entry.isFile()) {
        const stat = fs.statSync(fullPath);
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(fullPath);
          removed++;
        }
      }
    } catch (err) {
      log.error('Cleanup error', err as Error, { path: fullPath });
      errors++;
    }
  }

  return { removed, errors };
}

/**
 * Get disk usage for the output directory
 */
export function getDiskUsage(): { totalFiles: number; totalBytes: number; totalMB: number } {
  const outputDir = getOutputDir();
  let totalFiles = 0;
  let totalBytes = 0;

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const stat = fs.statSync(fullPath);
        totalFiles++;
        totalBytes += stat.size;
      }
    }
  }

  walk(outputDir);
  return { totalFiles, totalBytes, totalMB: Math.round(totalBytes / 1024 / 1024) };
}

/**
 * Run the cleanup process
 * - Preview files: removed after 7 days
 * - Full audio files: removed after 30 days
 */
export function runCleanup(): { previewsRemoved: number; audioRemoved: number; errors: number } {
  const outputDir = getOutputDir();

  log.info('Starting audio storage cleanup', {
    outputDir,
    previewTTLDays: PREVIEW_TTL_DAYS,
    audioTTLDays: FULL_AUDIO_TTL_DAYS,
  });

  const previewDir = path.join(outputDir, 'previews');
  const previewResult = removeOldFiles(previewDir, PREVIEW_TTL_DAYS);

  // For project audio dirs, use the longer TTL
  const audioResult = removeOldFiles(outputDir, FULL_AUDIO_TTL_DAYS);

  const result = {
    previewsRemoved: previewResult.removed,
    audioRemoved: audioResult.removed,
    errors: previewResult.errors + audioResult.errors,
  };

  const usage = getDiskUsage();

  log.info('Audio storage cleanup complete', {
    ...result,
    diskUsage: usage,
  });

  return result;
}

/**
 * Start a periodic cleanup interval (runs every 6 hours)
 */
let cleanupIntervalId: NodeJS.Timeout | null = null;

export function startCleanupSchedule(): void {
  const intervalMs = 6 * 60 * 60 * 1000; // 6 hours

  log.info('Starting audio cleanup schedule', { intervalMs });

  // Run initial cleanup after 1 minute (let server fully start)
  setTimeout(() => {
    runCleanup();
  }, 60 * 1000);

  cleanupIntervalId = setInterval(runCleanup, intervalMs);
}

export function stopCleanupSchedule(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    log.info('Stopped audio cleanup schedule');
  }
}
