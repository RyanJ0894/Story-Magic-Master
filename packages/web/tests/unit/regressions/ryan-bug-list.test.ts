/**
 * Ryan Bug-List Regression Guard.
 *
 * Each test in this file locks a fix that addressed a specific Ryan
 * complaint. The tests are intentionally source-string-grep based — they
 * read the production source files on disk and assert key patterns are
 * present. This catches the silent-regression failure mode where someone
 * "cleans up" a comment, refactors a route, or reverts a hotfix without
 * realizing it re-opens a bug Ryan already flagged.
 *
 * If a test in this file goes red:
 *   1. Find the PR # in the test's `pr:` tag below.
 *   2. Read that PR's description to understand what was fixed.
 *   3. If the underlying behavior is preserved by a different mechanism,
 *      update the test. If it isn't, restore the fix.
 *
 * NEVER weaken these tests just to make them pass.
 *
 * ---
 *
 * Currently-active vs gated describes:
 *
 *   PR #343 — ACTIVE (merged 2026-06-19). Verifies classifyFailure is wired.
 *
 *   PR #344 — SKIPPED (pending merge). Un-skip when invite logo + Add Notes
 *     label hit main. To un-skip: `describe.skip` → `describe`.
 *   PR #345 — SKIPPED (pending merge). Un-skip when comments POST
 *     ProjectAssignment + try/catch hit main.
 *   PR #354 — SKIPPED (pending merge). Un-skip when /jobs/position
 *     loose-tier + Retry-After backoff hit main.
 *   PR #355 — SKIPPED (pending merge). Un-skip when 90s readiness +
 *     "warming up" message hit main.
 *   PR #356 — SKIPPED (pending merge). Un-skip when project_created +
 *     script_uploaded producers hit main.
 *   PR #357 — SKIPPED (pending merge). Un-skip when narrator 1.1 default
 *     hits main.
 *
 * The skip-list IS the inoculation contract: every skipped describe MUST
 * eventually flip back to active. A 6-month-old skip means we silently lost
 * a Ryan fix.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB_ROOT = join(__dirname, '..', '..', '..');

function readSource(relativePath: string): string {
  return readFileSync(join(WEB_ROOT, relativePath), 'utf8');
}

// ---------------------------------------------------------------------------
// PR #343 — pre-flight 422 surfacing (already merged to main)
// Ryan's 6/17 + 6/18 complaint: "Audio generation failed: no audio was
// produced" appeared on every failure, regardless of cause. PR #343 added
// the 422 classifier so 422 errors surface as "re-run the director".
// ---------------------------------------------------------------------------
describe('PR #343 — classifyFailure surfaces preflight 422 messages', () => {
  it('lib/generation/classify-failure.ts contains the three distinct message families', () => {
    const src = readSource('lib/generation/classify-failure.ts');
    expect(src).toContain('TTS provider (ElevenLabs) is currently returning errors');
    expect(src).toContain('re-run the director step');
    expect(src).toContain('no audio was produced');
  });

  it('processor.ts uses classifyFailure (not inline classifier)', () => {
    const src = readSource('lib/generation/processor.ts');
    expect(src).toContain('classifyFailure');
    expect(src).toContain("from '@/lib/generation/classify-failure'");
  });
});

// ---------------------------------------------------------------------------
// PR #344 — invite logo + "+ Add Notes" label (cosmetic UX)
// Ryan's 6/18: "+" without "Add Notes" wording was confusing; invite logo
// was too small relative to the dashboard.
// ---------------------------------------------------------------------------
describe.skip('PR #344 — invite logo + Add Notes label', () => {
  it('invite page header logo uses w-12/h-12 (matches signup)', () => {
    const src = readSource('app/invite/[token]/page.tsx');
    // Either the header explicitly uses w-12 h-12 or the comment marks the
    // intentional sizing — accept either to allow non-disruptive class-name
    // refactors.
    const hasNewSize = /w-12\s+h-12/.test(src);
    expect(hasNewSize).toBe(true);
  });

  it('ScreenplayPlayer "+ Add Notes" affordance includes the words "Add Notes"', () => {
    const src = readSource('components/project/ScreenplayPlayer.tsx');
    expect(src).toContain('Add Notes');
  });
});

// ---------------------------------------------------------------------------
// PR #345 — sub-account comments POST: ProjectAssignment check + save errors
// Ryan's 6/18: sub-accounts hit "Failed to save" on notes/reactions, and
// master never saw the saved comment.
// ---------------------------------------------------------------------------
describe.skip('PR #345 — comments POST enforces ProjectAssignment + handles save errors', () => {
  it('comments route checks ProjectAssignment for non-owner access', () => {
    const src = readSource('app/api/projects/[id]/comments/route.ts');
    expect(src).toContain('projectAssignment');
  });

  it('comments POST wraps the Prisma transaction in try/catch', () => {
    const src = readSource('app/api/projects/[id]/comments/route.ts');
    // Look for the catch handler around the transaction.
    expect(src).toMatch(/catch\s*\(\s*err/);
    expect(src).toContain('Failed to save note');
  });
});

// ---------------------------------------------------------------------------
// PR #354 — /jobs/position 429 backoff + loose rate-limit
// Ryan's 6/19 7:38 PM trace: 50+ consecutive 429s flooded the console.
// ---------------------------------------------------------------------------
describe.skip('PR #354 — /jobs/position uses loose rate-limit + client backs off on 429', () => {
  it('position route is configured with rateLimit: loose', () => {
    const src = readSource('app/api/jobs/[id]/position/route.ts');
    expect(src).toMatch(/rateLimit:\s*['"]loose['"]/);
  });

  it('generate-button.tsx pollQueuePosition reads Retry-After on 429', () => {
    const src = readSource('app/projects/[id]/generate-button.tsx');
    expect(src).toContain('Retry-After');
    // Detect either explicit response.status === 429 or response.status==429
    expect(src).toMatch(/status\s*===\s*429|status\s*==\s*429/);
  });
});

// ---------------------------------------------------------------------------
// PR #355 — orchestrator readiness probe 60s → 90s
// Ryan's 6/19 7:15 PM trace: "did not become ready within 60000ms (probed 15x)".
// ---------------------------------------------------------------------------
describe.skip('PR #355 — orchestrator readiness probe default is 90s', () => {
  it('waitForOrchestratorReady default param is 90_000', () => {
    const src = readSource('lib/orchestrator-fetch.ts');
    // Match the default value on the parameter (allows whitespace variation).
    expect(src).toMatch(/maxWaitMs:\s*number\s*=\s*90_?000/);
  });

  it('processor.ts emits a user-visible "warming up" status before the await', () => {
    const src = readSource('lib/generation/processor.ts');
    expect(src.toLowerCase()).toContain('warming up');
  });
});

// ---------------------------------------------------------------------------
// PR #356 — project_created + script_uploaded master feed producers
// Ryan's 6/19 + 6/21 (item i): master must see meaningful sub-account
// activity regardless of team-share / project-assignment state.
// ---------------------------------------------------------------------------
describe.skip('PR #356 — feed types include project_created + script_uploaded', () => {
  it('feed-types.ts exports the two new alert types', () => {
    const src = readSource('lib/notifications/feed-types.ts');
    expect(src).toContain("'project_created'");
    expect(src).toContain("'script_uploaded'");
  });

  it('producers.ts exports emitProjectCreated + emitScriptUploaded', () => {
    const src = readSource('lib/notifications/producers.ts');
    expect(src).toMatch(/export\s+async\s+function\s+emitProjectCreated/);
    expect(src).toMatch(/export\s+async\s+function\s+emitScriptUploaded/);
  });

  it('POST /api/projects fires emitProjectCreated', () => {
    const src = readSource('app/api/projects/route.ts');
    expect(src).toContain('emitProjectCreated');
  });
});

// ---------------------------------------------------------------------------
// PR #357 — tuning defaults: +3 dB gains, narrator 1.0 → 1.1
// Ryan's 6/15 + 6/21 (item k): volumes too low, narration too slow.
// ---------------------------------------------------------------------------
describe.skip('PR #357 — tuning defaults bumped (volumes + narrator speed)', () => {
  it('DEFAULT_AUDIO_TUNING.narrationSpeed is 1.1', () => {
    const src = readSource('lib/services/audio-tuning.ts');
    expect(src).toMatch(/narrationSpeed:\s*1\.1\b/);
  });
});
