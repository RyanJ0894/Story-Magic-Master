/**
 * Environment variable validation with Zod
 *
 * Validates all required and optional environment variables at startup.
 * Provides typed access to environment variables.
 */

import { z } from 'zod';
import path from 'path';

// =============================================================================
// Helpers
// =============================================================================

/**
 * Preprocessor that converts empty strings to undefined.
 * Useful for optional env vars that may be set to "" in docker-compose.
 */
const emptyToUndefined = (val: unknown) => (val === '' ? undefined : val);

/** Optional string that must have at least 1 char if provided */
const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());

/** Optional URL string */
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

/** Optional enum */
const optionalTrueFalse = z.preprocess(emptyToUndefined, z.enum(['true', 'false']).optional());
const optionalLogLevel = z.preprocess(emptyToUndefined, z.enum(['debug', 'info', 'warn', 'error']).optional());

// =============================================================================
// Environment Schema
// =============================================================================
const envSchema = z.object({
  // Server
  PORT: z.string().default('22002').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database (Render PostgreSQL)
  DATABASE_URL: optionalString,

  // LLM APIs
  OPENAI_API_KEY: optionalString,
  GROQ_API_KEY: optionalString,
  DIRECTOR_MODEL: z.string().default('anthropic/claude-sonnet-4-6'),
  DIRECTOR_MODEL_ADVANCED: z.string().default('anthropic/claude-opus-4-6'),
  // Audio director (music/ambience/SFX selection) is tool-heavy but shallow-
  // decision: each search_music/ambience/sfx call picks from a small ranked list.
  // Haiku 4.5 (~1/12 the cost of Sonnet). Mirrors VOICE_ASSIGNMENT_MODEL rationale.
  // Override to Sonnet if audio selection quality regresses.
  AUDIO_DIRECTOR_MODEL: z.string().default('anthropic/claude-haiku-4-5'),
  // Voice assignment is a tool-heavy but shallow-decision path (search_voices,
  // get_voice, commit_voice — each individual call needs little reasoning).
  // Defaults to Haiku 4.5 (~1/12 the cost of Sonnet). Override to a stronger
  // model if voice casting quality regresses on your scripts.
  VOICE_ASSIGNMENT_MODEL: z.string().default('anthropic/claude-haiku-4-5'),

  // TTS
  ELEVENLABS_API_KEY: optionalString,

  // Rate Limiting (Upstash Redis)
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalString,

  // Whisper (optional for alignment)
  WHISPER_CPP_PATH: optionalString,
  WHISPER_MODEL_PATH: optionalString,

  // Monitoring
  SENTRY_DSN: optionalUrl,
  SENTRY_ENABLED: optionalTrueFalse,
  CHECKLY_PING_URL: optionalUrl,
  LOG_LEVEL: optionalLogLevel,

  // Storage
  AUDIO_OUTPUT_DIR: optionalString, // Defaults to process.cwd()/output
  // S3 audio storage — set STORAGE_PROVIDER=s3 to upload final episode files to S3
  // instead of serving from local Render disk (required for horizontal scaling).
  STORAGE_PROVIDER: z.preprocess(emptyToUndefined, z.enum(['local', 's3']).default('local')),
  AWS_ACCESS_KEY_ID: optionalString,
  AWS_SECRET_ACCESS_KEY: optionalString,
  AWS_S3_BUCKET: optionalString,
  AWS_S3_REGION: optionalString,
  AWS_S3_ENDPOINT: optionalUrl,   // custom endpoint for R2 / MinIO
  AWS_S3_PUBLIC_URL: optionalUrl,

  // Script size limits (pre-flight guards against LLM context overflow)
  // Defaults: 150 pages / 75_000 chars. Both limits trigger a 400 before any LLM call.
  MAX_SCRIPT_PAGES: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 150)),
  MAX_SCRIPT_CHARS: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 75_000)),

  // Feature Flags
  AUTH_DISABLED: optionalTrueFalse,
  RATE_LIMIT_DISABLED: optionalTrueFalse,

  // Auth
  CLERK_SECRET_KEY: optionalString,

  // Internal Services
  SERVICE_SECRET_KEY: optionalString,
  // Public base URL for this orchestrator (used to construct audio download URLs)
  // e.g. https://story-magic-orchestrator.onrender.com
  ORCHESTRATOR_PUBLIC_URL: optionalUrl,
});

// =============================================================================
// Validation
// =============================================================================
type EnvConfig = z.infer<typeof envSchema>;

let cachedEnv: EnvConfig | null = null;

/**
 * Validates environment variables and returns typed config.
 * Caches result for subsequent calls.
 */
export function validateEnv(): EnvConfig {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    throw new Error('Environment validation failed');
  }

  cachedEnv = result.data;
  return cachedEnv;
}

/**
 * Gets a validated environment config.
 * Call this after server startup to ensure env is validated.
 */
export function getEnv(): EnvConfig {
  if (!cachedEnv) {
    return validateEnv();
  }
  return cachedEnv;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if a required service is configured
 */
export function isServiceConfigured(service: 'database' | 'elevenlabs' | 'openai' | 'redis'): boolean {
  const env = getEnv();

  switch (service) {
    case 'database':
      return !!env.DATABASE_URL;
    case 'elevenlabs':
      return !!env.ELEVENLABS_API_KEY;
    case 'openai':
      return !!env.OPENAI_API_KEY;
    case 'redis':
      return !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
    default:
      return false;
  }
}

/**
 * Get the audio output base directory.
 * Render.com mounts persistent disk at AUDIO_OUTPUT_DIR (/var/data/audio).
 * Falls back to process.cwd()/output for local development.
 */
export function getOutputDir(): string {
  const env = getEnv();
  return env.AUDIO_OUTPUT_DIR || path.join(process.cwd(), 'output');
}

/**
 * Get the stems scratch directory (ephemeral PCM/WAV files created during mixing).
 */
export function getStemsDir(): string {
  return path.join(process.cwd(), 'data', 'stems');
}

/**
 * Print startup environment summary
 */
export function printEnvSummary(): void {
  const env = getEnv();

  console.log('\n📋 Environment Configuration:');
  console.log(`   Node Environment: ${env.NODE_ENV}`);
  console.log(`   Port: ${env.PORT}`);
  console.log(`   Database: ${isServiceConfigured('database') ? '✅' : '❌'}`);
  console.log(`   Clerk Auth: ${env.CLERK_SECRET_KEY ? '✅' : '❌'}`);

  console.log(`   ElevenLabs: ${isServiceConfigured('elevenlabs') ? '✅' : '❌'}`);
  console.log(`   OpenAI: ${isServiceConfigured('openai') ? '✅' : '❌'}`);
  console.log(`   Rate Limiting: ${isServiceConfigured('redis') ? '✅ (Redis)' : '⚠️ (In-memory)'}`);
  console.log(`   Director Model: ${env.DIRECTOR_MODEL}`);
  console.log(`   Director Model (Advanced): ${env.DIRECTOR_MODEL_ADVANCED}`);
  console.log(`   Audio Director Model: ${env.AUDIO_DIRECTOR_MODEL}`);
  console.log(`   Voice Assignment Model: ${env.VOICE_ASSIGNMENT_MODEL}`);
  console.log(`   Storage: ${env.STORAGE_PROVIDER === 's3' && env.AWS_S3_BUCKET ? `✅ S3 (${env.AWS_S3_BUCKET})` : '📁 local disk'}`);

  // T3-1: loud warning if TEST_MODE is on. We deliberately print this AFTER
  // the model lines so it's the last thing the operator sees on startup.
  if (process.env.TEST_MODE === 'mock') {
    console.log('');
    console.log('   🟡🟡🟡 TEST_MODE=mock IS ACTIVE 🟡🟡🟡');
    console.log('   No real LLM calls will be made. Responses are stubbed/canned.');
    console.log('   Disable by unsetting TEST_MODE before running anything that');
    console.log('   should hit real providers (deploys, paid users, evals).');
  }
  console.log('');
}
