import { log } from './logger.js';
import { getDiskUsage } from './cleanup.js';

const CHECKLY_PING_URL = process.env.CHECKLY_PING_URL;

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
  };
}
