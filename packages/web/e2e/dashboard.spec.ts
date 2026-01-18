import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.describe('Unauthenticated Access', () => {
    test('redirects to login when not authenticated', async ({ page }) => {
      await page.goto('/dashboard');
      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });
  });
});

// Note: Authenticated dashboard tests are in dashboard.authenticated.spec.ts
