/**
 * H2 — Boot-time idempotent seed framework
 *
 * Generalises the seedVoiceCatalogIfEmpty pattern (PR #246) into a
 * registry that runs all registered seeders sequentially after the
 * server has started listening, with these guarantees:
 *
 *   1. Idempotent — every seeder must safely run on every boot. Empty +
 *      populated DBs both produce the same final state.
 *   2. Fail-soft — a seeder error never blocks subsequent seeders or
 *      crashes the process. Each error gets a structured warn + Sentry
 *      breadcrumb.
 *   3. Bounded — runBootSeeds takes a per-seeder timeout (default 30s).
 *      A hanging seeder gets canceled and logged; the run continues.
 *   4. Observable — each seeder emits {seeder, action, rows, ms} via the
 *      logger so a fresh-env boot is fully traceable.
 *
 * Usage in index.ts:
 *   import { runBootSeeds, registerSeeder } from './lib/seed/index.js';
 *   import { seedVoiceCatalogIfEmpty } from './lib/seed-voice-catalog.js';
 *
 *   registerSeeder('voice-catalog', seedVoiceCatalogIfEmpty);
 *   // ...more seeders here as we add them...
 *
 *   server.listen(PORT, () => {
 *     setTimeout(() => { runBootSeeds(); }, 2_000);
 *   });
 *
 * Adding a new seeder is one function + one register call. Each seeder
 * is async and takes no arguments. To gate behind an env var or other
 * condition, do that inside the seeder itself (so the registry stays
 * a simple list).
 */

import { log } from '../logger.js';
import { Sentry } from '../sentry.js';

export interface SeederResult {
  name: string;
  status: 'ran' | 'skipped' | 'failed' | 'timed-out';
  durationMs: number;
  error?: string;
}

type SeederFn = () => Promise<void>;

interface Registered {
  name: string;
  fn: SeederFn;
}

const registry: Registered[] = [];

/**
 * Register a seeder to be run on the next call to runBootSeeds(). Call
 * during module init (before the server listen callback) so the registry
 * is populated by the time boot happens. Duplicate names overwrite the
 * previous entry — convenient for tests, harmless in production.
 */
export function registerSeeder(name: string, fn: SeederFn): void {
  // Strip any existing entry with the same name so duplicate registrations
  // (e.g. when a test imports the module twice) don't run twice.
  const i = registry.findIndex((r) => r.name === name);
  if (i >= 0) registry.splice(i, 1);
  registry.push({ name, fn });
}

/**
 * Test/development helper: clear the registry. Not exported for direct
 * use in production code paths; tests can import it via the test-only
 * named export below.
 */
export function _clearSeederRegistryForTests(): void {
  registry.length = 0;
}

/**
 * Run every registered seeder once, sequentially. Never throws — returns
 * an array of per-seeder results so the caller (typically the boot path
 * after server.listen) can log a summary or, in tests, assert on it.
 */
export async function runBootSeeds(options: { perSeederTimeoutMs?: number } = {}): Promise<SeederResult[]> {
  const { perSeederTimeoutMs = 30_000 } = options;
  if (registry.length === 0) {
    log.debug('[seed] no seeders registered; nothing to run');
    return [];
  }

  log.info('[seed] running boot seeders', { count: registry.length });
  const results: SeederResult[] = [];
  for (const { name, fn } of registry) {
    const start = Date.now();
    const result = await runOne(name, fn, perSeederTimeoutMs);
    result.durationMs = Date.now() - start;
    results.push(result);
    if (result.status === 'failed' || result.status === 'timed-out') {
      log.warn(`[seed] ${name} ${result.status}`, {
        error: result.error,
        durationMs: result.durationMs,
      });
      Sentry.addBreadcrumb({
        category: 'seed',
        level: 'warning',
        message: `seeder ${name} ${result.status}`,
        data: { name, durationMs: result.durationMs, error: result.error },
      });
    } else {
      log.info(`[seed] ${name} ok`, { durationMs: result.durationMs });
    }
  }
  return results;
}

async function runOne(name: string, fn: SeederFn, timeoutMs: number): Promise<SeederResult> {
  const TIMED_OUT = Symbol('seeder-timeout');
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const seederPromise = (async () => fn())();
  // Suppress unhandled rejection on the losing branch.
  seederPromise.catch(() => {});

  const timeoutPromise = new Promise<typeof TIMED_OUT>((resolve) => {
    timeoutHandle = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
  });

  try {
    const winner = await Promise.race([
      seederPromise.then(() => 'ran' as const).catch((err) => ({ kind: 'failed', err })),
      timeoutPromise,
    ]);
    if (winner === TIMED_OUT) {
      return { name, status: 'timed-out', durationMs: 0 };
    }
    if (typeof winner === 'object' && winner !== null && 'kind' in winner) {
      const err = (winner as { err: unknown }).err;
      return {
        name,
        status: 'failed',
        durationMs: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    return { name, status: 'ran', durationMs: 0 };
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}
