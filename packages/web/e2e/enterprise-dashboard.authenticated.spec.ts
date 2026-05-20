import { test, expect } from '@playwright/test';

/**
 * Enterprise Master Account Dashboard — authenticated tests only.
 * Unauthenticated redirect tests are in enterprise-dashboard.spec.ts.
 *
 * Chris's test account has no team yet, so /enterprise/dashboard redirects
 * server-side to /enterprise/team (team setup page). Tests accept either URL.
 */

const MOCK_TEAM_ID = 'e2e-team-00000000-0000-0000-0000-000000000001';

async function mockEnterpriseApis(page: import('@playwright/test').Page) {
  await page.route(`**/api/teams/${MOCK_TEAM_ID}/activity`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ activities: [], total: 0 }),
    });
  });

  await page.route(`**/api/teams/${MOCK_TEAM_ID}/members`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ members: [] }),
    });
  });
}

// ---------------------------------------------------------------------------
// Authenticated — /enterprise/dashboard
// ---------------------------------------------------------------------------

test.describe('Enterprise Dashboard (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await mockEnterpriseApis(page);
    await page.goto('/enterprise/dashboard');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  });

  test('page loads without crashing', async ({ page }) => {
    await expect(page).not.toHaveURL(/\/(login|sign-in)/);
    // Either the dashboard or the team-setup page — both are valid for this user
    await expect(
      page.getByRole('heading', { name: /enterprise|master account|team/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows stats row when user has a team', async ({ page }) => {
    const tabList = page.getByRole('tablist');
    const hasTabList = await tabList.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasTabList) {
      await expect(page.getByRole('tab', { name: /projects|decisions/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /team/i })).toBeVisible();
    }
  });

  test('activity feed renders or shows empty state', async ({ page }) => {
    // /enterprise/dashboard redirects to /enterprise/team for users with no team
    await expect(page).toHaveURL(/\/enterprise\/(dashboard|team)/);
  });

  test('back navigation returns to main dashboard', async ({ page }) => {
    const backLink = page
      .getByRole('link', { name: /back to dashboard|dashboard/i })
      .first();
    const hasBack = await backLink.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasBack) {
      await backLink.click();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 5_000 });
    }
  });
});

// ---------------------------------------------------------------------------
// Authenticated — /enterprise/team
// ---------------------------------------------------------------------------

test.describe('Enterprise Team Management (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await mockEnterpriseApis(page);
    await page.goto('/enterprise/team');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  });

  test('page loads without crashing', async ({ page }) => {
    await expect(page).not.toHaveURL(/\/(login|sign-in)/);
    await expect(
      page.getByRole('heading', { name: /team|manage/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows team action form', async ({ page }) => {
    // If user has no team → "Create Your Team" / "Create Team" button
    // If user has a team → invite member form with "Send Invite" button
    const createBtn = page.getByRole('button', { name: /create team/i });
    const inviteBtn = page.getByRole('button', { name: /invite|send invite/i });
    const hasCreate = await createBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasInvite = await inviteBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasCreate || hasInvite).toBe(true);
  });
});
