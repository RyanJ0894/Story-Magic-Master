import { NextResponse } from 'next/server';
import { withAuth, errorResponse } from '@/lib/api/middleware';
import { orchestratorFetch } from '@/lib/orchestrator-fetch';

/**
 * GET /api/audio-preview/music/m_string_orchestra_uplifting_01.mp3
 *
 * Proxies audio file requests to the orchestrator's static file server
 * so the frontend can play preview clips without exposing the orchestrator URL.
 */
export const GET = withAuth(async (_request, { params }) => {
  const filePath = (params.path as unknown as string[]).join('/');

  // Basic path traversal prevention
  if (filePath.includes('..') || filePath.includes('//')) {
    return errorResponse('Invalid path', 400, { code: 'INVALID_PATH' });
  }

  // Only allow audio file extensions
  if (!filePath.match(/\.(mp3|wav|m4a|ogg|flac)$/i)) {
    return errorResponse('Invalid file type', 400, { code: 'INVALID_FILE_TYPE' });
  }

  try {
    const { response } = await orchestratorFetch(`/audio-preview/${filePath}`, {
      timeoutMs: 15_000,
      retries: 1,
    });

    if (!response.ok) {
      return errorResponse('Audio file not found', response.status, { code: 'NOT_FOUND' });
    }

    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    const body = response.body;

    if (!body) {
      return errorResponse('Empty response', 502, { code: 'EMPTY_RESPONSE' });
    }

    return new NextResponse(body as ReadableStream, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return errorResponse('Failed to fetch audio from orchestrator', 502);
  }
});
