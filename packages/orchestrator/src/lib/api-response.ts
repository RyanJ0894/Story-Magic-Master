/**
 * Standardized API error/success response helpers for orchestrator routes.
 */

import { Response } from 'express';

export interface ApiErrorResponse {
  status: 'error';
  code: string;
  message: string;
  project_id?: string;
}

export interface ApiSuccessResponse<T = unknown> {
  status: 'success';
  [key: string]: T | string;
}

/**
 * Send a standardized error response.
 * In production, strips internal error details to prevent information leakage.
 */
export function sendError(
  res: Response,
  statusCode: number,
  opts: {
    code: string;
    message: string;
    projectId?: string;
    internalMessage?: string;
  }
): void {
  const isProduction = process.env.NODE_ENV === 'production';

  const body: ApiErrorResponse = {
    status: 'error',
    code: opts.code,
    message: isProduction ? opts.message : (opts.internalMessage || opts.message),
    ...(opts.projectId && { project_id: opts.projectId }),
  };

  res.status(statusCode).json(body);
}

/**
 * Wrap a caught error into a standardized 500 response.
 * In production, replaces the actual error message with a generic one.
 */
export function sendInternalError(
  res: Response,
  error: unknown,
  opts: { projectId?: string } = {}
): void {
  const message = error instanceof Error ? error.message : 'Unknown error';

  sendError(res, 500, {
    code: 'INTERNAL_ERROR',
    message: 'An internal error occurred. Please try again later.',
    projectId: opts.projectId,
    internalMessage: message,
  });
}
