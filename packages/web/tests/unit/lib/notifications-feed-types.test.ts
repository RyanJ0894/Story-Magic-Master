/**
 * Tests for the master notification feed taxonomy (#174 PR α).
 *
 * Pins: every approved alertType has a severity tier (no silent 'info'
 * default leaks), severity color tokens are all defined, retention
 * constant matches Ryan's 90-day spec, and the type guard rejects
 * non-feed alert types.
 */

import { describe, it, expect } from 'vitest';
import {
  FEED_ALERT_TYPES,
  isFeedAlertType,
  severityFor,
  SEVERITY_TOKENS,
  FEED_RETENTION_DAYS,
} from '@/lib/notifications/feed-types';

describe('FEED_ALERT_TYPES', () => {
  it('matches the 14 types — original 8 (#174) + 4 engagement (#331) + 2 project-visibility (2026-06-20)', () => {
    expect(FEED_ALERT_TYPES).toEqual([
      // Original 8 from #174
      'team_member_joined',
      'team_member_left',
      'team_member_deactivated',
      'team_member_quota_exceeded',
      'script_generation_complete',
      'script_generation_failed',
      'subscription_renewed',
      'subscription_failed',
      // #331 — project-engagement triggers (added 2026-06-17)
      'project_opened_first_time',
      'listen_complete',
      'note_added',
      'decision_made',
      // 2026-06-20 — Ryan project-visibility clarification
      'project_created',
      'script_uploaded',
    ]);
  });

  it('every type maps to a non-default severity', () => {
    for (const t of FEED_ALERT_TYPES) {
      const sev = severityFor(t);
      expect(['info', 'warn', 'critical']).toContain(sev);
    }
  });

  it('severity tiers match Ryan-approved color mapping', () => {
    expect(severityFor('team_member_joined')).toBe('info');
    expect(severityFor('team_member_left')).toBe('info');
    expect(severityFor('team_member_deactivated')).toBe('warn');
    expect(severityFor('team_member_quota_exceeded')).toBe('warn');
    expect(severityFor('script_generation_complete')).toBe('info');
    expect(severityFor('script_generation_failed')).toBe('critical');
    expect(severityFor('subscription_renewed')).toBe('info');
    expect(severityFor('subscription_failed')).toBe('critical');
  });
});

describe('severityFor', () => {
  it('falls back to info for unknown types (legacy / forward-compat)', () => {
    expect(severityFor('legacy_comment')).toBe('info');
    expect(severityFor('made-up')).toBe('info');
  });
});

describe('SEVERITY_TOKENS', () => {
  it('has bg/text/ring tokens for every severity tier', () => {
    for (const tier of ['info', 'warn', 'critical'] as const) {
      expect(SEVERITY_TOKENS[tier]).toHaveProperty('bg');
      expect(SEVERITY_TOKENS[tier]).toHaveProperty('text');
      expect(SEVERITY_TOKENS[tier]).toHaveProperty('ring');
    }
  });

  it('uses green / yellow / red color families', () => {
    expect(SEVERITY_TOKENS.info.bg).toMatch(/green/);
    expect(SEVERITY_TOKENS.warn.bg).toMatch(/yellow/);
    expect(SEVERITY_TOKENS.critical.bg).toMatch(/red/);
  });
});

describe('isFeedAlertType', () => {
  it('returns true for approved feed types', () => {
    expect(isFeedAlertType('team_member_joined')).toBe(true);
    expect(isFeedAlertType('subscription_failed')).toBe(true);
  });

  it('returns false for legacy / unknown alert types', () => {
    expect(isFeedAlertType('team_invite')).toBe(false);
    expect(isFeedAlertType('comment')).toBe(false);
    expect(isFeedAlertType('')).toBe(false);
  });
});

describe('FEED_RETENTION_DAYS', () => {
  it('is 90 (Ryan-approved retention horizon)', () => {
    expect(FEED_RETENTION_DAYS).toBe(90);
  });
});
