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

  // Supabase (required for database operations)
  SUPABASE_URL: optionalUrl,
  SUPABASE_ANON_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  // Alternative names for Supabase vars
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,

  // LLM APIs
  OPENAI_API_KEY: optionalString,
  GROQ_API_KEY: optionalString,
  DIRECTOR_MODEL: z.string().default('openai/gpt-4.1'),
  AUDIO_DIRECTOR_MODEL: z.string().default('openai/gpt-4.1'),

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

  // Feature Flags
  AUTH_DISABLED: optionalTrueFalse,
  RATE_LIMIT_DISABLED: optionalTrueFalse,

  // Internal Services
  SERVICE_SECRET_KEY: optionalString,
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
export function isServiceConfigured(service: 'supabase' | 'elevenlabs' | 'openai' | 'redis'): boolean {
  const env = getEnv();

  switch (service) {
    case 'supabase':
      return !!(
        (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL) &&
        (env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      );
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
 * Get effective Supabase URL (checks both naming conventions)
 */
export function getSupabaseUrl(): string | undefined {
  const env = getEnv();
  return env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
}

/**
 * Get effective Supabase anon key (checks both naming conventions)
 */
export function getSupabaseAnonKey(): string | undefined {
  const env = getEnv();
  return env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
 * Print startup environment summary
 */
export function printEnvSummary(): void {
  const env = getEnv();

  console.log('\n📋 Environment Configuration:');
  console.log(`   Node Environment: ${env.NODE_ENV}`);
  console.log(`   Port: ${env.PORT}`);
  console.log(`   Supabase: ${isServiceConfigured('supabase') ? '✅' : '❌'}`);
  console.log(`   ElevenLabs: ${isServiceConfigured('elevenlabs') ? '✅' : '❌'}`);
  console.log(`   OpenAI: ${isServiceConfigured('openai') ? '✅' : '❌'}`);
  console.log(`   Rate Limiting: ${isServiceConfigured('redis') ? '✅ (Redis)' : '⚠️ (In-memory)'}`);
  console.log(`   Director Model: ${env.DIRECTOR_MODEL}`);
  console.log(`   Audio Director Model: ${env.AUDIO_DIRECTOR_MODEL}`);
  console.log('');
}
