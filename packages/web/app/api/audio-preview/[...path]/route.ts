import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';

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
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  // Only allow audio file extensions
  if (!filePath.match(/\.(mp3|wav|m4a|ogg|flac)$/i)) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
  }

  const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:22002';
  const audioUrl = `${orchestratorUrl}/audio-preview/${filePath}`;

  try {
    const response = await fetch(audioUrl);

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Audio file not found' },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    const body = response.body;

    if (!body) {
      return NextResponse.json({ error: 'Empty response' }, { status: 502 });
    }

    return new NextResponse(body as ReadableStream, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch audio from orchestrator' },
      { status: 502 }
    );
  }
});
