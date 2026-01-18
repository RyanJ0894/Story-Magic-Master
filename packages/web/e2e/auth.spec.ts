import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
  test.describe('Login Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
    });

    test('displays login form with all elements', async ({ page }) => {
      // Check page title and branding
      await expect(page.getByText('Welcome back')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Story Magic' })).toBeVisible();

      // Check form elements exist with test IDs
      await expect(page.getByTestId('login-email-input')).toBeVisible();
      await expect(page.getByTestId('login-password-input')).toBeVisible();
      await expect(page.getByTestId('login-submit-button')).toBeVisible();
      await expect(page.getByTestId('login-magic-link-button')).toBeVisible();

      // Check navigation links
      await expect(page.getByRole('link', { name: 'Sign up for free' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
    });

    test('shows validation error for invalid email', async ({ page }) => {
      // Try submitting with invalid email
      await page.getByTestId('login-email-input').fill('invalid-email');
      await page.getByTestId('login-password-input').fill('password123');
      await page.getByTestId('login-submit-button').click();

      // Browser's native validation should prevent submission
      const emailInput = page.getByTestId('login-email-input');
      await expect(emailInput).toBeFocused();
    });

    test('shows error toast for incorrect credentials', async ({ page }) => {
      await page.getByTestId('login-email-input').fill('nonexistent@example.com');
      await page.getByTestId('login-password-input').fill('wrongpassword');
      await page.getByTestId('login-submit-button').click();

      // Should show loading state
      await expect(page.getByText('Signing in...')).toBeVisible();

      // Should show error toast (Sonner toast)
      await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 10000 });
    });

    test('magic link button requests email first', async ({ page }) => {
      // Click magic link without email
      await page.getByTestId('login-magic-link-button').click();

      // Should show error toast asking for email
      await expect(page.locator('[data-sonner-toast]').getByText('Please enter your email')).toBeVisible();
    });

    test('navigates to signup page', async ({ page }) => {
      await page.getByRole('link', { name: 'Sign up for free' }).click();
      await expect(page).toHaveURL('/signup');
    });
  });

  test.describe('Signup Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/signup');
    });

    test('displays signup form with all elements', async ({ page }) => {
      // Check page title (CardTitle renders as div, not heading)
      await expect(page.getByText('Create your account')).toBeVisible();

      // Check form elements with test IDs
      await expect(page.getByTestId('signup-fullname-input')).toBeVisible();
      await expect(page.getByTestId('signup-email-input')).toBeVisible();
      await expect(page.getByTestId('signup-password-input')).toBeVisible();
      await expect(page.getByTestId('signup-submit-button')).toBeVisible();

      // Check terms and privacy links
      await expect(page.getByRole('link', { name: 'Terms of Service' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Privacy Policy' })).toBeVisible();
    });

    test('validates password length', async ({ page }) => {
      await page.getByTestId('signup-fullname-input').fill('Test User');
      await page.getByTestId('signup-email-input').fill('test@example.com');
      await page.getByTestId('signup-password-input').fill('short');
      await page.getByTestId('signup-submit-button').click();

      // Browser validation prevents submission - password input should still be focused/invalid
      // The form won't submit due to minLength=6 constraint
      const passwordInput = page.getByTestId('signup-password-input');
      await expect(passwordInput).toBeFocused();
    });

    test('shows password requirement hint', async ({ page }) => {
      await expect(page.getByText('At least 6 characters')).toBeVisible();
    });

    test('navigates to login page', async ({ page }) => {
      await page.getByRole('link', { name: 'Sign in' }).click();
      await expect(page).toHaveURL('/login');
    });
  });
});
