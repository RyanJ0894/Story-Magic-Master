/**
 * H8 — Prod manifest endpoint
 *
 * `GET /api/admin/manifest` — admin-only — returns a snapshot of what's
 * actually deployed to prod right now, across both services:
 *   - git commit hash (from RENDER_GIT_COMMIT, injected by Render at build)
 *   - deployedAt (the process boot time as a proxy)
 *   - env variable presence map (no secret values, just true/false)
 *   - drift flags (web vs orchestrator commit mismatch)
 *
 * Replaces the multi-step "is prod = main + #X + #Y" investigation we
 * burned through repeatedly today.
 *
 * The orchestrator counterpart is queried via the internal /internal/manifest
 * route added in this PR (no auth needed; service-key gated).
 */

import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/middleware';
import { log } from '@/lib/logger';

interface ServiceManifest {
  service: 'web' | 'orchestrator';
  commit: string | null;
  branch: string | null;
  deployedAt: string;
  uptime_seconds: number;
  env: {
    nodeEnv: string | null;
    presence: Record<string, boolean>;
  };
  error?: string;
}

interface ManifestResponse {
  web: ServiceManifest;
  orchestrator: ServiceManifest | { error: string };
  drift: {
    commitMismatch: boolean;
    detail: string | null;
  };
  generatedAt: string;
}

// Process start time for uptime calculation
const PROCESS_STARTED_AT = Date.now();

// Env vars whose presence (not value) we report. Add to this list as new
// integrations come online so the manifest stays a comprehensive checklist.
const ENV_PRESENCE_KEYS = [
  'DATABASE_URL',
  'REDIS_URL',
  'CLERK_SECRET_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'ELEVENLABS_API_KEY',
  'GROQ_API_KEY',
  'OPENROUTER_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_S3_BUCKET',
  'SENTRY_DSN',
  'ORCHESTRATOR_URL',
  'SERVICE_SECRET_KEY',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
] as const;

function presenceMap(): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const k of ENV_PRESENCE_KEYS) {
    map[k] = !!process.env[k];
  }
  return map;
}

function localManifest(): ServiceManifest {
  return {
    service: 'web',
    commit: process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT ?? null,
    branch: process.env.RENDER_GIT_BRANCH ?? null,
    deployedAt: new Date(PROCESS_STARTED_AT).toISOString(),
    uptime_seconds: Math.round((Date.now() - PROCESS_STARTED_AT) / 1000),
    env: {
      nodeEnv: process.env.NODE_ENV ?? null,
      presence: presenceMap(),
    },
  };
}

async function fetchOrchestratorManifest(): Promise<ServiceManifest | { error: string }> {
  const orchUrl = process.env.ORCHESTRATOR_URL;
  if (!orchUrl) return { error: 'ORCHESTRATOR_URL not configured' };

  const serviceKey = process.env.SERVICE_SECRET_KEY;
  try {
    const res = await fetch(`${orchUrl.replace(/\/+$/, '')}/internal/manifest`, {
      method: 'GET',
      headers: serviceKey ? { 'X-Service-Key': serviceKey } : {},
      // Manifest fetch should be quick; if the orchestrator is slow we still
      // want to return the web manifest rather than time out the whole probe.
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      return { error: `orchestrator manifest HTTP ${res.status}` };
    }
    return (await res.json()) as ServiceManifest;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export const GET = withAdminAuth(async () => {
  const web = localManifest();
  const orchestrator = await fetchOrchestratorManifest();

  const orchCommit = 'commit' in orchestrator ? orchestrator.commit : null;
  const commitMismatch =
    !!web.commit && !!orchCommit && web.commit !== orchCommit;
  const drift = {
    commitMismatch,
    detail: commitMismatch ? `web=${web.commit?.slice(0, 8)} orch=${orchCommit?.slice(0, 8)}` : null,
  };

  const response: ManifestResponse = {
    web,
    orchestrator,
    drift,
    generatedAt: new Date().toISOString(),
  };

  if (drift.commitMismatch) {
    log.warn('[manifest] commit drift between services', drift);
  }

  return NextResponse.json(response);
}, { rateLimit: 'loose' });
