/**
 * Tests for env.ts — validateEnv, getEnv, isServiceConfigured, getOutputDir,
 * printEnvSummary.
 *
 * env.ts has a module-level `cachedEnv` singleton. Each test that needs a
 * different env config calls vi.resetModules() + await import() to get a fresh
 * module instance with cachedEnv = null.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

// Snapshot original env once at module load
const originalEnv = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  // Restore a clean baseline before each test
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── helpers ───────────────────────────────────────────────────────────────────

async function freshEnv(overrides: Record<string, string | undefined> = {}) {
  vi.resetModules();
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
  return import('./env.js');
}

// =============================================================================
// validateEnv
// =============================================================================

describe('validateEnv', () => {
  it('returns defaults when only DATABASE_URL is present', async () => {
    const { validateEnv } = await freshEnv({
      DATABASE_URL: 'postgresql://test:test@localhost/test',
      PORT: undefined,
      NODE_ENV: undefined,
    });

    const config = validateEnv();

    expect(config.PORT).toBe(22002);
    expect(config.NODE_ENV).toBe('development');
    expect(config.DIRECTOR_MODEL).toBe('anthropic/claude-sonnet-4-6');
    expect(config.MAX_SCRIPT_PAGES).toBe(150);
    expect(config.MAX_SCRIPT_CHARS).toBe(75_000);
  });

  it('parses PORT as a number', async () => {
    const { validateEnv } = await freshEnv({ PORT: '3000' });

    expect(validateEnv().PORT).toBe(3000);
  });

  it('accepts valid NODE_ENV values', async () => {
    const { validateEnv } = await freshEnv({ NODE_ENV: 'production' });
    expect(validateEnv().NODE_ENV).toBe('production');
  });

  it('throws when NODE_ENV has an invalid value', async () => {
    const { validateEnv } = await freshEnv({ NODE_ENV: 'staging' });
    expect(() => validateEnv()).toThrow('Environment validation failed');
  });

  it('treats empty-string env vars as undefined (not a real value)', async () => {
    const { validateEnv } = await freshEnv({
      OPENAI_API_KEY: '',
      ELEVENLABS_API_KEY: '',
    });

    const config = validateEnv();
    expect(config.OPENAI_API_KEY).toBeUndefined();
    expect(config.ELEVENLABS_API_KEY).toBeUndefined();
  });

  it('caches the result on repeated calls', async () => {
    const { validateEnv } = await freshEnv({});
    const first = validateEnv();
    const second = validateEnv();
    expect(first).toBe(second);
  });
});

// =============================================================================
// getEnv
// =============================================================================

describe('getEnv', () => {
  it('returns the same config as validateEnv', async () => {
    const { getEnv, validateEnv } = await freshEnv({});
    const expected = validateEnv();
    expect(getEnv()).toBe(expected);
  });

  it('calls validateEnv when cache is empty', async () => {
    const { getEnv } = await freshEnv({});
    // No prior call — getEnv should populate the cache
    const config = getEnv();
    expect(config.PORT).toBe(22002);
  });
});

// =============================================================================
// isServiceConfigured
// =============================================================================

describe('isServiceConfigured', () => {
  it('returns true for database when DATABASE_URL is set', async () => {
    const { isServiceConfigured } = await freshEnv({
      DATABASE_URL: 'postgresql://localhost/test',
    });
    expect(isServiceConfigured('database')).toBe(true);
  });

  it('returns false for database when DATABASE_URL is absent', async () => {
    const { isServiceConfigured } = await freshEnv({
      DATABASE_URL: undefined,
    });
    expect(isServiceConfigured('database')).toBe(false);
  });

  it('returns true for elevenlabs when ELEVENLABS_API_KEY is set', async () => {
    const { isServiceConfigured } = await freshEnv({
      ELEVENLABS_API_KEY: 'el_key',
    });
    expect(isServiceConfigured('elevenlabs')).toBe(true);
  });

  it('returns true for openai when OPENAI_API_KEY is set', async () => {
    const { isServiceConfigured } = await freshEnv({
      OPENAI_API_KEY: 'sk-test',
    });
    expect(isServiceConfigured('openai')).toBe(true);
  });

  it('returns true for redis only when both UPSTASH vars are set', async () => {
    const { isServiceConfigured: both } = await freshEnv({
      UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    });
    expect(both('redis')).toBe(true);

    const { isServiceConfigured: partial } = await freshEnv({
      UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: undefined,
    });
    expect(partial('redis')).toBe(false);
  });
});

// =============================================================================
// getOutputDir
// =============================================================================

describe('getOutputDir', () => {
  it('returns AUDIO_OUTPUT_DIR when set', async () => {
    const { getOutputDir } = await freshEnv({
      AUDIO_OUTPUT_DIR: '/var/data/audio',
    });
    expect(getOutputDir()).toBe('/var/data/audio');
  });

  it('falls back to process.cwd()/output when AUDIO_OUTPUT_DIR is unset', async () => {
    const { getOutputDir } = await freshEnv({ AUDIO_OUTPUT_DIR: undefined });
    expect(getOutputDir()).toBe(path.join(process.cwd(), 'output'));
  });
});

// =============================================================================
// getStemsDir
// =============================================================================

describe('getStemsDir', () => {
  it('returns process.cwd()/data/stems', async () => {
    const { getStemsDir } = await import('./env.js');
    expect(getStemsDir()).toBe(path.join(process.cwd(), 'data', 'stems'));
  });
});

// =============================================================================
// STORAGE_PROVIDER=s3 validation (PR #173)
// =============================================================================

describe('validateEnv — STORAGE_PROVIDER=s3', () => {
  const fullS3 = {
    STORAGE_PROVIDER: 's3',
    AWS_ACCESS_KEY_ID: 'AKIATEST',
    AWS_SECRET_ACCESS_KEY: 'secret',
    AWS_S3_BUCKET: 'my-bucket',
    AWS_S3_PUBLIC_URL: 'https://audio.example.com',
  };

  it('accepts pure AWS S3 config without AWS_S3_ENDPOINT (endpoint is R2-only)', async () => {
    // Real AWS S3 does NOT need a custom endpoint — the AWS SDK derives it from region.
    // AWS_S3_ENDPOINT is documented in s3.ts as "optional; custom endpoint for R2 / MinIO".
    // Requiring it in validation forces every prod deployment to use R2 or fake the value.
    const { validateEnv } = await freshEnv({ ...fullS3, AWS_S3_ENDPOINT: undefined });
    expect(() => validateEnv()).not.toThrow();
  });

  it('accepts R2 config with AWS_S3_ENDPOINT', async () => {
    const { validateEnv } = await freshEnv({
      ...fullS3,
      AWS_S3_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
    });
    expect(() => validateEnv()).not.toThrow();
  });

  it('throws with the missing key listed when AWS_ACCESS_KEY_ID is absent', async () => {
    const { validateEnv } = await freshEnv({ ...fullS3, AWS_ACCESS_KEY_ID: undefined });
    expect(() => validateEnv()).toThrow(/AWS_ACCESS_KEY_ID/);
  });

  it('throws when AWS_SECRET_ACCESS_KEY is absent', async () => {
    const { validateEnv } = await freshEnv({ ...fullS3, AWS_SECRET_ACCESS_KEY: undefined });
    expect(() => validateEnv()).toThrow(/AWS_SECRET_ACCESS_KEY/);
  });

  it('throws when AWS_S3_BUCKET is absent', async () => {
    const { validateEnv } = await freshEnv({ ...fullS3, AWS_S3_BUCKET: undefined });
    expect(() => validateEnv()).toThrow(/AWS_S3_BUCKET/);
  });

  it('throws when AWS_S3_PUBLIC_URL is absent', async () => {
    const { validateEnv } = await freshEnv({ ...fullS3, AWS_S3_PUBLIC_URL: undefined });
    expect(() => validateEnv()).toThrow(/AWS_S3_PUBLIC_URL/);
  });

  it('lists every missing key in a single error (not just the first)', async () => {
    const { validateEnv } = await freshEnv({
      STORAGE_PROVIDER: 's3',
      AWS_ACCESS_KEY_ID: undefined,
      AWS_SECRET_ACCESS_KEY: undefined,
      AWS_S3_BUCKET: undefined,
      AWS_S3_PUBLIC_URL: undefined,
    });
    let err: Error | undefined;
    try {
      validateEnv();
    } catch (e) {
      err = e as Error;
    }
    expect(err).toBeDefined();
    expect(err!.message).toMatch(/AWS_ACCESS_KEY_ID/);
    expect(err!.message).toMatch(/AWS_SECRET_ACCESS_KEY/);
    expect(err!.message).toMatch(/AWS_S3_BUCKET/);
    expect(err!.message).toMatch(/AWS_S3_PUBLIC_URL/);
  });

  it('does NOT validate S3 vars when STORAGE_PROVIDER=local (default)', async () => {
    const { validateEnv } = await freshEnv({
      STORAGE_PROVIDER: undefined,
      AWS_ACCESS_KEY_ID: undefined,
      AWS_S3_BUCKET: undefined,
    });
    expect(() => validateEnv()).not.toThrow();
  });

  it('does NOT validate S3 vars when STORAGE_PROVIDER is explicitly local', async () => {
    const { validateEnv } = await freshEnv({
      STORAGE_PROVIDER: 'local',
      AWS_ACCESS_KEY_ID: undefined,
    });
    expect(() => validateEnv()).not.toThrow();
  });
});

// =============================================================================
// printEnvSummary
// =============================================================================

describe('printEnvSummary', () => {
  it('calls console.log without throwing', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { printEnvSummary } = await freshEnv({
      DATABASE_URL: 'postgresql://localhost/test',
      ELEVENLABS_API_KEY: 'key',
    });

    expect(() => printEnvSummary()).not.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('includes NODE_ENV and PORT in output', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => {
      lines.push(String(args[0]));
    });
    const { printEnvSummary } = await freshEnv({ PORT: '4000', NODE_ENV: 'production' });

    printEnvSummary();

    const combined = lines.join('\n');
    expect(combined).toContain('production');
    expect(combined).toContain('4000');
  });
});

// =============================================================================
// positiveIntEnv (augmenting #407)
// =============================================================================
//
// Peter's #407 moved SCENES_PER_CHUNK + SCENE_CONSTRUCTION_MAX_TOKENS to env
// vars but kept the pre-existing `parseInt(v, 10)` pattern that silently
// returns NaN on bad input. This helper catches the bug class. Tests pin the
// contract so a future refactor can't silently regress to the lenient pattern.
//
// Bug we're guarding against:
//   SCENES_PER_CHUNK=abc
//   → parseInt returns NaN
//   → this.scenesPerChunk = NaN
//   → chunkScript(text, NaN) splits into 0 chunks or hangs
//   → director silently fails with no log naming the cause
//
// Now: SCENES_PER_CHUNK=abc throws at boot via validateEnv with a clear
// message that names the offending env var.

describe('positiveIntEnv', () => {
  it('returns the default when the env var is unset', async () => {
    const { z } = await import('zod');
    const { positiveIntEnv } = await import('./env.js');
    const schema = z.object({ N: positiveIntEnv('N', 42) });
    expect(schema.parse({}).N).toBe(42);
  });

  it('returns the default when the env var is empty', async () => {
    const { z } = await import('zod');
    const { positiveIntEnv } = await import('./env.js');
    const schema = z.object({ N: positiveIntEnv('N', 42) });
    expect(schema.parse({ N: '' }).N).toBe(42);
  });

  it('parses valid positive integer strings', async () => {
    const { z } = await import('zod');
    const { positiveIntEnv } = await import('./env.js');
    const schema = z.object({ N: positiveIntEnv('N', 1) });
    expect(schema.parse({ N: '10' }).N).toBe(10);
    expect(schema.parse({ N: '32768' }).N).toBe(32_768);
    expect(schema.parse({ N: '1' }).N).toBe(1);
  });

  it('tolerates surrounding whitespace', async () => {
    const { z } = await import('zod');
    const { positiveIntEnv } = await import('./env.js');
    const schema = z.object({ N: positiveIntEnv('N', 1) });
    expect(schema.parse({ N: '  10  ' }).N).toBe(10);
  });

  it('rejects non-numeric strings (the silent-NaN bug class)', async () => {
    const { z } = await import('zod');
    const { positiveIntEnv } = await import('./env.js');
    const schema = z.object({ N: positiveIntEnv('N', 1) });
    expect(() => schema.parse({ N: 'abc' })).toThrow(/not a non-negative integer/);
    expect(() => schema.parse({ N: '10abc' })).toThrow(/not a non-negative integer/);
    expect(() => schema.parse({ N: 'abc10' })).toThrow(/not a non-negative integer/);
  });

  it('rejects decimal strings (parseInt would silently truncate them)', async () => {
    const { z } = await import('zod');
    const { positiveIntEnv } = await import('./env.js');
    const schema = z.object({ N: positiveIntEnv('N', 1) });
    // parseInt('1.5', 10) === 1 — that's the silent-truncation bug.
    expect(() => schema.parse({ N: '1.5' })).toThrow(/not a non-negative integer/);
    expect(() => schema.parse({ N: '0.5' })).toThrow(/not a non-negative integer/);
  });

  it('rejects zero (must be a positive integer)', async () => {
    const { z } = await import('zod');
    const { positiveIntEnv } = await import('./env.js');
    const schema = z.object({ N: positiveIntEnv('N', 1) });
    expect(() => schema.parse({ N: '0' })).toThrow(/must be a positive integer/);
  });

  it('rejects negative numbers via the regex check', async () => {
    const { z } = await import('zod');
    const { positiveIntEnv } = await import('./env.js');
    const schema = z.object({ N: positiveIntEnv('N', 1) });
    expect(() => schema.parse({ N: '-5' })).toThrow(/not a non-negative integer/);
    expect(() => schema.parse({ N: '-1' })).toThrow(/not a non-negative integer/);
  });

  it('names the env var in the error so operators can find it', async () => {
    const { z } = await import('zod');
    const { positiveIntEnv } = await import('./env.js');
    const schema = z.object({
      MY_CUSTOM_VAR: positiveIntEnv('MY_CUSTOM_VAR', 1),
    });
    try {
      schema.parse({ MY_CUSTOM_VAR: 'oops' });
      throw new Error('expected throw');
    } catch (err) {
      expect(String(err)).toContain('MY_CUSTOM_VAR');
      expect(String(err)).toContain('oops');
    }
  });

  it('SCENES_PER_CHUNK uses the helper and defaults to 10 (pinning #407 contract)', async () => {
    const env = await freshEnv({});
    expect(env.getEnv().SCENES_PER_CHUNK).toBe(10);
  });

  it('SCENE_CONSTRUCTION_MAX_TOKENS uses the helper and defaults to 32768 (pinning #407 contract)', async () => {
    const env = await freshEnv({});
    expect(env.getEnv().SCENE_CONSTRUCTION_MAX_TOKENS).toBe(32_768);
  });

  it('SCENES_PER_CHUNK=abc now fails loudly at boot instead of silently producing NaN', async () => {
    // Before this patch, SCENES_PER_CHUNK=abc passed through env validation
    // as NaN. Pin the new strict behavior: validateEnv throws with the var
    // name in the error.
    const env = await freshEnv({ SCENES_PER_CHUNK: 'abc' });
    expect(() => env.validateEnv()).toThrow();
  });

  it('SCENE_CONSTRUCTION_MAX_TOKENS=1.5 now fails loudly at boot', async () => {
    const env = await freshEnv({ SCENE_CONSTRUCTION_MAX_TOKENS: '1.5' });
    expect(() => env.validateEnv()).toThrow();
  });
});
