/**
 * Audit Logging Utility
 *
 * Provides functions to log user actions for audit trail purposes.
 * Uses the service role client to bypass RLS for logging.
 */

import { createClient } from '@supabase/supabase-js';

// Service role client for audit logging (bypasses RLS)
const getServiceClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('Audit logging: Missing Supabase credentials');
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
};

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
  const supabase = getServiceClient();
  if (!supabase) return;

  try {
    const { error } = await supabase.from('audit_logs').insert({
      user_id: entry.user_id,
      action: entry.action,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id,
      details: entry.details || {},
      ip_address: entry.ip_address,
      user_agent: entry.user_agent,
    });

    if (error) {
      // Silently fail - don't break the main flow for audit logging failures
      console.error('Failed to log audit event:', error.message);
    }
  } catch (err) {
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
