/**
 * Shared constants for Story Magic
 */

// =============================================================================
// Job & Project Status
// =============================================================================
export const JOB_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export const PROJECT_STATUS = {
  DRAFT: 'draft',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type ProjectStatus = (typeof PROJECT_STATUS)[keyof typeof PROJECT_STATUS];

// =============================================================================
// Subscription Tiers
// =============================================================================
export const SUBSCRIPTION_TIER = {
  FREE: 'free',
  CREATOR: 'creator',
  PRO: 'pro',
  STUDIO: 'studio',
} as const;

export type SubscriptionTier = (typeof SUBSCRIPTION_TIER)[keyof typeof SUBSCRIPTION_TIER];

// Page limits per tier
export const TIER_PAGE_LIMITS: Record<SubscriptionTier, number> = {
  [SUBSCRIPTION_TIER.FREE]: 3,
  [SUBSCRIPTION_TIER.CREATOR]: 50,
  [SUBSCRIPTION_TIER.PRO]: 200,
  [SUBSCRIPTION_TIER.STUDIO]: 1000,
};

// =============================================================================
// Generation Limits
// =============================================================================
export const GENERATION_LIMITS = {
  MAX_SCRIPT_LENGTH: 500000, // 500KB max script size
  MAX_PAGE_COUNT: 150, // Max pages per generation
  MIN_SCRIPT_LENGTH: 50, // Minimum script length
} as const;

// =============================================================================
// Error Codes
// =============================================================================
export const ERROR_CODES = {
  // Authentication
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  CSRF_ERROR: 'CSRF_ERROR',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_JSON: 'INVALID_JSON',
  INVALID_SCRIPT: 'INVALID_SCRIPT',
  SCRIPT_TOO_LONG: 'SCRIPT_TOO_LONG',

  // Resources
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',

  // Limits
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  PREVIEW_BUDGET_EXCEEDED: 'PREVIEW_BUDGET_EXCEEDED',

  // System
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
