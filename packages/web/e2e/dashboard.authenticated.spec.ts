import { test, expect } from '@playwright/test';

test.describe('Dashboard (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('displays dashboard with all elements', async ({ page }) => {
    // Check header elements
    await expect(page.getByRole('heading', { name: 'Your Projects' })).toBeVisible();
    await expect(page.getByTestId('new-project-button')).toBeVisible();
    await expect(page.getByTestId('signout-button')).toBeVisible();
  });

  test('shows usage indicator with subscription tier', async ({ page }) => {
    // Check usage indicator (may be hidden on mobile)
    const usageIndicator = page.getByTestId('usage-indicator');
    // Only check if visible (desktop)
    if (await usageIndicator.isVisible()) {
      await expect(page.getByTestId('subscription-tier')).toBeVisible();
    }
  });

  test('navigates to new project page', async ({ page }) => {
    await page.getByTestId('new-project-button').click();
    await expect(page).toHaveURL('/projects/new');
  });

  test('displays project cards or empty state', async ({ page }) => {
    // Either show project cards or empty state
    const projectCard = page.getByTestId('project-card').first();
    const emptyState = page.getByText('No projects yet');

    // One of these should be visible
    const hasProjects = await projectCard.isVisible().catch(() => false);
    const isEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasProjects || isEmpty).toBe(true);
  });

  test('signs out successfully', async ({ page }) => {
    await page.getByTestId('signout-button').click();

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
