/**
 * Standardized API error response helper.
 *
 * Produces a consistent shape across all API routes:
 *   { error: string, code?: string, details?: unknown }
 *
 * @param message  Human-readable error message
 * @param status   HTTP status code
 * @param opts     Optional `code` (machine-readable) and `details` (validation errors, etc.)
 */

import { NextResponse } from 'next/server';

export interface ErrorResponseOptions {
  code?: string;
  details?: unknown;
}

export function errorResponse(
  message: string,
  status: number,
  opts?: ErrorResponseOptions,
) {
  const body: Record<string, unknown> = { error: message };
  if (opts?.code) body.code = opts.code;
  if (opts?.details !== undefined) body.details = opts.details;
  return NextResponse.json(body, { status });
}
