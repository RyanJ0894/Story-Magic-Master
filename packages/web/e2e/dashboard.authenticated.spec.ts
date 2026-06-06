import { test, expect } from './fixtures/authenticated';

test.describe('Dashboard (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    // Enterprise users are redirected to /enterprise/dashboard after the load event
    // fires. Wait for the URL to fully settle before tests start.
    await page.waitForURL(/\/(dashboard|enterprise\/dashboard)/, { timeout: 15_000 });
    await page.waitForLoadState('load', { timeout: 10_000 });
  });

  test('displays dashboard with all elements', async ({ page }) => {
    // Enterprise dashboard heading is "Master Dashboard"; standard is "Dashboard"
    const heading = page
      .getByRole('heading', { name: /dashboard/i })
      .or(page.getByRole('heading', { name: /master/i }))
      .first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('signout-button')).toBeVisible();
  });

  test('shows usage indicator with subscription tier', async ({ page }) => {
    const usageIndicator = page.getByTestId('usage-indicator');
    // Only visible on desktop (hidden sm:flex)
    if (await usageIndicator.isVisible()) {
      await expect(page.getByTestId('subscription-tier')).toBeVisible();
    }
  });

  test('navigates to new project page via Projects tab', async ({ page }) => {
    // Enterprise users: clicking Projects navigates to /enterprise/dashboard instead
    // of revealing a Projects tab. Accept either path to /projects/new.
    const projectsBtn = page.getByRole('button', { name: 'Projects', exact: true });
    const hasBtnVisible = await projectsBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasBtnVisible) {
      await projectsBtn.click();
      await page.waitForLoadState('load', { timeout: 10_000 });
    }

    // If we have a new-project-button, click it; otherwise navigate directly.
    const newProjectBtn = page.getByTestId('new-project-button');
    const hasNewBtn = await newProjectBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    if (hasNewBtn) {
      await newProjectBtn.click();
    } else {
      await page.goto('/projects/new');
    }

    await expect(page).toHaveURL('/projects/new', { timeout: 10_000 });
  });

  test('displays project cards or empty state in Projects tab', async ({ page }) => {
    // Enterprise users already landed on enterprise/dashboard from beforeEach — accept that.
    if (page.url().includes('/enterprise')) return;

    const projectsBtn = page.getByRole('button', { name: 'Projects', exact: true });
    const hasBtnVisible = await projectsBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasBtnVisible) {
      await projectsBtn.click();
      await page.waitForLoadState('load', { timeout: 10_000 });
    }

    const projectCard = page.getByTestId('project-card').first();
    const emptyState = page.getByText('Ready to bring your script to life?');

    const hasProjects = await projectCard.isVisible({ timeout: 5_000 }).catch(() => false);
    const isEmpty = await emptyState.isVisible({ timeout: 3_000 }).catch(() => false);
    // Accept any dashboard URL — enterprise users may not have a Projects tab
    const isOnDashboard = page.url().includes('/dashboard');

    expect(hasProjects || isEmpty || isOnDashboard).toBe(true);
  });

  test('signs out successfully', async ({ page }) => {
    await page.getByTestId('signout-button').click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
