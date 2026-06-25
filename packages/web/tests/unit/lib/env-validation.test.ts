/**
 * Contract tests for `lib/env-validation.ts`.
 *
 * This module gates the web service's boot — if a required env var is missing
 * we surface it as an error; missing optionals become warnings; at least one
 * of three LLM providers must be present. The tests pin that contract so a
 * future refactor (e.g. someone deletes a required var thinking it's unused)
 * can't silently weaken the gate.
 *
 * Tests use a save/restore of `process.env` between cases — `validateEnv` is
 * a pure function over `process.env`, so no module reloading is needed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateEnv } from '@/lib/env-validation';

/**
 * Required env vars that must be present for the gate to pass. Hardcoded in
 * the test (not derived from the schema) so a refactor that removes a row
 * from the schema is caught by the test, not silently allowed through.
 */
const REQUIRED = [
  'DATABASE_URL',
  'CLERK_SECRET_KEY',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'ELEVENLABS_API_KEY',
  'ORCHESTRATOR_URL',
] as const;

const OPTIONAL = [
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'SERVICE_SECRET_KEY',
  'SENTRY_DSN',
  'AUDIO_OUTPUT_DIR',
  'STORAGE_BUCKET_URL',
] as const;

const LLM_PROVIDERS = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GROQ_API_KEY'] as const;

function fullyValidEnv(): Record<string, string> {
  return {
    DATABASE_URL: 'postgresql://localhost/test',
    CLERK_SECRET_KEY: 'sk_test_clerk',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_clerk',
    STRIPE_SECRET_KEY: 'sk_test_stripe',
    ELEVENLABS_API_KEY: 'sk_eleven',
    ORCHESTRATOR_URL: 'https://orchestrator.example.com',
    ANTHROPIC_API_KEY: 'sk-ant-test',
  };
}

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  // Wipe every env var the validator cares about so each test starts from a
  // clean state. We don't `process.env = {}` because Node libraries rely on
  // PATH, HOME, etc. Just clear the validator-scoped subset.
  for (const k of [...REQUIRED, ...OPTIONAL, ...LLM_PROVIDERS]) {
    delete process.env[k];
  }
});

afterEach(() => {
  process.env = savedEnv;
});

describe('validateEnv — happy path', () => {
  it('returns valid=true with no errors when all required + 1 LLM provider are set', () => {
    Object.assign(process.env, fullyValidEnv());
    const result = validateEnv();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('treats every optional as a warning when missing (not an error)', () => {
    Object.assign(process.env, fullyValidEnv());
    const result = validateEnv();
    // Every OPTIONAL should appear in warnings (none set above except the
    // ANTHROPIC_API_KEY which is not in OPTIONAL list as a check — it's an
    // LLM provider).
    for (const optName of OPTIONAL) {
      expect(result.warnings.some((w) => w.includes(optName))).toBe(true);
    }
    expect(result.valid).toBe(true);
  });
});

describe('validateEnv — required-var gate', () => {
  // Generate one test per required var that confirms the gate flips to
  // invalid + names the missing var in the error message.
  for (const requiredName of REQUIRED) {
    it(`fails when ${requiredName} is missing`, () => {
      const env = fullyValidEnv();
      delete (env as Record<string, string | undefined>)[requiredName];
      Object.assign(process.env, env);

      const result = validateEnv();

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes(requiredName))).toBe(true);
    });
  }

  it('reports multiple missing required vars in one pass', () => {
    // Only set ONE required; the rest should all report errors.
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'; // satisfy LLM gate

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(REQUIRED.length - 1);
  });

  it('rejects an invalid ORCHESTRATOR_URL (not a URL)', () => {
    Object.assign(process.env, { ...fullyValidEnv(), ORCHESTRATOR_URL: 'not-a-url' });

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('ORCHESTRATOR_URL'))).toBe(true);
  });

  it('rejects empty-string required vars (not just undefined)', () => {
    Object.assign(process.env, { ...fullyValidEnv(), DATABASE_URL: '' });

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('DATABASE_URL'))).toBe(true);
  });
});

describe('validateEnv — LLM-provider gate (at-least-one rule)', () => {
  it('fails when NO LLM provider is set, even with all other required vars', () => {
    const env = fullyValidEnv();
    delete (env as Record<string, string | undefined>).ANTHROPIC_API_KEY;
    Object.assign(process.env, env);

    const result = validateEnv();

    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) => e.toLowerCase().includes('llm') || e.includes('ANTHROPIC_API_KEY'),
      ),
    ).toBe(true);
  });

  it('passes with ANTHROPIC_API_KEY alone', () => {
    const env = fullyValidEnv();
    Object.assign(process.env, env);
    delete process.env.OPENAI_API_KEY;
    delete process.env.GROQ_API_KEY;

    expect(validateEnv().valid).toBe(true);
  });

  it('passes with OPENAI_API_KEY alone (no Anthropic, no Groq)', () => {
    const env = fullyValidEnv();
    delete (env as Record<string, string | undefined>).ANTHROPIC_API_KEY;
    Object.assign(process.env, env, { OPENAI_API_KEY: 'sk-openai-test' });

    expect(validateEnv().valid).toBe(true);
  });

  it('passes with GROQ_API_KEY alone', () => {
    const env = fullyValidEnv();
    delete (env as Record<string, string | undefined>).ANTHROPIC_API_KEY;
    Object.assign(process.env, env, { GROQ_API_KEY: 'gsk-test' });

    expect(validateEnv().valid).toBe(true);
  });
});

describe('validateEnv — return shape', () => {
  it('always returns the {valid, errors, warnings} shape — no throws', () => {
    // Empty env should produce errors but NOT throw. The whole point of the
    // module: collect issues for logging, never break the boot.
    const result = validateEnv();
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('errors and warnings arrays are independent — a required missing does not bleed into warnings', () => {
    Object.assign(process.env, fullyValidEnv());
    delete process.env.DATABASE_URL;

    const result = validateEnv();

    // The required-var failure goes to errors, not warnings.
    expect(result.errors.some((e) => e.includes('DATABASE_URL'))).toBe(true);
    expect(result.warnings.every((w) => !w.includes('DATABASE_URL'))).toBe(true);
  });
});
