#!/usr/bin/env node
/**
 * Pre-deploy environment variable validator — Story Magic Orchestrator (Express)
 *
 * Fails fast with a complete list of every missing/invalid variable.
 * Runs before the service starts; if this exits non-zero, Render aborts the deploy.
 *
 * Usage:
 *   node scripts/check-env-orchestrator.js
 *   NODE_ENV=production node scripts/check-env-orchestrator.js
 */
'use strict';

const env = process.env;
const errors = [];
const warnings = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function required(key, description) {
  const val = env[key];
  if (!val || val.trim() === '') {
    errors.push(`  ✗ ${key} — MISSING  (${description})`);
    return false;
  }
  return true;
}

function requiredInEnvs(key, envs, description) {
  const nodeEnv = env.NODE_ENV || 'development';
  if (envs.includes(nodeEnv)) {
    required(key, description);
  }
}

function mustEqual(key, expected, description) {
  if (env[key] !== undefined && env[key] !== expected) {
    errors.push(`  ✗ ${key}='${env[key]}' — must be '${expected}' in ${env.NODE_ENV}  (${description})`);
  }
}

function mustNotEqual(key, forbidden, description) {
  if (env[key] === forbidden) {
    errors.push(`  ✗ ${key}='${forbidden}' — ${description}`);
  }
}

function warnIfMissing(key, description) {
  const val = env[key];
  if (!val || val.trim() === '') {
    warnings.push(`  ⚠  ${key} — not set  (${description})`);
  }
}

function warnIfValue(key, badValue, description) {
  if (env[key] === badValue) {
    warnings.push(`  ⚠  ${key}='${badValue}' — ${description}`);
  }
}

// ── Setup ────────────────────────────────────────────────────────────────────

const nodeEnv = env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';
const isProdOrStaging = isProd || nodeEnv === 'staging';

console.log(`\n🔍  Story Magic Orchestrator — env check  [NODE_ENV=${nodeEnv}]\n`);

// ── Core ─────────────────────────────────────────────────────────────────────

const validEnvs = ['development', 'test', 'staging', 'production'];
if (!validEnvs.includes(nodeEnv)) {
  errors.push(`  ✗ NODE_ENV='${nodeEnv}' — must be one of: ${validEnvs.join(', ')}`);
}

// ── Database ─────────────────────────────────────────────────────────────────

required('DATABASE_URL', 'PostgreSQL connection string — injected by Render from story-magic-db');

// ── Auth ──────────────────────────────────────────────────────────────────────

required('CLERK_SECRET_KEY', 'Clerk server-side secret — required to verify incoming JWT tokens');
required('SERVICE_SECRET_KEY', 'Shared secret for web → orchestrator calls — must match web service');

if (env.SERVICE_SECRET_KEY && env.SERVICE_SECRET_KEY.length < 32) {
  errors.push(`  ✗ SERVICE_SECRET_KEY — too short (${env.SERVICE_SECRET_KEY.length} chars), use openssl rand -hex 32`);
}

// AUTH_DISABLED must NEVER be true in production
if (isProdOrStaging) {
  mustNotEqual('AUTH_DISABLED', 'true',
    'SECURITY: authentication bypass must not be enabled in production/staging');
}

// ── AI / LLM Services ─────────────────────────────────────────────────────────

// At least one LLM provider must be configured
const hasAnthropic = !!(env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.trim());
const hasOpenAI = !!(env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim());
const hasGroq = !!(env.GROQ_API_KEY && env.GROQ_API_KEY.trim());

if (!hasAnthropic && !hasOpenAI && !hasGroq) {
  errors.push('  ✗ LLM provider — MISSING: at least one of ANTHROPIC_API_KEY, OPENAI_API_KEY, or GROQ_API_KEY is required for script analysis');
}

// Director model must reference an available provider
const directorModel = env.DIRECTOR_MODEL || '';
if (directorModel.startsWith('anthropic/') && !hasAnthropic) {
  errors.push(`  ✗ DIRECTOR_MODEL='${directorModel}' requires ANTHROPIC_API_KEY — set key or switch model`);
}
if (directorModel.startsWith('openai/') && !hasOpenAI) {
  errors.push(`  ✗ DIRECTOR_MODEL='${directorModel}' requires OPENAI_API_KEY — set key or switch model`);
}
if (directorModel.startsWith('groq/') && !hasGroq) {
  errors.push(`  ✗ DIRECTOR_MODEL='${directorModel}' requires GROQ_API_KEY — set key or switch model`);
}

// Note: claude-sonnet-4-6 is fully supported on AI SDK v6

// ── TTS / Audio ───────────────────────────────────────────────────────────────

required('ELEVENLABS_API_KEY',
  'ElevenLabs API key — required for TTS audio generation (the core product feature)');

// ── Web URL (CORS) ────────────────────────────────────────────────────────────

requiredInEnvs('WEB_URL', ['production', 'staging'],
  'Frontend URL — required for CORS allowlist (e.g. https://app.storymagicapp.net)');

// ── Audio Storage ─────────────────────────────────────────────────────────────

required('AUDIO_OUTPUT_DIR',
  'Directory for generated audio files — must be on a persistent disk in production (/var/data/audio)');

if (isProdOrStaging) {
  if (env.AUDIO_OUTPUT_DIR && !env.AUDIO_OUTPUT_DIR.startsWith('/var/data')) {
    warnings.push(`  ⚠  AUDIO_OUTPUT_DIR='${env.AUDIO_OUTPUT_DIR}' — in production this should be on the persistent disk (/var/data/audio) or files will be lost on redeploy`);
  }
}

// ── Warnings (optional services) ─────────────────────────────────────────────

if (isProdOrStaging) {
  warnIfMissing('SENTRY_DSN', 'error tracking will be disabled');
  warnIfMissing('UPSTASH_REDIS_REST_URL', 'rate limiting will fall back to in-memory (not shared across instances)');
  warnIfMissing('UPSTASH_REDIS_REST_TOKEN', 'rate limiting will fall back to in-memory');
  warnIfMissing('ORCHESTRATOR_PUBLIC_URL', 'audio download URLs in responses may be incorrect');
  warnIfMissing('CHECKLY_PING_URL', 'uptime heartbeat monitoring will be disabled');
  warnIfValue('LOG_LEVEL', 'debug', 'debug logging in production generates excessive noise — set to info');
}

// ── Report ───────────────────────────────────────────────────────────────────

if (warnings.length > 0) {
  console.warn(`⚠   ${warnings.length} optional variable(s) not set:\n`);
  warnings.forEach((w) => console.warn(w));
  console.warn('');
}

if (errors.length > 0) {
  console.error(`❌  Environment validation FAILED — ${errors.length} error(s):\n`);
  errors.forEach((e) => console.error(e));
  console.error('\n  Fix the above variables in the Render dashboard before deploying.\n');
  process.exit(1);
}

console.log(`✅  All required environment variables are set  [${nodeEnv}]\n`);
