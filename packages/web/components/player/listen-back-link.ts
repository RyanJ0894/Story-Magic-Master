/**
 * Issue #206 — Listen flow back-link target.
 *
 * The Listen page was a dead-end for team members: it sent them back to
 * /reader/dashboard which is its own island (no nav to the main dashboard
 * or the team page they came from). This helper centralizes the
 * destination + label decision so it stays consistent across the header
 * and any future entry-point (e.g. a mobile back affordance).
 *
 * Rules:
 *   - Owner OR team-member → /projects/[id]
 *     (the project page accepts both via its teamShares OR-clause)
 *   - Script-share recipient with no team → /reader/dashboard
 *     (their only landing — they don't have a team context)
 *
 * The label matches the destination so the breadcrumb is honest about
 * where the click actually lands.
 */
export interface BackLinkInput {
  projectId: string;
  isOwner: boolean;
  teamId: string | null;
}

export interface BackLinkTarget {
  href: string;
  label: 'Project' | 'Library';
}

export function getListenBackLink({ projectId, isOwner, teamId }: BackLinkInput): BackLinkTarget {
  if (isOwner || teamId) {
    return { href: `/projects/${projectId}`, label: 'Project' };
  }
  return { href: '/reader/dashboard', label: 'Library' };
}
