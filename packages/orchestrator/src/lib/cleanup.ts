import fs from 'fs';
import path from 'path';
import { log } from './logger.js';
import { getOutputDir, getStemsDir } from './env.js';
import { prisma } from './prisma.js';

const PREVIEW_TTL_DAYS = 7;
const FULL_AUDIO_TTL_DAYS = 30;
// Stems are scratch files (PCM→WAV per dialogue line, used only during mixing).
// 2 days is generous — any job running longer than that has bigger problems.
const STEMS_TTL_DAYS = 2;
// CONTENT-LOG-RETENTION (2026-06-14): content_access_log grows unbounded as
// share/listen events accrue. 90 days matches what's surfaced in the
// enterprise dashboard's "recent activity" view; rows older than that are
// only useful for cold-storage analytics, which we don't run here.
const CONTENT_ACCESS_LOG_RETENTION_DAYS = 90;

export { getStemsDir } from './env.js';

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
    // dir is always a server-controlled absolute path (getOutputDir/getStemsDir), never from HTTP input.
    // path.basename guards entry.name against any hypothetical traversal component.
    const fullPath = path.join(dir, path.basename(entry.name)); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
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
      const fullPath = path.join(dir, path.basename(entry.name)); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
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
 * Delete content_access_log rows older than the retention threshold.
 * Returns the number of rows deleted. Logs at info on success, warn on
 * failure. Failure is non-fatal — file cleanup should still proceed.
 */
export async function pruneContentAccessLog(): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - CONTENT_ACCESS_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  try {
    const result = await prisma.contentAccessLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    log.info('content_access_log retention prune complete', {
      retentionDays: CONTENT_ACCESS_LOG_RETENTION_DAYS,
      cutoff: cutoff.toISOString(),
      deleted: result.count,
    });
    return { deleted: result.count };
  } catch (err) {
    log.warn('content_access_log retention prune failed', {
      retentionDays: CONTENT_ACCESS_LOG_RETENTION_DAYS,
      error: err instanceof Error ? err.message : String(err),
    });
    return { deleted: 0 };
  }
}

/**
 * Run the cleanup process
 * - Preview files: removed after 7 days
 * - Full audio files: removed after 30 days
 */
export function runCleanup(): { previewsRemoved: number; audioRemoved: number; stemsRemoved: number; errors: number } {
  const outputDir = getOutputDir();

  log.info('Starting audio storage cleanup', {
    outputDir,
    previewTTLDays: PREVIEW_TTL_DAYS,
    audioTTLDays: FULL_AUDIO_TTL_DAYS,
    stemsTTLDays: STEMS_TTL_DAYS,
  });

  const previewDir = path.join(outputDir, 'previews');
  const previewResult = removeOldFiles(previewDir, PREVIEW_TTL_DAYS);

  // For project audio dirs, use the longer TTL
  const audioResult = removeOldFiles(outputDir, FULL_AUDIO_TTL_DAYS);

  // Stems are ephemeral scratch files — purge aggressively
  const stemsResult = removeOldFiles(getStemsDir(), STEMS_TTL_DAYS);

  const result = {
    previewsRemoved: previewResult.removed,
    audioRemoved: audioResult.removed,
    stemsRemoved: stemsResult.removed,
    errors: previewResult.errors + audioResult.errors + stemsResult.errors,
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

  // Run initial cleanup after 1 minute (let server fully start). The DB-prune
  // job piggybacks on this schedule — it's idempotent and cheap (~1 indexed
  // DELETE) so re-running every 6 hours is fine. We don't need a separate
  // cron service.
  const runAll = () => {
    runCleanup();
    void pruneContentAccessLog();
  };

  setTimeout(runAll, 60 * 1000);
  cleanupIntervalId = setInterval(runAll, intervalMs);
}

export function stopCleanupSchedule(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    log.info('Stopped audio cleanup schedule');
  }
}
