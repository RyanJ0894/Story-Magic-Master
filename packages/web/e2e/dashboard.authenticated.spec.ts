import { test, expect } from './fixtures/authenticated';

test.describe('Dashboard (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  });

  test('displays dashboard with all elements', async ({ page }) => {
    // h1 heading on the dashboard overview
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
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
    // new-project-button is inside the Projects tab, not the default Overview tab
    await page.getByRole('button', { name: 'Projects', exact: true }).click();
    await expect(page.getByTestId('new-project-button')).toBeVisible();
    await page.getByTestId('new-project-button').click();
    await expect(page).toHaveURL('/projects/new', { timeout: 10_000 });
  });

  test('displays project cards or empty state in Projects tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Projects', exact: true }).click();

    const projectCard = page.getByTestId('project-card').first();
    const emptyState = page.getByText('Ready to bring your script to life?');

    const hasProjects = await projectCard.isVisible().catch(() => false);
    const isEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasProjects || isEmpty).toBe(true);
  });

  test('signs out successfully', async ({ page }) => {
    await page.getByTestId('signout-button').click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
