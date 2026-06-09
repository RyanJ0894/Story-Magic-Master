/**
 * Master-account notification feed types (#174).
 *
 * The Alert table holds every kind of in-app alert. The master-account
 * notification feed is a SUBSET — only the events that an enterprise
 * master needs to see about their sub-accounts and their subscription.
 *
 * Scope confirmed with Ryan 2026-06-09 (email reply):
 *   - sub-account joined (invite accepted)
 *   - sub-account left or was deactivated
 *   - sub-account exceeded usage quota
 *   - script generation completed
 *   - script generation failed
 *   - subscription renewed / billing event
 *   (skip "master approval requested" until a concrete use case exists)
 *
 * Severity tiers (Ryan-approved color palette):
 *   - info     (green)  — informational, no action
 *   - warn     (yellow) — needs attention soon
 *   - critical (red)    — needs action now
 */

export const FEED_ALERT_TYPES = [
  'team_member_joined',          // sub-account joined
  'team_member_left',            // sub-account left
  'team_member_deactivated',     // sub-account deactivated by master
  'team_member_quota_exceeded',  // sub-account hit a usage cap
  'script_generation_complete',  // a sub-account's script finished
  'script_generation_failed',    // a sub-account's script failed
  'subscription_renewed',        // billing event — renewal succeeded
  'subscription_failed',         // billing event — renewal failed
] as const;

export type FeedAlertType = (typeof FEED_ALERT_TYPES)[number];

export type Severity = 'info' | 'warn' | 'critical';

/**
 * Maps each feed alertType to the severity tier that Ryan approved for
 * the color-coded UI. Add new types here when expanding the feed.
 */
const SEVERITY_BY_TYPE: Record<FeedAlertType, Severity> = {
  team_member_joined: 'info',
  team_member_left: 'info',
  team_member_deactivated: 'warn',
  team_member_quota_exceeded: 'warn',
  script_generation_complete: 'info',
  script_generation_failed: 'critical',
  subscription_renewed: 'info',
  subscription_failed: 'critical',
};

export function severityFor(alertType: string): Severity {
  return SEVERITY_BY_TYPE[alertType as FeedAlertType] ?? 'info';
}

/**
 * Tailwind color tokens the frontend uses for each severity tier.
 * Kept here so backend and frontend stay aligned without a hardcoded
 * style on the client.
 */
export const SEVERITY_TOKENS: Record<Severity, { bg: string; text: string; ring: string }> = {
  info: { bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-200' },
  warn: { bg: 'bg-yellow-50', text: 'text-yellow-700', ring: 'ring-yellow-200' },
  critical: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200' },
};

/**
 * Retention horizon agreed with Ryan: 90 days. The orchestrator's nightly
 * cleanup cron (separate PR) will use this constant to delete older rows.
 */
export const FEED_RETENTION_DAYS = 90;

/**
 * Type guard so producers + queries agree on what "feed-worthy" means.
 */
export function isFeedAlertType(t: string): t is FeedAlertType {
  return (FEED_ALERT_TYPES as readonly string[]).includes(t);
}
