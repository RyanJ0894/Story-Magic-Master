#!/usr/bin/env node
/**
 * Pre-deploy environment variable validator — Story Magic Web (Next.js)
 *
 * Fails fast with a complete list of every missing/invalid variable.
 * Runs before migrations; if this exits non-zero, Render aborts the deploy.
 *
 * Usage:
 *   node scripts/check-env-web.js
 *   NODE_ENV=production node scripts/check-env-web.js
 *
 * Render preDeployCommand:
 *   node scripts/check-env-web.js && cd packages/web && npx prisma migrate deploy
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

function mustMatchPrefix(key, prefix, description) {
  const val = env[key];
  if (val && !val.startsWith(prefix)) {
    errors.push(`  ✗ ${key} — value must start with '${prefix}'  (${description})`);
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

// ── Setup ────────────────────────────────────────────────────────────────────

const nodeEnv = env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';
const isProdOrStaging = isProd || nodeEnv === 'staging';

console.log(`\n🔍  Story Magic Web — env check  [NODE_ENV=${nodeEnv}]\n`);

// ── Core ─────────────────────────────────────────────────────────────────────

const validEnvs = ['development', 'test', 'staging', 'production'];
if (!validEnvs.includes(nodeEnv)) {
  errors.push(`  ✗ NODE_ENV='${nodeEnv}' — must be one of: ${validEnvs.join(', ')}`);
}

// ── Database ─────────────────────────────────────────────────────────────────

required('DATABASE_URL', 'PostgreSQL connection string — injected by Render from story-magic-db');
required('DIRECT_DATABASE_URL', 'Direct (non-pooled) PostgreSQL URL — required for Prisma migrations');

// ── Clerk Auth ───────────────────────────────────────────────────────────────

required('CLERK_SECRET_KEY', 'Clerk server-side secret — dashboard.clerk.com → API Keys');
required('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'Clerk publishable key — dashboard.clerk.com → API Keys');
mustMatchPrefix('CLERK_SECRET_KEY', 'sk_', 'Clerk key format');
if (isProd) {
  mustNotEqual('CLERK_SECRET_KEY', '', 'required in production');
  if (env.CLERK_SECRET_KEY && env.CLERK_SECRET_KEY.startsWith('sk_test_')) {
    warnings.push('  ⚠  CLERK_SECRET_KEY — using TEST key; switch to sk_live_ before launch');
  }
}

// ── Inter-service Auth ───────────────────────────────────────────────────────

required('SERVICE_SECRET_KEY', 'Shared secret for web → orchestrator calls — must match orchestrator');
if (env.SERVICE_SECRET_KEY && env.SERVICE_SECRET_KEY.length < 32) {
  errors.push(`  ✗ SERVICE_SECRET_KEY — too short (${env.SERVICE_SECRET_KEY.length} chars), use openssl rand -hex 32`);
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

required('ORCHESTRATOR_URL', 'Internal URL for orchestrator — e.g. https://story-magic-orchestrator.onrender.com');

// ── Redis (Render Key Value) ─────────────────────────────────────────────────
// Migrated from Upstash REST in PR #226/#227. REDIS_URL is now the canonical
// Render Key Value connection string (rediss:// with TLS). If unset, rate
// limiting falls back to in-memory (per-instance, not aggregated) — acceptable
// at our current scale so we warn rather than fail.

warnIfMissing('REDIS_URL', 'Render Key Value rediss:// URL — rate limiting will fall back to in-memory if unset');

// ── Stripe ───────────────────────────────────────────────────────────────────

requiredInEnvs('STRIPE_SECRET_KEY', ['production', 'staging'],
  'Stripe secret key — dashboard.stripe.com → Developers → API Keys');
requiredInEnvs('STRIPE_WEBHOOK_SECRET', ['production', 'staging'],
  'Stripe webhook signing secret — dashboard.stripe.com → Webhooks');
requiredInEnvs('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', ['production', 'staging'],
  'Stripe publishable key — dashboard.stripe.com → Developers → API Keys');

if (env.STRIPE_SECRET_KEY) {
  mustMatchPrefix('STRIPE_SECRET_KEY', 'sk_', 'Stripe key format');
  if (isProd && env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
    warnings.push('  ⚠  STRIPE_SECRET_KEY — using TEST key; switch to sk_live_ before accepting real payments');
  }
}
if (env.STRIPE_WEBHOOK_SECRET) {
  mustMatchPrefix('STRIPE_WEBHOOK_SECRET', 'whsec_', 'Stripe webhook secret format');
}

// ── Cron Secret ──────────────────────────────────────────────────────────────

requiredInEnvs('CRON_SECRET', ['production', 'staging'],
  'Secret for cron job requests — must match value on impact-prize-draw cron service');

// ── Auth guard: AUTH_DISABLED must never be enabled in production ─────────────

if (isProdOrStaging && env.AUTH_DISABLED === 'true') {
  errors.push('  ✗ AUTH_DISABLED=true — MUST NOT be set to true in production/staging');
}

// ── Warnings (optional services) ─────────────────────────────────────────────

if (isProdOrStaging) {
  warnIfMissing('RESEND_API_KEY', 'transactional email (invites, receipts) will be disabled');
  warnIfMissing('ELEVENLABS_API_KEY', 'TTS-side voice previews may fail');
  warnIfMissing('ANTHROPIC_API_KEY', 'StoryScore, Story-Adviser features will be disabled');
  warnIfMissing('OPENAI_API_KEY', 'fallback LLM features will be disabled');
  warnIfMissing('SENTRY_DSN', 'error tracking will be disabled — consider enabling for production');
  warnIfMissing('NEXT_PUBLIC_SENTRY_DSN', 'client-side error tracking will be disabled');
  warnIfMissing('R2_ACCOUNT_ID', 'Cloudflare R2 audio storage will be disabled');
  warnIfMissing('R2_ACCESS_KEY_ID', 'Cloudflare R2 audio storage will be disabled');
  warnIfMissing('R2_SECRET_ACCESS_KEY', 'Cloudflare R2 audio storage will be disabled');
  warnIfMissing('R2_BUCKET_NAME', 'Cloudflare R2 audio storage will be disabled');
  warnIfMissing('CLERK_WEBHOOK_SECRET', 'Clerk webhooks (user sync) will not be validated');
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
