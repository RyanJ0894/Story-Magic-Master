import { test, expect } from '@playwright/test';

/**
 * Enterprise dashboard — unauthenticated access.
 * Runs without stored auth state (chromium project).
 */

test.describe('Enterprise Dashboard — Unauthenticated', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/enterprise/dashboard');
    await expect(page).toHaveURL(/\/(login|sign-in)/, { timeout: 10_000 });
  });

  test('team management page redirects unauthenticated users', async ({ page }) => {
    await page.goto('/enterprise/team');
    await expect(page).toHaveURL(/\/(login|sign-in)/, { timeout: 10_000 });
  });
});
