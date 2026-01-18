import { test, expect } from '@playwright/test';

test.describe('Project Management', () => {
  test.describe('Unauthenticated Access', () => {
    test('redirects to login when accessing new project page', async ({ page }) => {
      await page.goto('/projects/new');
      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test('redirects to login when accessing project detail', async ({ page }) => {
      await page.goto('/projects/some-project-id');
      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });
  });
});

// Note: Authenticated project tests are in project.authenticated.spec.ts
