import { NextResponse } from 'next/server';
import { openApiSpec } from '@/lib/api/openapi';

/**
 * GET /api/docs
 * Returns the OpenAPI specification for the Story Magic API
 */
export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
