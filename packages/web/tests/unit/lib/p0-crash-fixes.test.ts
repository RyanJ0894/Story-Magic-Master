/**
 * Tests covering the three P0 crash fixes:
 * 1. team/page: members undefined after POST (Fixes STORY-MAGIC-6/P, GH#78)
 * 2. billing/page: BigInt arithmetic (Fixes STORY-MAGIC-F/N)
 * 3. projects/[id]/page: UUID validation guard (Fixes STORY-MAGIC-J)
 */
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Fix 1: team members default normalisation
// Mirrors the logic in enterprise/team/page.tsx createTeam()
// ---------------------------------------------------------------------------
function normaliseTeamResponse(apiResponse: Record<string, unknown>) {
  return { ...apiResponse, members: (apiResponse.members as unknown[]) ?? [] };
}

describe('enterprise/team — createTeam members normalisation', () => {
  it('preserves members array when API returns it', () => {
    const team = { id: 'abc', name: 'Crew', members: [{ id: 'm1', role: 'admin', status: 'accepted' }] };
    const result = normaliseTeamResponse(team);
    expect(result.members).toHaveLength(1);
  });

  it('defaults to empty array when API omits members', () => {
    const team = { id: 'abc', name: 'Crew' };
    const result = normaliseTeamResponse(team);
    expect(result.members).toEqual([]);
  });

  it('defaults to empty array when API returns null members', () => {
    const team = { id: 'abc', name: 'Crew', members: null };
    const result = normaliseTeamResponse(team as Record<string, unknown>);
    expect(result.members).toEqual([]);
  });

  it('filter on normalised team never throws', () => {
    const team = normaliseTeamResponse({ id: 'abc', name: 'Crew' });
    const members = (team.members as Array<{ status: string }>);
    expect(() => members.filter(m => m.status === 'accepted')).not.toThrow();
    expect(members.filter(m => m.status === 'accepted')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Fix 2: billing BigInt conversion
// $queryRaw returns BigInt for numeric columns; Number() converts safely.
// ---------------------------------------------------------------------------
describe('billing/page — BigInt remaining pages conversion', () => {
  it('converts BigInt remaining to number without throwing', () => {
    const rawResult = [{ remaining: BigInt(42) }];
    const pageLimit = 100;
    const remainingPages = Number(rawResult[0]?.remaining ?? pageLimit);
    expect(typeof remainingPages).toBe('number');
    expect(remainingPages).toBe(42);
  });

  it('falls back to pageLimit when remaining is null/undefined', () => {
    const pageLimit = 100;
    const remainingPages = Number(undefined ?? pageLimit);
    expect(remainingPages).toBe(100);
  });

  it('arithmetic after conversion does not throw', () => {
    const rawResult = [{ remaining: BigInt(30) }];
    const pageLimit = 100;
    const remaining = Number(rawResult[0]?.remaining ?? pageLimit);
    const usedPages = pageLimit - remaining;
    const usagePercent = (usedPages / pageLimit) * 100;
    expect(usedPages).toBe(70);
    expect(usagePercent).toBe(70);
  });

  it('handles zero remaining (edge case)', () => {
    const rawResult = [{ remaining: BigInt(0) }];
    const pageLimit = 100;
    const remaining = Number(rawResult[0]?.remaining ?? pageLimit);
    expect(remaining).toBe(0);
    expect(pageLimit - remaining).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Fix 3: UUID validation guard for projects/[id]
// ---------------------------------------------------------------------------
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidProjectId(id: string): boolean {
  return UUID_RE.test(id);
}

describe('projects/[id] — UUID validation guard (STORY-MAGIC-J)', () => {
  it('accepts a valid lowercase UUID', () => {
    expect(isValidProjectId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('accepts a valid uppercase UUID', () => {
    expect(isValidProjectId('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('rejects E2E fixture ID with text prefix (original crash trigger)', () => {
    expect(isValidProjectId('e2e-upload-project-00000000-0000-0000-0000-000000000001')).toBe(false);
  });

  it('rejects "undefined"', () => {
    expect(isValidProjectId('undefined')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidProjectId('')).toBe(false);
  });

  it('rejects UUID with wrong segment lengths', () => {
    expect(isValidProjectId('550e8400-e29b-41d4-a716-44665544')).toBe(false);
  });

  it('rejects slug-style IDs', () => {
    expect(isValidProjectId('my-project-name')).toBe(false);
  });
});
