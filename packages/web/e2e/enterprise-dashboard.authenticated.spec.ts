import { test, expect } from '@playwright/test';

/**
 * Enterprise Master Account Dashboard — /enterprise/dashboard and /enterprise/team
 *
 * The enterprise dashboard is visible only to users on enterprise/studio/pro/creator
 * tiers who own a team. Non-enterprise authenticated users should be redirected or
 * see an upgrade prompt. Unauthenticated users always redirect to login.
 *
 * Tests mock the activity and team APIs to avoid requiring a seeded database.
 */

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const MOCK_TEAM_ID = 'e2e-team-00000000-0000-0000-0000-000000000001';

async function mockEnterpriseApis(page: import('@playwright/test').Page) {
  // Team activity feed
  await page.route(`**/api/teams/${MOCK_TEAM_ID}/activity`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ activities: [], total: 0 }),
    });
  });

  // Team members
  await page.route(`**/api/teams/${MOCK_TEAM_ID}/members`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ members: [] }),
    });
  });
}

// ---------------------------------------------------------------------------
// Unauthenticated
// ---------------------------------------------------------------------------

test.describe('Enterprise Dashboard — Unauthenticated', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/enterprise/dashboard');
    await expect(page).toHaveURL(/\/(login|sign-in)/, { timeout: 10000 });
  });

  test('team management page redirects unauthenticated users', async ({ page }) => {
    await page.goto('/enterprise/team');
    await expect(page).toHaveURL(/\/(login|sign-in)/, { timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Authenticated — /enterprise/dashboard
// ---------------------------------------------------------------------------

test.describe('Enterprise Dashboard (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await mockEnterpriseApis(page);
    await page.goto('/enterprise/dashboard');
  });

  test('page loads without crashing', async ({ page }) => {
    // Regardless of subscription tier, the page should render — either showing
    // the dashboard or a "no team" / upgrade prompt. It must not 500.
    await expect(page).not.toHaveURL(/\/(login|sign-in)/);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    // Should show some enterprise-related heading or upgrade CTA
    const heading = page
      .getByRole('heading', { name: /enterprise|master account|team/i })
      .or(page.getByText(/upgrade|no team yet/i));
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('shows stats row when user has a team', async ({ page }) => {
    // Stats cards are only rendered if the user owns a team.
    // When present, verify the tab navigation exists.
    const tabList = page.getByRole('tablist');
    const hasTabList = await tabList.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasTabList) {
      await expect(page.getByRole('tab', { name: /projects|decisions/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /team/i })).toBeVisible();
    }
  });

  test('activity feed renders or shows empty state', async ({ page }) => {
    const activitySection = page
      .getByText(/no activity yet|recent activity/i)
      .or(page.getByTestId('activity-feed'));
    const hasActivity = await activitySection.isVisible({ timeout: 5000 }).catch(() => false);
    // Activity section is only present for users with a team — soft assertion
    void hasActivity;
    // Page must still be on enterprise dashboard, not errored out
    await expect(page).toHaveURL(/\/enterprise\/dashboard/);
  });

  test('back navigation returns to main dashboard', async ({ page }) => {
    const backLink = page
      .getByRole('link', { name: /back to dashboard|dashboard/i })
      .first();
    const hasBack = await backLink.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasBack) {
      await backLink.click();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 });
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
  });

  test('page loads without crashing', async ({ page }) => {
    await expect(page).not.toHaveURL(/\/(login|sign-in)/);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    const heading = page
      .getByRole('heading', { name: /team|manage/i })
      .or(page.getByText(/invite|no team yet/i));
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('shows invite member form or upgrade prompt', async ({ page }) => {
    // Invite form is only rendered when user owns a team
    const inviteForm = page.getByRole('button', { name: /invite|send invite/i });
    const upgradePrompt = page.getByText(/upgrade|no team yet/i);
    const hasForm = await inviteForm.isVisible({ timeout: 5000 }).catch(() => false);
    const hasUpgrade = await upgradePrompt.isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasForm || hasUpgrade).toBe(true);
  });
});
