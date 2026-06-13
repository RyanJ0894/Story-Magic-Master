/**
 * H8 — Internal manifest endpoint
 *
 * GET /internal/manifest — service-to-service auth (X-Service-Key) — returns
 * the orchestrator's deploy state in the same shape as the web /api/admin/
 * manifest counterpart. The web manifest aggregates both so on-call has a
 * single URL to answer "what's actually in prod right now."
 */

import { Router, Request, Response } from 'express';

const router = Router();

const PROCESS_STARTED_AT = Date.now();

const ENV_PRESENCE_KEYS = [
  'DATABASE_URL',
  'REDIS_URL',
  'CLERK_SECRET_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'ELEVENLABS_API_KEY',
  'GROQ_API_KEY',
  'OPENROUTER_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_S3_BUCKET',
  'SENTRY_DSN',
  'SERVICE_SECRET_KEY',
  'WHISPER_CPP_PATH',
  'WHISPER_MODEL_PATH',
] as const;

router.get('/internal/manifest', (_req: Request, res: Response): void => {
  const presence: Record<string, boolean> = {};
  for (const k of ENV_PRESENCE_KEYS) presence[k] = !!process.env[k];

  res.json({
    service: 'orchestrator',
    commit: process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT ?? null,
    branch: process.env.RENDER_GIT_BRANCH ?? null,
    deployedAt: new Date(PROCESS_STARTED_AT).toISOString(),
    uptime_seconds: Math.round((Date.now() - PROCESS_STARTED_AT) / 1000),
    env: {
      nodeEnv: process.env.NODE_ENV ?? null,
      presence,
    },
  });
});

export default router;
