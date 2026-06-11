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
