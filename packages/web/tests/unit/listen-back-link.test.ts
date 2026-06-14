import { describe, it, expect } from 'vitest';
import { getListenBackLink } from '@/components/player/listen-back-link';

describe('getListenBackLink (issue #206)', () => {
  const projectId = 'pjt-test-uuid';

  it('owner → /projects/[id] with label "Project"', () => {
    expect(getListenBackLink({ projectId, isOwner: true, teamId: null })).toEqual({
      href: `/projects/${projectId}`,
      label: 'Project',
    });
  });

  it('team member → /projects/[id] with label "Project" (was the dead-end fix)', () => {
    expect(getListenBackLink({ projectId, isOwner: false, teamId: 'team-abc' })).toEqual({
      href: `/projects/${projectId}`,
      label: 'Project',
    });
  });

  it('script-share recipient (no team) → /reader/dashboard with label "Library"', () => {
    expect(getListenBackLink({ projectId, isOwner: false, teamId: null })).toEqual({
      href: '/reader/dashboard',
      label: 'Library',
    });
  });

  it('owner who is also on a team → still goes to project (no ambiguity)', () => {
    // Reality check that the OR short-circuits cleanly when both flags are set.
    expect(getListenBackLink({ projectId, isOwner: true, teamId: 'team-abc' }).href).toBe(
      `/projects/${projectId}`,
    );
  });
});
