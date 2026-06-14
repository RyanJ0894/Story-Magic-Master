import path from 'path';
import { test, expect } from './fixtures/authenticated';
import { SHORT_SCRIPT } from './fixtures/test-script';

/**
 * Listen flow navigation regression spec — locks in PR #271 / issue #206.
 *
 * The bug: a team member who opened a script's Listen page got a single
 * "← Library" link that dumped them on /reader/dashboard (an island with
 * no further nav). Two changes prevent recurrence:
 *
 *   1. screenplay-reader.tsx header: owners AND team members get a
 *      "← Project" back-link to /projects/[id]. Dashboard link is always
 *      visible (was hidden on mobile via "hidden sm:inline-flex").
 *   2. /reader/dashboard header: has an explicit "Dashboard" exit button.
 *
 * Coverage in this spec:
 *   - Owner case: back-link href, label, visible Dashboard link, click
 *     navigation. This is the dominant traffic path.
 *   - /reader/dashboard: Dashboard exit button is visible and points at
 *     /dashboard.
 *
 * Not covered (would require multi-user invite flow we don't simulate
 * here — TODO if the listen-flow ever regresses on the team-member path):
 *   - Team-member case: same back-link should appear, label "Project".
 *   - Script-share recipient (no team) case: keeps "← Library".
 *
 * The unit-test in tests/unit/listen-back-link.test.ts covers the
 * decision logic for all three personas — this spec covers the rendered
 * chrome.
 */

test.describe('Listen flow navigation (PR #271, issue #206)', () => {
  let projectId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    // Prefer env-var IDs so CI doesn't spawn a fresh project every run.
    const envId = process.env.REAL_DRAFT_PROJECT_ID || process.env.REAL_COMPLETED_PROJECT_ID;
    if (envId) {
      projectId = envId;
      return;
    }

    // Fallback: create a minimal project under the authenticated user.
    const authFile = path.join(__dirname, '.auth/user.json');
    const context = await browser.newContext({ storageState: authFile });
    const page = await context.newPage();
    await page.goto('/projects/new');

    const ready = await page
      .getByTestId('project-name-input')
      .isVisible({ timeout: 8000 })
      .catch(() => false);
    if (!ready) {
      await context.close();
      return;
    }

    await page.getByTestId('project-name-input').fill(`E2E Listen Nav ${Date.now()}`);
    await page.getByTestId('script-textarea').fill(SHORT_SCRIPT);
    await page.getByTestId('create-project-button').click();
    await page.waitForURL(/\/projects\/[a-f0-9-]+/, { timeout: 15000 });
    const match = page.url().match(/\/projects\/([a-f0-9-]+)/);
    if (match) projectId = match[1];
    await context.close();
  });

  test('Listen page back-link goes to the project page for the owner', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }
    await page.goto(`/projects/${projectId}/listen`);
    await expect(page).not.toHaveURL(/\/(login|sign-in)/, { timeout: 10000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Owner sees the "Project" button (not "Library"). The chevron icon
    // is the chevron-left from lucide; we match by visible text.
    const backButton = page.getByRole('link', { name: /^Project$/i }).first();
    await expect(backButton).toBeVisible({ timeout: 10000 });
    await expect(backButton).toHaveAttribute('href', `/projects/${projectId}`);
  });

  test('Dashboard link is visible on the Listen page (not hidden on small viewports)', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }

    // Simulate a small viewport (375x667 — iPhone SE) so we'd catch a
    // regression of the "hidden sm:inline-flex" class that #271 removed.
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`/projects/${projectId}/listen`);
    await expect(page).not.toHaveURL(/\/(login|sign-in)/);
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    const dashboard = page.getByRole('link', { name: /^Dashboard$/i }).first();
    await expect(dashboard).toBeVisible({ timeout: 10000 });
    await expect(dashboard).toHaveAttribute('href', '/dashboard');
  });

  test('Clicking the Listen back-link navigates to the project page', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }
    await page.goto(`/projects/${projectId}/listen`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    const backButton = page.getByRole('link', { name: /^Project$/i }).first();
    await backButton.click();
    await page.waitForURL(`**/projects/${projectId}`, { timeout: 10000 });
    // Confirm we actually landed on a project page (not still on Listen or
    // a 404). String comparison — no need for dynamic regex construction
    // (semgrep flags those even when the interpolated value is a UUID).
    expect(page.url().endsWith(`/projects/${projectId}`)).toBe(true);
  });
});

test.describe('Reader dashboard exit (PR #271, issue #206)', () => {
  test('/reader/dashboard has a Dashboard exit link pointing at /dashboard', async ({ page }) => {
    await page.goto('/reader/dashboard');
    // The reader/dashboard page is gated by auth — if the storageState user
    // can't reach it (e.g., not a reader role), skip. Don't fail.
    if (/\/(login|sign-in)/.test(page.url())) {
      test.skip();
      return;
    }
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    const exit = page.getByRole('link', { name: /^Dashboard$/ }).first();
    await expect(exit).toBeVisible({ timeout: 10000 });
    await expect(exit).toHaveAttribute('href', '/dashboard');
  });

  test('Reader dashboard Dashboard button is visible on small viewports (icon + text fallback)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/reader/dashboard');
    if (/\/(login|sign-in)/.test(page.url())) {
      test.skip();
      return;
    }
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // On small viewports the visible label is hidden, but the link itself
    // is still rendered (icon-only). Match by href, not by accessible name.
    const exit = page.locator('a[href="/dashboard"]').first();
    await expect(exit).toBeVisible({ timeout: 10000 });
  });
});
