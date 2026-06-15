/**
 * Request Limits Validation
 *
 * Enforce size and content limits for API requests to prevent DoS attacks.
 */

import { fmtInt } from '@/lib/format';

// Size limits in bytes
export const LIMITS = {
  // Script text (plain text, ~500 chars per page, 120 pages max)
  SCRIPT_TEXT_MAX_BYTES: 1024 * 1024, // 1MB
  SCRIPT_TEXT_MAX_CHARS: 500_000, // ~500 chars/page * 1000 pages

  // PDF uploads
  PDF_MAX_BYTES: 10 * 1024 * 1024, // 10MB

  // JSON payloads (director_json, settings, etc.)
  JSON_PAYLOAD_MAX_BYTES: 5 * 1024 * 1024, // 5MB

  // Audio files (for any upload scenarios)
  AUDIO_MAX_BYTES: 100 * 1024 * 1024, // 100MB

  // Project name and description
  PROJECT_NAME_MAX_CHARS: 200,
  PROJECT_DESCRIPTION_MAX_CHARS: 2000,

  // Page count limits
  MIN_PAGE_COUNT: 1,
  MAX_PAGE_COUNT: 200, // ~3 hour audio

  // Rate limits (requests per minute)
  GENERATION_RATE_LIMIT: 5,
  API_RATE_LIMIT: 60,
} as const;

export interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Validate script text size and content
 */
export function validateScriptText(text: string | null | undefined): ValidationResult {
  if (!text) {
    return { valid: false, error: 'Script text is required' };
  }

  const byteSize = new Blob([text]).size;

  if (byteSize > LIMITS.SCRIPT_TEXT_MAX_BYTES) {
    return {
      valid: false,
      error: `Script text exceeds maximum size of ${LIMITS.SCRIPT_TEXT_MAX_BYTES / 1024 / 1024}MB`,
      details: { byteSize, maxBytes: LIMITS.SCRIPT_TEXT_MAX_BYTES },
    };
  }

  if (text.length > LIMITS.SCRIPT_TEXT_MAX_CHARS) {
    return {
      valid: false,
      error: `Script text exceeds maximum length of ${fmtInt(LIMITS.SCRIPT_TEXT_MAX_CHARS)} characters`,
      details: { charCount: text.length, maxChars: LIMITS.SCRIPT_TEXT_MAX_CHARS },
    };
  }

  // Check for suspicious patterns (potential injection)
  const suspiciousPatterns = [
    /<script[^>]*>/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick=, onerror=, etc.
    /data:text\/html/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(text)) {
      return {
        valid: false,
        error: 'Script text contains potentially unsafe content',
        details: { pattern: pattern.source },
      };
    }
  }

  return { valid: true };
}

/**
 * Validate PDF file
 */
export function validatePdfFile(file: File | Blob): ValidationResult {
  if (!file) {
    return { valid: false, error: 'PDF file is required' };
  }

  if (file.size > LIMITS.PDF_MAX_BYTES) {
    return {
      valid: false,
      error: `PDF file exceeds maximum size of ${LIMITS.PDF_MAX_BYTES / 1024 / 1024}MB`,
      details: { fileSize: file.size, maxBytes: LIMITS.PDF_MAX_BYTES },
    };
  }

  // Check file type if available
  if (file instanceof File && !file.type.includes('pdf')) {
    return {
      valid: false,
      error: 'File must be a PDF',
      details: { fileType: file.type },
    };
  }

  return { valid: true };
}

/**
 * Validate page count
 */
export function validatePageCount(pageCount: number): ValidationResult {
  if (!Number.isInteger(pageCount)) {
    return { valid: false, error: 'Page count must be an integer' };
  }

  if (pageCount < LIMITS.MIN_PAGE_COUNT) {
    return {
      valid: false,
      error: `Page count must be at least ${LIMITS.MIN_PAGE_COUNT}`,
      details: { pageCount, minPages: LIMITS.MIN_PAGE_COUNT },
    };
  }

  if (pageCount > LIMITS.MAX_PAGE_COUNT) {
    return {
      valid: false,
      error: `Page count exceeds maximum of ${LIMITS.MAX_PAGE_COUNT} pages`,
      details: { pageCount, maxPages: LIMITS.MAX_PAGE_COUNT },
    };
  }

  return { valid: true };
}

/**
 * Validate project name
 */
export function validateProjectName(name: string | null | undefined): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Project name is required' };
  }

  if (name.length > LIMITS.PROJECT_NAME_MAX_CHARS) {
    return {
      valid: false,
      error: `Project name exceeds maximum of ${LIMITS.PROJECT_NAME_MAX_CHARS} characters`,
      details: { length: name.length, maxLength: LIMITS.PROJECT_NAME_MAX_CHARS },
    };
  }

  return { valid: true };
}

/**
 * Validate JSON payload size
 */
export function validateJsonPayload(payload: unknown): ValidationResult {
  try {
    const jsonString = JSON.stringify(payload);
    const byteSize = new Blob([jsonString]).size;

    if (byteSize > LIMITS.JSON_PAYLOAD_MAX_BYTES) {
      return {
        valid: false,
        error: `JSON payload exceeds maximum size of ${LIMITS.JSON_PAYLOAD_MAX_BYTES / 1024 / 1024}MB`,
        details: { byteSize, maxBytes: LIMITS.JSON_PAYLOAD_MAX_BYTES },
      };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid JSON payload' };
  }
}

/**
 * Comprehensive request validation for generation endpoint
 */
export function validateGenerationRequest(params: {
  scriptText?: string;
  pageCount?: number;
  projectName?: string;
}): ValidationResult {
  const { scriptText, pageCount, projectName } = params;

  // Validate script text
  const scriptResult = validateScriptText(scriptText);
  if (!scriptResult.valid) return scriptResult;

  // Validate page count if provided
  if (pageCount !== undefined) {
    const pageResult = validatePageCount(pageCount);
    if (!pageResult.valid) return pageResult;
  }

  // Validate project name if provided
  if (projectName !== undefined) {
    const nameResult = validateProjectName(projectName);
    if (!nameResult.valid) return nameResult;
  }

  return { valid: true };
}
