import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  latencyMs?: number;
  error?: string;
  details?: Record<string, unknown>;
}

interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  uptime: number;
  checks: HealthCheck[];
}

const startTime = Date.now();

/**
 * Check database connectivity via Prisma
 */
async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;

    const latency = Date.now() - start;
    return {
      name: 'database',
      status: latency > 1000 ? 'degraded' : 'healthy',
      latencyMs: latency,
    };
  } catch (err) {
    return {
      name: 'database',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Check Clerk Auth service connectivity
 */
async function checkAuth(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!publishableKey || !secretKey) {
      return {
        name: 'auth',
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: 'Clerk keys not configured',
      };
    }

    const latency = Date.now() - start;
    return {
      name: 'auth',
      status: 'healthy',
      latencyMs: latency,
      details: { provider: 'clerk' },
    };
  } catch (err) {
    return {
      name: 'auth',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Check ElevenLabs API connectivity (used for TTS)
 */
async function checkElevenLabs(): Promise<HealthCheck> {
  const start = Date.now();
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return {
      name: 'elevenlabs',
      status: 'unhealthy',
      error: 'ELEVENLABS_API_KEY not configured',
    };
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/user', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
      },
      signal: AbortSignal.timeout(5000),
    });

    const latency = Date.now() - start;

    if (!response.ok) {
      return {
        name: 'elevenlabs',
        status: response.status === 401 ? 'unhealthy' : 'degraded',
        latencyMs: latency,
        error: `HTTP ${response.status}`,
      };
    }

    return {
      name: 'elevenlabs',
      status: latency > 2000 ? 'degraded' : 'healthy',
      latencyMs: latency,
    };
  } catch (err) {
    return {
      name: 'elevenlabs',
      status: 'degraded', // Don't fail health completely if ElevenLabs is slow
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Check OpenAI API connectivity (used for LLM)
 */
async function checkOpenAI(): Promise<HealthCheck> {
  const start = Date.now();
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      name: 'openai',
      status: 'unhealthy',
      error: 'OPENAI_API_KEY not configured',
    };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    const latency = Date.now() - start;

    if (!response.ok) {
      return {
        name: 'openai',
        status: response.status === 401 ? 'unhealthy' : 'degraded',
        latencyMs: latency,
        error: `HTTP ${response.status}`,
      };
    }

    return {
      name: 'openai',
      status: latency > 2000 ? 'degraded' : 'healthy',
      latencyMs: latency,
    };
  } catch (err) {
    return {
      name: 'openai',
      status: 'degraded',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Check Orchestrator service connectivity
 */
async function checkOrchestrator(): Promise<HealthCheck> {
  const start = Date.now();
  const orchestratorUrl = process.env.ORCHESTRATOR_URL;

  if (!orchestratorUrl) {
    return {
      name: 'orchestrator',
      status: 'degraded',
      error: 'ORCHESTRATOR_URL not configured (may be running in-process)',
    };
  }

  try {
    const response = await fetch(`${orchestratorUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    const latency = Date.now() - start;

    if (!response.ok) {
      return {
        name: 'orchestrator',
        status: 'unhealthy',
        latencyMs: latency,
        error: `HTTP ${response.status}`,
      };
    }

    return {
      name: 'orchestrator',
      status: latency > 1000 ? 'degraded' : 'healthy',
      latencyMs: latency,
    };
  } catch (err) {
    return {
      name: 'orchestrator',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Check storage availability
 * (Storage is now handled externally; this is a placeholder check)
 */
async function checkStorage(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // With Prisma migration, storage is handled by the orchestrator or external service.
    // Return healthy if the storage env var is configured.
    const hasStorageConfig = !!process.env.AUDIO_OUTPUT_DIR || !!process.env.STORAGE_BUCKET_URL;
    const latency = Date.now() - start;
    return {
      name: 'storage',
      status: hasStorageConfig ? 'healthy' : 'degraded',
      latencyMs: latency,
      ...(!hasStorageConfig && { error: 'No storage configuration found (AUDIO_OUTPUT_DIR or STORAGE_BUCKET_URL)' }),
    };
  } catch (err) {
    return {
      name: 'storage',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function GET() {
  const checks: HealthCheck[] = [];

  // Run critical checks in parallel
  const [dbCheck, authCheck, storageCheck] = await Promise.all([
    checkDatabase(),
    checkAuth(),
    checkStorage(),
  ]);

  checks.push(dbCheck, authCheck, storageCheck);

  // Run external service checks (non-blocking for overall health)
  const [elevenLabsCheck, openAICheck, orchestratorCheck] = await Promise.all([
    checkElevenLabs(),
    checkOpenAI(),
    checkOrchestrator(),
  ]);

  checks.push(elevenLabsCheck, openAICheck, orchestratorCheck);

  // Determine overall status
  const hasUnhealthy = checks.some(c => c.status === 'unhealthy');
  const hasDegraded = checks.some(c => c.status === 'degraded');

  // Critical services that must be healthy
  const criticalServices = ['database', 'auth'];
  const criticalUnhealthy = checks
    .filter(c => criticalServices.includes(c.name))
    .some(c => c.status === 'unhealthy');

  let overallStatus: HealthResponse['status'];
  if (criticalUnhealthy) {
    overallStatus = 'unhealthy';
  } else if (hasUnhealthy || hasDegraded) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'healthy';
  }

  const response: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  };

  // Return appropriate status code
  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

  return NextResponse.json(response, { status: statusCode });
}

// Also support HEAD for load balancer health checks
export async function HEAD() {
  // Quick check - just verify database is reachable
  const dbCheck = await checkDatabase();

  return new NextResponse(null, {
    status: dbCheck.status === 'healthy' ? 200 : 503,
  });
}
