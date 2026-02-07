import { test as setup, expect } from '@playwright/test';
import path from 'path';

// Test user credentials - must be provided via environment variables in CI
const TEST_USER_EMAIL = process.env.E2E_TEST_EMAIL || '';
const TEST_USER_PASSWORD = process.env.E2E_TEST_PASSWORD || '';

const authFile = path.join(__dirname, '.auth/user.json');

/**
 * Setup test - logs in and saves authentication state.
 * This runs once before all authenticated tests.
 *
 * Skip gracefully if no test credentials are configured.
 * Unauthenticated E2E tests (auth.spec.ts, dashboard.spec.ts, project.spec.ts)
 * still run without credentials.
 */
setup('authenticate', async ({ page }) => {
  if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
    setup.skip();
    return;
  }

  // Navigate to login page
  await page.goto('/login');

  // Fill in credentials
  await page.getByTestId('login-email-input').fill(TEST_USER_EMAIL);
  await page.getByTestId('login-password-input').fill(TEST_USER_PASSWORD);

  // Click sign in
  await page.getByTestId('login-submit-button').click();

  // Wait for redirect to dashboard (indicates successful login)
  await page.waitForURL('/dashboard', { timeout: 30000 });

  // Verify we're on the dashboard
  await expect(page.getByTestId('new-project-button')).toBeVisible({ timeout: 10000 });

  // Save authentication state
  await page.context().storageState({ path: authFile });

  console.log('✅ Authentication state saved to:', authFile);
});
