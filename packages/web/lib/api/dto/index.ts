/**
 * Data Transfer Objects (DTOs) for API layer
 *
 * These types define the shape of data at API boundaries,
 * separate from database models and UI view models.
 */

import { z } from 'zod';

// =============================================================================
// Common Schemas
// =============================================================================

export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const SortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const DateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// =============================================================================
// Share DTOs
// =============================================================================

export const AccessLevelSchema = z.enum(['stream', 'download']);
export type AccessLevel = z.infer<typeof AccessLevelSchema>;

export const CreateShareRequestSchema = z.object({
  project_id: z.string().uuid(),
  access_level: AccessLevelSchema.default('stream'),
  expires_at: z.string().datetime().optional(),
  recipient_email: z.string().email().optional(),
  recipient_name: z.string().max(100).optional(),
  max_plays: z.number().int().positive().optional(),
  password: z.string().min(4).max(50).optional(),
});

export type CreateShareRequest = z.infer<typeof CreateShareRequestSchema>;

export const UpdateShareRequestSchema = z.object({
  access_level: AccessLevelSchema.optional(),
  expires_at: z.string().datetime().nullable().optional(),
  is_active: z.boolean().optional(),
  recipient_email: z.string().email().nullable().optional(),
  recipient_name: z.string().max(100).nullable().optional(),
  max_plays: z.number().int().positive().nullable().optional(),
  password: z.string().min(4).max(50).nullable().optional(),
});

export type UpdateShareRequest = z.infer<typeof UpdateShareRequestSchema>;

export const ShareResponseSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  shared_by: z.string().uuid(),
  share_code: z.string(),
  access_level: AccessLevelSchema,
  expires_at: z.string().datetime().nullable(),
  recipient_email: z.string().email().nullable(),
  recipient_name: z.string().nullable(),
  max_plays: z.number().int().nullable(),
  view_count: z.number().int(),
  play_count: z.number().int(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  project: z.object({
    id: z.string().uuid(),
    name: z.string(),
    page_count: z.number().int(),
  }).optional(),
});

export type ShareResponse = z.infer<typeof ShareResponseSchema>;

export const ShareAccessResponseSchema = z.object({
  share: z.object({
    id: z.string(),
    accessLevel: AccessLevelSchema,
    expiresAt: z.string().datetime().nullable(),
  }),
  project: z.object({
    id: z.string(),
    name: z.string(),
    pageCount: z.number().int(),
  }),
  writer: z.object({
    name: z.string(),
    code: z.string(),
  }),
  audio: z.object({
    url: z.string().url(),
    duration: z.number(),
    manifest: z.record(z.unknown()).optional(),
  }).nullable(),
  canDownload: z.boolean(),
  requiresPassword: z.boolean().optional(),
});

export type ShareAccessResponse = z.infer<typeof ShareAccessResponseSchema>;

// =============================================================================
// Library DTOs
// =============================================================================

export const LibrarySourceSchema = z.enum(['received', 'uploaded', 'purchased']);
export type LibrarySource = z.infer<typeof LibrarySourceSchema>;

export const LibraryStatusSchema = z.enum(['active', 'archived', 'removed']);
export type LibraryStatus = z.infer<typeof LibraryStatusSchema>;

export const GetLibraryQuerySchema = z.object({
  source: LibrarySourceSchema.optional(),
  status: LibraryStatusSchema.optional(),
  favorited: z.coerce.boolean().optional(),
}).merge(PaginationSchema).merge(SortSchema);

export type GetLibraryQuery = z.infer<typeof GetLibraryQuerySchema>;

export const UpdateLibraryEntryRequestSchema = z.object({
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  play_position_seconds: z.number().int().min(0).optional(),
  completed: z.boolean().optional(),
});

export type UpdateLibraryEntryRequest = z.infer<typeof UpdateLibraryEntryRequestSchema>;

export const UpdatePositionRequestSchema = z.object({
  position: z.number().min(0),
  duration: z.number().min(0).optional(),
  completed: z.boolean().optional(),
});

export type UpdatePositionRequest = z.infer<typeof UpdatePositionRequestSchema>;

export const LibraryEntryResponseSchema = z.object({
  id: z.string().uuid(),
  reader_id: z.string().uuid(),
  project_id: z.string().uuid(),
  source: LibrarySourceSchema,
  share_id: z.string().uuid().nullable(),
  status: LibraryStatusSchema,
  is_favorited: z.boolean(),
  notes: z.string().nullable(),
  tags: z.array(z.string()),
  last_played_at: z.string().datetime().nullable(),
  play_position_seconds: z.number().int(),
  completed: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type LibraryEntryResponse = z.infer<typeof LibraryEntryResponseSchema>;

export const LibraryEntryDetailedResponseSchema = LibraryEntryResponseSchema.extend({
  script_name: z.string(),
  page_count: z.number().int(),
  writer_name: z.string(),
  writer_code: z.string(),
  writer_subscribed: z.boolean(),
  duration_seconds: z.number(),
});

export type LibraryEntryDetailedResponse = z.infer<typeof LibraryEntryDetailedResponseSchema>;

// =============================================================================
// Upload DTOs
// =============================================================================

export const CreateUploadPaymentRequestSchema = z.object({
  price: z.number().refine(val => val === 5 || val === 8, {
    message: 'Price must be $5 (standard) or $8 (OCR)',
  }),
  needsOCR: z.boolean(),
});

export type CreateUploadPaymentRequest = z.infer<typeof CreateUploadPaymentRequestSchema>;

export const CreateUploadPaymentResponseSchema = z.object({
  clientSecret: z.string(),
  paymentIntentId: z.string(),
});

export type CreateUploadPaymentResponse = z.infer<typeof CreateUploadPaymentResponseSchema>;

export const ProcessUploadResponseSchema = z.object({
  projectId: z.string(),
  jobId: z.string(),
  status: z.enum(['processing', 'queued']),
});

export type ProcessUploadResponse = z.infer<typeof ProcessUploadResponseSchema>;

// =============================================================================
// Admin DTOs
// =============================================================================

export const AdminUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string().nullable(),
  user_type: z.enum(['writer', 'reader', 'admin']),
  writer_code: z.string().nullable(),
  reader_code: z.string().nullable(),
  created_at: z.string().datetime(),
  subscription_status: z.enum(['active', 'trialing', 'canceled', 'none']),
  projects_count: z.number().int(),
  shares_count: z.number().int(),
});

export type AdminUser = z.infer<typeof AdminUserSchema>;

export const AdminStatsSchema = z.object({
  total_users: z.number().int(),
  total_writers: z.number().int(),
  total_readers: z.number().int(),
  active_subscriptions: z.number().int(),
  total_projects: z.number().int(),
  total_shares: z.number().int(),
  mrr_cents: z.number().int(),
  new_users_today: z.number().int(),
  new_users_week: z.number().int(),
  new_users_month: z.number().int(),
});

export type AdminStats = z.infer<typeof AdminStatsSchema>;

export const AdminAuditLogSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  action: z.string(),
  resource_type: z.string(),
  resource_id: z.string().nullable(),
  details: z.record(z.unknown()),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
  created_at: z.string().datetime(),
});

export type AdminAuditLog = z.infer<typeof AdminAuditLogSchema>;
