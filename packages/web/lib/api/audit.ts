/**
 * Audit Logging Utility
 *
 * Provides functions to log user actions for audit trail purposes.
 * Uses Prisma client for database operations.
 */

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
  } catch (err) {
    // Silently fail - don't break the main flow for audit logging failures
    console.error('Audit logging error:', err);
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
  PROJECT_UPDATE: 'project.update',
  PROJECT_DELETE: 'project.delete',
  PROJECT_GENERATE: 'project.generate',

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
} as const;

export type ResourceType = (typeof ResourceTypes)[keyof typeof ResourceTypes];
