/**
 * Audit Logging Utility
 *
 * Provides functions to log user actions for audit trail purposes.
 * Uses Prisma client for database operations.
 */

import { log } from '@/lib/logger';
import { prisma } from '@/lib/db';

export interface AuditLogEntry {
  user_id?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  details?: Record<string, unknown>;
  ip_address?: string | null;
  user_agent?: string | null;
}

/**
 * Log an audit event
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.user_id ?? null,
        action: entry.action,
        resourceType: entry.resource_type,
        resourceId: entry.resource_id ?? null,
        details: (entry.details || {}) as Record<string, string | number | boolean>,
        ipAddress: entry.ip_address ?? null,
        userAgent: entry.user_agent ?? null,
      },
    });
  } catch (error) {
    // Silently fail - don't break the main flow for audit logging failures
    log.error('Audit logging error', error);
  }
}

/**
 * Helper to extract IP and user agent from request headers
 */
export function extractRequestInfo(request: Request): {
  ip_address: string | null;
  user_agent: string | null;
} {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             request.headers.get('x-real-ip') ||
             null;

  const userAgent = request.headers.get('user-agent');

  return {
    ip_address: ip,
    user_agent: userAgent,
  };
}

// Pre-defined action types for consistency
export const AuditActions = {
  // User actions
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_SIGNUP: 'user.signup',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',
  USER_PASSWORD_CHANGE: 'user.password_change',

  // Project actions
  PROJECT_CREATE: 'project.create',
  PROJECT_READ: 'project.read',
  PROJECT_UPDATE: 'project.update',
  PROJECT_DELETE: 'project.delete',
  PROJECT_GENERATE: 'project.generate',

  // Audio actions
  AUDIO_DOWNLOAD: 'audio.download',
  AUDIO_STREAM: 'audio.stream',

  // Script actions
  SCRIPT_READ: 'script.read',

  // Share actions
  SHARE_CREATE: 'share.create',
  SHARE_ACCESS: 'share.access',
  SHARE_UPDATE: 'share.update',
  SHARE_DELETE: 'share.delete',

  // Subscription actions
  SUBSCRIPTION_CREATE: 'subscription.create',
  SUBSCRIPTION_UPDATE: 'subscription.update',
  SUBSCRIPTION_CANCEL: 'subscription.cancel',
  SUBSCRIPTION_RESUME: 'subscription.resume',

  // Admin actions
  ADMIN_USER_UPDATE: 'admin.user_update',
  ADMIN_USER_SUSPEND: 'admin.user_suspend',
  ADMIN_SUBSCRIPTION_MODIFY: 'admin.subscription_modify',
  ADMIN_SETTINGS_UPDATE: 'admin.settings_update',
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];

// Resource types
export const ResourceTypes = {
  USER: 'user',
  PROJECT: 'project',
  SHARE: 'share',
  SUBSCRIPTION: 'subscription',
  SETTINGS: 'settings',
  ADMIN: 'admin',
  AUDIO: 'audio',
  SCRIPT: 'script',
} as const;

export type ResourceType = (typeof ResourceTypes)[keyof typeof ResourceTypes];

// ---------------------------------------------------------------------------
// Convenience helpers (BL-015)
// ---------------------------------------------------------------------------

export interface ReadAccessOptions {
  userId: string;
  projectId: string;
  action?: string;
  details?: Record<string, unknown>;
  request?: Request;
}

/**
 * Log a read-access event on a sensitive resource (project details, audio, script text).
 * Fire-and-forget: never throws.
 */
export async function logReadAccess(opts: ReadAccessOptions): Promise<void> {
  const { userId, projectId, action = AuditActions.PROJECT_READ, details = {}, request } = opts;
  const reqInfo = request ? extractRequestInfo(request) : { ip_address: null, user_agent: null };
  await logAuditEvent({
    user_id: userId,
    action,
    resource_type: ResourceTypes.PROJECT,
    resource_id: projectId,
    details: { projectId, ...details },
    ...reqInfo,
  });
}

export interface DeletionOptions {
  userId: string;
  resourceType: string;
  resourceId: string;
  action?: string;
  details?: Record<string, unknown>;
  request?: Request;
}

/**
 * Log a deletion event (user delete, project delete).
 * Fire-and-forget: never throws.
 */
export async function logDeletion(opts: DeletionOptions): Promise<void> {
  const { userId, resourceType, resourceId, action, details = {}, request } = opts;
  const resolvedAction = action ?? `${resourceType}.delete`;
  const reqInfo = request ? extractRequestInfo(request) : { ip_address: null, user_agent: null };
  await logAuditEvent({
    user_id: userId,
    action: resolvedAction,
    resource_type: resourceType,
    resource_id: resourceId,
    details,
    ...reqInfo,
  });
}
