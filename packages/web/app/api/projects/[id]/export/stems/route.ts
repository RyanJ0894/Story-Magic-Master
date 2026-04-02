/**
 * Stem Export API Routes
 *
 * GET /api/projects/[id]/export/stems        — list available stems
 * GET /api/projects/[id]/export/stems?zip=1  — stream tar.gz archive of all stems
 */

import { NextResponse } from 'next/server';
import { withProjectAuth } from '@/lib/api/middleware';
import { orchestratorFetch } from '@/lib/orchestrator-fetch';
import { log } from '@/lib/logger';

export const GET = withProjectAuth(
  async (request, { projectId }) => {
    const { searchParams } = new URL(request.url);
    const zip = searchParams.get('zip') === '1';

    const orchPath = zip
      ? `/stems/${projectId}/zip`
      : `/stems/${projectId}`;

    try {
      const { response } = await orchestratorFetch(orchPath, {
        method: 'GET',
        timeoutMs: zip ? 120_000 : 10_000,
        retries: zip ? 0 : 1,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Unknown error' }));
        return NextResponse.json(body, { status: response.status });
      }

      if (zip) {
        // Stream binary response with tar.gz headers
        const contentDisposition = response.headers.get('Content-Disposition') ??
          `attachment; filename="stems-${projectId.slice(0, 8)}.tar.gz"`;

        return new NextResponse(response.body, {
          headers: {
            'Content-Type': 'application/gzip',
            'Content-Disposition': contentDisposition,
          },
        });
      }

      // JSON stems list
      const data = await response.json();
      return NextResponse.json(data);
    } catch (error) {
      log.error('[Stems] Orchestrator fetch failed', error, { projectId, zip });
      return NextResponse.json(
        { error: 'Failed to reach audio service', code: 'ORCHESTRATOR_UNREACHABLE' },
        { status: 502 }
      );
    }
  },
  { rateLimit: 'normal' }
);
