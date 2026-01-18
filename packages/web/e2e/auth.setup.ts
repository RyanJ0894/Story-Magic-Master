import { test as setup, expect } from '@playwright/test';
import path from 'path';

// Test user credentials - should be a real test account in Supabase
const TEST_USER_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@storymagic.ai';
const TEST_USER_PASSWORD = process.env.E2E_TEST_PASSWORD || 'E2ETestPassword123!';

const authFile = path.join(__dirname, '.auth/user.json');

/**
 * Setup test - logs in and saves authentication state
 * This runs once before all tests that need authentication
 */
setup('authenticate', async ({ page }) => {
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
