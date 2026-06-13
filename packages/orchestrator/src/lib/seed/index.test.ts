import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../sentry.js', () => ({
  Sentry: { addBreadcrumb: vi.fn(), captureMessage: vi.fn() },
}));

import {
  registerSeeder,
  runBootSeeds,
  _clearSeederRegistryForTests,
} from './index.js';

describe('boot seed framework', () => {
  beforeEach(() => {
    _clearSeederRegistryForTests();
    vi.clearAllMocks();
  });

  it('returns an empty result list when no seeders are registered', async () => {
    const results = await runBootSeeds();
    expect(results).toEqual([]);
  });

  it('runs every registered seeder in registration order', async () => {
    const calls: string[] = [];
    registerSeeder('a', async () => { calls.push('a'); });
    registerSeeder('b', async () => { calls.push('b'); });
    registerSeeder('c', async () => { calls.push('c'); });

    const results = await runBootSeeds();
    expect(calls).toEqual(['a', 'b', 'c']);
    expect(results.map((r) => r.status)).toEqual(['ran', 'ran', 'ran']);
  });

  it('reports a failed seeder without crashing subsequent ones', async () => {
    let bRan = false;
    registerSeeder('a', async () => { throw new Error('boom'); });
    registerSeeder('b', async () => { bRan = true; });

    const results = await runBootSeeds();
    expect(results[0].status).toBe('failed');
    expect(results[0].error).toContain('boom');
    expect(bRan).toBe(true);
    expect(results[1].status).toBe('ran');
  });

  it('times out a hanging seeder and continues', async () => {
    let bRan = false;
    registerSeeder('hang', () => new Promise(() => {}));
    registerSeeder('b', async () => { bRan = true; });

    const results = await runBootSeeds({ perSeederTimeoutMs: 50 });
    expect(results[0].status).toBe('timed-out');
    expect(bRan).toBe(true);
    expect(results[1].status).toBe('ran');
  });

  it('deduplicates by name on re-registration (last registration wins)', async () => {
    const seen: string[] = [];
    registerSeeder('only', async () => { seen.push('first'); });
    registerSeeder('only', async () => { seen.push('second'); });

    await runBootSeeds();
    expect(seen).toEqual(['second']);
  });

  it('measures duration for each seeder', async () => {
    registerSeeder('slow', () => new Promise((resolve) => setTimeout(resolve, 30)));
    const results = await runBootSeeds();
    expect(results[0].durationMs).toBeGreaterThanOrEqual(25);
  });
});
