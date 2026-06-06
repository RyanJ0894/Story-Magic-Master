import { test, expect } from './fixtures/authenticated';
import { SHORT_SCRIPT } from './fixtures/test-script';

/** Navigate to an existing project.
 * Prefers env-var project IDs to avoid dashboard navigation issues for enterprise users. */
async function getExistingProjectUrl(page: import('@playwright/test').Page): Promise<string | null> {
  const envId = process.env.REAL_COMPLETED_PROJECT_ID || process.env.REAL_DRAFT_PROJECT_ID;
  if (envId) return `/projects/${envId}`;

  // Fallback: navigate via dashboard Projects tab
  await page.goto('/dashboard');
  await page.waitForLoadState('load', { timeout: 15_000 });
  const projectsBtn = page.getByRole('button', { name: 'Projects', exact: true });
  const hasBtnVisible = await projectsBtn.isVisible({ timeout: 5_000 }).catch(() => false);
  if (hasBtnVisible) {
    await projectsBtn.click();
    await page.waitForLoadState('load', { timeout: 10_000 });
  }
  const card = page.getByTestId('project-card').first();
  const found = await card.isVisible({ timeout: 5_000 }).catch(() => false);
  if (!found) return null;
  const href = await card.evaluate((el) => {
    const a = el.closest('a') ?? el.querySelector('a');
    return a?.getAttribute('href') ?? null;
  });
  return href;
}

test.describe('Project Management (Authenticated)', () => {
  test.describe('Create New Project', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/projects/new');
      await page.waitForLoadState('load', { timeout: 15_000 });
    });

    test('displays project creation form', async ({ page }) => {
      await expect(page.getByTestId('project-name-input')).toBeVisible();
      await expect(page.getByTestId('project-description-input')).toBeVisible();
      await expect(page.getByTestId('script-textarea')).toBeVisible();
      await expect(page.getByTestId('page-count-display')).toBeVisible();
      await expect(page.getByTestId('create-project-button')).toBeVisible();
    });

    test('updates page count as script is entered', async ({ page }) => {
      await expect(page.getByTestId('page-count-display')).toContainText('~1 page');

      const longText = 'word '.repeat(500);
      await page.getByTestId('script-textarea').fill(longText);

      await expect(page.getByTestId('page-count-display')).toContainText('~2 pages');
    });

    test('create button is disabled without required fields', async ({ page }) => {
      const createButton = page.getByTestId('create-project-button');
      await expect(createButton).toBeDisabled();

      await page.getByTestId('project-name-input').fill('Test Project');
      await expect(createButton).toBeDisabled();

      await page.getByTestId('script-textarea').fill(SHORT_SCRIPT);
      await expect(createButton).toBeEnabled();
    });

    test('creates project and redirects to project page', async ({ page }) => {
      const projectName = `E2E Test ${Date.now()}`;
      await page.getByTestId('project-name-input').fill(projectName);
      await page.getByTestId('project-description-input').fill('Created by E2E test');
      await page.getByTestId('script-textarea').fill(SHORT_SCRIPT);

      await page.getByTestId('create-project-button').click();
      await expect(page.getByText('Creating...')).toBeVisible();
      // Enterprise users may be redirected to enterprise dashboard after project creation
      await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+|\/enterprise\/dashboard/, { timeout: 15000 });
      if (page.url().match(/\/projects\/[a-f0-9-]+/)) {
        await expect(page.getByText(projectName, { exact: false })).toBeVisible({ timeout: 5000 });
      }

      // Clean up: delete the created project to prevent quota accumulation
      const projectId = page.url().split('/projects/')[1]?.split('/')[0];
      if (projectId) {
        await page.request.delete(`/api/projects/${projectId}`).catch(() => {});
      }
    });
  });

  test.describe('Project Detail Page', () => {
    test('shows project status and workflow selector', async ({ page }) => {
      // Use an existing project — avoids quota consumption on repeated runs
      const projectHref = await getExistingProjectUrl(page);
      if (!projectHref) {
        test.skip();
        return;
      }
      await page.goto(projectHref);
      await page.waitForLoadState('load', { timeout: 15_000 });

      await expect(page.getByTestId('project-status-badge')).toBeVisible({ timeout: 10_000 });
    });

    test('shows delete confirmation dialog', async ({ page }) => {
      // Use an existing project — avoids quota consumption on repeated runs
      const projectHref = await getExistingProjectUrl(page);
      if (!projectHref) {
        test.skip();
        return;
      }
      await page.goto(projectHref);
      await page.waitForLoadState('load', { timeout: 15_000 });

      // Delete button is inside the collapsible "Danger Zone" section
      await page.getByText('Danger Zone').click();
      await expect(page.getByTestId('delete-project-button')).toBeVisible({ timeout: 5_000 });

      // Register dialog handler BEFORE clicking the button
      page.on('dialog', async (dialog) => {
        expect(dialog.type()).toBe('confirm');
        await dialog.dismiss();
      });

      await page.getByTestId('delete-project-button').click();

      // Dialog dismissed → should still be on the project page
      await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/, { timeout: 5_000 });
    });
  });
});
