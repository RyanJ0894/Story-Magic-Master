/**
 * Tests for NotificationItem (#174 PR γ).
 *
 * Pure component test — verifies severity color application, read/unread
 * styling, related-user attribution, and link destination derivation.
 * Doesn't exercise the fetch/polling layer; that's covered by the
 * dropdown tests + manual smoke.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  NotificationItem,
  type FeedNotification,
} from '@/components/notifications/NotificationItem';

function makeNotification(overrides: Partial<FeedNotification> = {}): FeedNotification {
  return {
    id: 'n1',
    alert_type: 'team_member_joined',
    severity: 'info',
    title: 'Alex joined Acme',
    message: 'Welcome to the team',
    project_id: null,
    team_id: 'team-1',
    related_user_id: 'user-1',
    metadata: {},
    is_read: false,
    created_at: new Date().toISOString(),
    project: null,
    team: { id: 'team-1', name: 'Acme' },
    related_user: { full_name: 'Alex Doe', avatar_url: null },
    ...overrides,
  };
}

describe('NotificationItem', () => {
  it('renders the title and message in non-compact mode', () => {
    render(<NotificationItem notification={makeNotification()} />);
    expect(screen.getByText('Alex joined Acme')).toBeInTheDocument();
    expect(screen.getByText('Welcome to the team')).toBeInTheDocument();
  });

  it('omits the message in compact mode', () => {
    render(<NotificationItem notification={makeNotification()} compact />);
    expect(screen.getByText('Alex joined Acme')).toBeInTheDocument();
    expect(screen.queryByText('Welcome to the team')).not.toBeInTheDocument();
  });

  it('shows "From <name>" when related_user is present', () => {
    render(<NotificationItem notification={makeNotification()} />);
    expect(screen.getByText(/From Alex Doe/)).toBeInTheDocument();
  });

  it('applies title weight based on is_read flag', () => {
    const { rerender } = render(
      <NotificationItem notification={makeNotification({ is_read: false })} />,
    );
    expect(screen.getByText('Alex joined Acme').className).toMatch(/font-semibold/);

    rerender(<NotificationItem notification={makeNotification({ is_read: true })} />);
    expect(screen.getByText('Alex joined Acme').className).toMatch(/font-normal/);
  });

  it('uses severity-specific aria-label', () => {
    render(
      <NotificationItem
        notification={makeNotification({
          severity: 'critical',
          title: 'Subscription failed',
        })}
      />,
    );
    expect(
      screen.getByLabelText(/critical notification: Subscription failed/),
    ).toBeInTheDocument();
  });

  it('links to project page when project_id is set', () => {
    render(
      <NotificationItem
        notification={makeNotification({ project_id: 'proj-9' })}
      />,
    );
    expect(screen.getByRole('link').getAttribute('href')).toBe('/projects/proj-9');
  });

  it('links to /enterprise/team when only team_id is set', () => {
    render(
      <NotificationItem
        notification={makeNotification({ project_id: null, team_id: 't-1' })}
      />,
    );
    expect(screen.getByRole('link').getAttribute('href')).toBe('/enterprise/team');
  });

  it('falls back to /dashboard/notifications when neither project nor team is set', () => {
    render(
      <NotificationItem
        notification={makeNotification({
          project_id: null,
          team_id: null,
          alert_type: 'subscription_renewed',
          severity: 'info',
        })}
      />,
    );
    expect(screen.getByRole('link').getAttribute('href')).toBe('/dashboard/notifications');
  });
});
