/**
 * Environment variable validation with Zod
 *
 * Validates all required and optional environment variables at startup.
 * Provides typed access to environment variables.
 */

import { z } from 'zod';

// =============================================================================
// Environment Schema
// =============================================================================
const envSchema = z.object({
  // Server
  PORT: z.string().default('22002').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Supabase (required for database operations)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  // Alternative names for Supabase vars
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),

  // LLM APIs
  OPENAI_API_KEY: z.string().min(1).optional(),
  GROQ_API_KEY: z.string().min(1).optional(),
  DIRECTOR_MODEL: z.string().default('openai/gpt-4.1'),
  AUDIO_DIRECTOR_MODEL: z.string().default('openai/gpt-4.1'),

  // TTS
  ELEVENLABS_API_KEY: z.string().min(1).optional(),

  // Rate Limiting (Upstash Redis)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  // Whisper (optional for alignment)
  WHISPER_CPP_PATH: z.string().optional(),
  WHISPER_MODEL_PATH: z.string().optional(),

  // Monitoring
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENABLED: z.enum(['true', 'false']).optional(),
  CHECKLY_PING_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),

  // Feature Flags
  AUTH_DISABLED: z.enum(['true', 'false']).optional(),
  RATE_LIMIT_DISABLED: z.enum(['true', 'false']).optional(),

  // Internal Services
  SERVICE_SECRET_KEY: z.string().min(1).optional(),
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
