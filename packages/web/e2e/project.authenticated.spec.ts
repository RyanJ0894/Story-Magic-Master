import { test, expect } from '@playwright/test';
import { SHORT_SCRIPT } from './fixtures/test-script';

test.describe('Project Management (Authenticated)', () => {
  test.describe('Create New Project', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/projects/new');
    });

    test('displays project creation form', async ({ page }) => {
      await expect(page.getByTestId('project-name-input')).toBeVisible();
      await expect(page.getByTestId('project-description-input')).toBeVisible();
      await expect(page.getByTestId('script-textarea')).toBeVisible();
      await expect(page.getByTestId('page-count-display')).toBeVisible();
      await expect(page.getByTestId('create-project-button')).toBeVisible();
    });

    test('updates page count as script is entered', async ({ page }) => {
      // Initially shows ~1 page
      await expect(page.getByTestId('page-count-display')).toContainText('~1 page');

      // Enter a longer script (~500 words = 2 pages)
      const longText = 'word '.repeat(500);
      await page.getByTestId('script-textarea').fill(longText);

      // Should show ~2 pages
      await expect(page.getByTestId('page-count-display')).toContainText('~2 pages');
    });

    test('create button is disabled without required fields', async ({ page }) => {
      const createButton = page.getByTestId('create-project-button');
      await expect(createButton).toBeDisabled();

      // Fill name only - still disabled
      await page.getByTestId('project-name-input').fill('Test Project');
      await expect(createButton).toBeDisabled();

      // Fill script - now enabled
      await page.getByTestId('script-textarea').fill(SHORT_SCRIPT);
      await expect(createButton).toBeEnabled();
    });

    test('creates project and redirects to project page', async ({ page }) => {
      // Fill in project details
      await page.getByTestId('project-name-input').fill(`E2E Test Project ${Date.now()}`);
      await page.getByTestId('project-description-input').fill('Created by E2E test');
      await page.getByTestId('script-textarea').fill(SHORT_SCRIPT);

      // Create project
      await page.getByTestId('create-project-button').click();

      // Should show loading state
      await expect(page.getByText('Creating...')).toBeVisible();

      // Should redirect to project page
      await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/, { timeout: 15000 });

      // Project page should show our project name
      await expect(page.getByText('E2E Test Project')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Project Detail Page', () => {
    test('shows project status and generate button', async ({ page }) => {
      // First create a project to test with
      await page.goto('/projects/new');
      await page.getByTestId('project-name-input').fill(`Detail Test ${Date.now()}`);
      await page.getByTestId('script-textarea').fill(SHORT_SCRIPT);
      await page.getByTestId('create-project-button').click();

      // Wait for redirect
      await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/, { timeout: 15000 });

      // Check project detail elements
      await expect(page.getByTestId('project-status-badge')).toBeVisible();
      await expect(page.getByTestId('generate-button')).toBeVisible();
      await expect(page.getByTestId('delete-project-button')).toBeVisible();
    });

    test('shows delete confirmation dialog', async ({ page }) => {
      // Create a project first
      await page.goto('/projects/new');
      await page.getByTestId('project-name-input').fill(`Delete Test ${Date.now()}`);
      await page.getByTestId('script-textarea').fill(SHORT_SCRIPT);
      await page.getByTestId('create-project-button').click();
      await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/, { timeout: 15000 });

      // Set up dialog handler to dismiss
      page.on('dialog', async dialog => {
        expect(dialog.type()).toBe('confirm');
        expect(dialog.message()).toContain('Are you sure');
        await dialog.dismiss();
      });

      // Click delete
      await page.getByTestId('delete-project-button').click();

      // Should still be on the project page (we dismissed the dialog)
      await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/);
    });
  });
});
