import fs from 'fs';
import { execFileSync } from 'child_process';
import { log } from './logger.js';
import { getDiskUsage } from './cleanup.js';

const CHECKLY_PING_URL = process.env.CHECKLY_PING_URL;

/**
 * Verify the whisper binary is actually executable, not just present.
 *
 * The 2026-06-13 incident: install-whisper.sh built the cmake binary with
 * dynamic linkage, copied it to BIN_PATH, but did NOT copy libwhisper.so.1.
 * `fs.existsSync(BIN_PATH)` returned true and the executable bit was set,
 * but every spawn died with "error while loading shared libraries". This
 * function catches that failure by actually running `<binary> --help`
 * once per probe window and remembering the result.
 *
 * The X_OK check (cheap) screens out the obvious cases (file missing,
 * permission stripped). The --help spawn (~50-200ms once per cache window)
 * screens out the shared-libs / wrong-arch case that X_OK can't see.
 *
 * Cached for SPAWN_PROBE_TTL_MS to keep /health cheap under load.
 */
const SPAWN_PROBE_TTL_MS = 5 * 60 * 1000;
const SPAWN_PROBE_TIMEOUT_MS = 5000;
type BinaryProbe = { checkedAt: number; path: string; ok: boolean; error?: string };
let whisperBinaryProbeCache: BinaryProbe | null = null;

function probeWhisperBinary(whisperPath: string | undefined): {
  exists: boolean;
  executable: boolean;
  runnable: boolean;
  probeError?: string;
} {
  if (!whisperPath) return { exists: false, executable: false, runnable: false };
  const exists = fs.existsSync(whisperPath);
  if (!exists) return { exists: false, executable: false, runnable: false };

  let executable = false;
  try {
    fs.accessSync(whisperPath, fs.constants.X_OK);
    executable = true;
  } catch {
    return { exists: true, executable: false, runnable: false };
  }

  // Check spawn cache. If we've spawned in the last 5 min for THIS exact
  // path and it succeeded, trust it. If it failed, also trust it for the
  // window — no point retrying a broken binary every health check.
  const now = Date.now();
  const cached = whisperBinaryProbeCache;
  if (cached && cached.path === whisperPath && now - cached.checkedAt < SPAWN_PROBE_TTL_MS) {
    return { exists: true, executable: true, runnable: cached.ok, probeError: cached.error };
  }

  // Spawn --help with a tight timeout. If it returns ANY exit code or stdout,
  // the binary loaded its libs and ran. We don't care what --help printed.
  let ok = false;
  let error: string | undefined;
  try {
    execFileSync(whisperPath, ['--help'], {
      timeout: SPAWN_PROBE_TIMEOUT_MS,
      stdio: 'pipe',
    });
    ok = true;
  } catch (err) {
    // execFileSync throws on non-zero exit OR spawn failure (missing libs,
    // wrong arch, etc.). Capture stderr so the operator can see why.
    const e = err as { stderr?: Buffer | string; message?: string; code?: string; status?: number };
    // --help on whisper.cpp exits non-zero but DOES print to stdout. The
    // useful signal is whether the spawn happened at all (vs. ENOENT,
    // libfoo.so missing, etc.). status=1 with stderr length 0 means it ran.
    const stderrStr = e.stderr ? (typeof e.stderr === 'string' ? e.stderr : e.stderr.toString()) : '';
    const looksLikeLoaderError =
      stderrStr.includes('error while loading shared libraries') ||
      stderrStr.includes('libwhisper') ||
      stderrStr.includes('libggml') ||
      e.code === 'ENOENT' ||
      e.code === 'EACCES';
    if (looksLikeLoaderError) {
      ok = false;
      error = stderrStr.slice(0, 200) || e.message || `code=${e.code} status=${e.status}`;
    } else {
      // Non-zero exit from --help is fine — binary loaded successfully.
      ok = true;
    }
  }

  whisperBinaryProbeCache = { checkedAt: now, path: whisperPath, ok, error };
  if (!ok) {
    log.warn('[health] whisper binary spawn check failed', { path: whisperPath, error });
  }
  return { exists: true, executable: true, runnable: ok, probeError: error };
}

/**
 * Report what the alignment pipeline can actually do right now. Surfaces the
 * #243 class of bug (whisper.cpp build silently missing in prod → all
 * traffic falls through to Groq → Groq rate-limits → bad alignment) on the
 * health endpoint instead of only via Sentry breadcrumbs after a generation
 * fails.
 *
 * Reads cheap, no I/O against external providers — Groq is "ready" if the
 * key is present; we don't burn budget pinging it from /health. The whisper
 * binary IS spawned (cheap --help check) but only once per 5 min window.
 */
function getAlignmentCapabilities() {
  const whisperPath = process.env.WHISPER_CPP_PATH;
  const modelPath = process.env.WHISPER_MODEL_PATH;
  const binaryProbe = probeWhisperBinary(whisperPath);
  // The binary is "present" for reporting purposes when it exists AND is
  // actually runnable. Previously this was just fs.existsSync, which lied
  // when the binary was missing its shared libs.
  const whisperBinaryPresent = binaryProbe.runnable;
  const whisperModelPresent = !!modelPath && fs.existsSync(modelPath);
  const whisperLocalReady = whisperBinaryPresent && whisperModelPresent;
  const groqReady = !!process.env.GROQ_API_KEY;
  const openaiReady = !!process.env.OPENAI_API_KEY;
  // Tier order matches whisper-align.ts: local → Groq → OpenAI → duration estimator.
  const primaryTier = whisperLocalReady
    ? 'whisper-local'
    : groqReady
      ? 'groq-whisper'
      : openaiReady
        ? 'openai-whisper'
        : 'duration-estimator';
  return {
    primary: primaryTier,
    whisperLocal: {
      ready: whisperLocalReady,
      binaryPath: whisperPath || null,
      // Three-state binary signal — operator can see EXACTLY which check
      // failed instead of guessing from a single boolean.
      binaryExists: binaryProbe.exists,
      binaryExecutable: binaryProbe.executable,
      binaryRunnable: binaryProbe.runnable,
      binaryProbeError: binaryProbe.probeError ?? null,
      // Back-compat: tests + dashboards that look for "binaryPresent" keep
      // working; the value now reflects runnable, not just existence.
      binaryPresent: whisperBinaryPresent,
      modelPath: modelPath || null,
      modelPresent: whisperModelPresent,
    },
    groq: { ready: groqReady },
    openai: { ready: openaiReady },
    // True when any tier is available — false would mean alignment will
    // always fall through to the duration-based estimator (visible degradation).
    anyTierReady: whisperLocalReady || groqReady || openaiReady,
  };
}

/**
 * Test-only — clear the whisper spawn-check cache so tests can swap the
 * mocked fs / child_process between cases. Production callers never need this.
 */
export function _resetWhisperProbeCacheForTests(): void {
  whisperBinaryProbeCache = null;
}

// Ping interval (5 minutes)
const PING_INTERVAL_MS = 5 * 60 * 1000;

// Use a reference object so the recursive setTimeout closure can check if monitoring is active
let pingIntervalId: NodeJS.Timeout | null = null;
let monitoringActive = false;

/**
 * Ping Checkly to indicate the service is alive
 * This is used for heartbeat monitoring
 */
export async function pingCheckly(): Promise<boolean> {
  if (!CHECKLY_PING_URL) {
    return false;
  }

  try {
    const response = await fetch(CHECKLY_PING_URL, {
      method: 'GET',
      headers: {
        'User-Agent': 'story-magic-orchestrator/2.0.0',
      },
    });

    if (response.ok) {
      log.debug('Checkly ping successful');
      return true;
    } else {
      log.warn('Checkly ping failed', { status: response.status });
      return false;
    }
  } catch (error) {
    log.error('Checkly ping error', error as Error);
    return false;
  }
}

/**
 * Start periodic Checkly heartbeat pings
 */
export function startMonitoring(): void {
  if (!CHECKLY_PING_URL) {
    log.info('Checkly monitoring not configured (CHECKLY_PING_URL not set)');
    return;
  }

  log.info('Starting Checkly heartbeat monitoring', {
    intervalMs: PING_INTERVAL_MS,
    pingUrl: CHECKLY_PING_URL.slice(0, 50) + '...',
  });

  monitoringActive = true;

  // Initial ping (fire-and-forget — failure is non-fatal)
  pingCheckly().catch(() => {});

  // Reschedule-on-completion pattern: prevents concurrent pings if one
  // ping takes longer than the interval (unlike setInterval which fires blindly).
  function scheduleNextPing(): void {
    pingIntervalId = setTimeout(async () => {
      if (!monitoringActive) return;
      await pingCheckly().catch(() => {});
      scheduleNextPing();
    }, PING_INTERVAL_MS);
  }

  scheduleNextPing();
}

/**
 * Stop periodic monitoring
 */
export function stopMonitoring(): void {
  monitoringActive = false;
  if (pingIntervalId) {
    clearTimeout(pingIntervalId);
    pingIntervalId = null;
    log.info('Stopped Checkly heartbeat monitoring');
  }
}

/**
 * Health check data for the /health endpoint
 */
export function getHealthData() {
  const mem = process.memoryUsage();
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'story-magic-orchestrator',
    version: process.env.npm_package_version || '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime_seconds: Math.round(process.uptime()),
    memory: {
      rss_mb: Math.round(mem.rss / 1024 / 1024),
      heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
      external_mb: Math.round(mem.external / 1024 / 1024),
    },
    monitoring: {
      checkly: !!CHECKLY_PING_URL,
      sentry: !!process.env.SENTRY_DSN,
      rateLimit: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    },
    disk: getDiskUsage(),
    capabilities: {
      director: true,
      orchestrator: true,
    },
    alignment: getAlignmentCapabilities(),
  };
}
