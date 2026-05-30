/**
 * Unit tests for enterprise dashboard own-projects visibility
 *
 * Regression coverage for:
 *   Bug #84: Projects created via regular /dashboard became invisible once the
 *            user accessed enterprise routes (dashboard only showed team-shared
 *            projects in team.teamShares; owner's own projects were not shown).
 *   Bug #86: Projects created via "Create New Project" on enterprise/dashboard
 *            linked to /projects/new, which creates a project but does NOT
 *            auto-share it with the team — so it vanished from enterprise view.
 *   Fix: enterprise/dashboard now loads owner's own projects separately and
 *        shows them in a "My Projects — Not Yet Shared" section with a
 *        ShareWithTeamButton.
 */

import { describe, it, expect } from 'vitest';

// ── Pure logic tests ───────────────────────────────────────────────────────────
// The enterprise dashboard server component uses:
//   const sharedProjectIds = new Set(team.teamShares.map(s => s.project.id));
//   const unsharedProjects = ownProjects.filter(p => !sharedProjectIds.has(p.id));
// We test this filter logic in isolation.

interface Project { id: string; name: string }

function computeUnsharedProjects(
  ownProjects: Project[],
  sharedProjectIds: Set<string>,
): Project[] {
  return ownProjects.filter((p) => !sharedProjectIds.has(p.id));
}

describe('enterprise dashboard — unshared project filtering', () => {
  it('returns all own projects when none are shared', () => {
    const own: Project[] = [
      { id: 'p1', name: 'Script A' },
      { id: 'p2', name: 'Script B' },
    ];
    const result = computeUnsharedProjects(own, new Set());
    expect(result).toHaveLength(2);
    expect(result.map(p => p.id)).toEqual(['p1', 'p2']);
  });

  it('filters out projects already shared with the team', () => {
    const own: Project[] = [
      { id: 'p1', name: 'Shared Script' },
      { id: 'p2', name: 'Private Script' },
      { id: 'p3', name: 'Another Shared' },
    ];
    const shared = new Set(['p1', 'p3']);
    const result = computeUnsharedProjects(own, shared);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p2');
  });

  it('returns empty array when all own projects are shared', () => {
    const own: Project[] = [
      { id: 'p1', name: 'Script A' },
    ];
    const result = computeUnsharedProjects(own, new Set(['p1']));
    expect(result).toHaveLength(0);
  });

  it('returns empty array when user has no projects', () => {
    const result = computeUnsharedProjects([], new Set(['p1']));
    expect(result).toHaveLength(0);
  });

  it('handles large number of projects correctly', () => {
    const own: Project[] = Array.from({ length: 50 }, (_, i) => ({ id: `p${i}`, name: `Script ${i}` }));
    // Share every other project
    const shared = new Set(own.filter((_, i) => i % 2 === 0).map(p => p.id));
    const result = computeUnsharedProjects(own, shared);
    expect(result).toHaveLength(25);
    result.forEach(p => {
      const idx = parseInt(p.id.slice(1));
      expect(idx % 2).toBe(1); // only odd-indexed projects are unshared
    });
  });
});
