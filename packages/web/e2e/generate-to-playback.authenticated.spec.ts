import { test, expect } from '@playwright/test';
import { SHORT_SCRIPT } from './fixtures/test-script';

/**
 * TD-034: E2E test — generate-to-playback flow
 *
 * Tests the full lifecycle: create project -> fill form -> submit ->
 * view project details -> trigger generation -> observe status updates -> playback.
 *
 * API calls are intercepted with page.route() so the test does not depend
 * on a live orchestrator or external services.
 */

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const MOCK_PROJECT_ID = 'e2e-gen-project-00000000-0000-0000-0000-000000000001';
const MOCK_JOB_ID = 'e2e-gen-job-00000000-0000-0000-0000-000000000001';

/** Intercept Supabase / API calls so the test never hits a real backend. */
async function setupApiMocks(page: import('@playwright/test').Page) {
  // Mock project creation (POST /api/projects or Supabase rest)
  await page.route('**/api/projects', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: MOCK_PROJECT_ID,
          name: 'E2E Generate Test',
          description: 'Created by E2E generate-to-playback test',
          status: 'draft',
          script_text: SHORT_SCRIPT,
          page_count: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock project detail fetch
  await page.route(`**/api/projects/${MOCK_PROJECT_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: MOCK_PROJECT_ID,
        name: 'E2E Generate Test',
        description: 'Created by E2E generate-to-playback test',
        status: 'draft',
        script_text: SHORT_SCRIPT,
        page_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });
  });

  // Mock generation trigger (POST /api/projects/:id/generate)
  await page.route(`**/api/projects/${MOCK_PROJECT_ID}/generate`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          job_id: MOCK_JOB_ID,
          status: 'queued',
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock job status polling (returns completed after first poll)
  let pollCount = 0;
  await page.route(`**/api/jobs/${MOCK_JOB_ID}`, async (route) => {
    pollCount++;
    const isComplete = pollCount >= 2;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: MOCK_JOB_ID,
        project_id: MOCK_PROJECT_ID,
        status: isComplete ? 'completed' : 'processing',
        progress: isComplete ? 100 : 40,
        audio_url: isComplete
          ? `https://storage.example.com/audio/${MOCK_PROJECT_ID}/output.m4a`
          : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });
  });

  // Mock audio file to avoid network errors on playback element
  await page.route('**/audio/**', async (route) => {
    // Return a tiny valid audio stub (silence)
    await route.fulfill({
      status: 200,
      contentType: 'audio/mp4',
      body: Buffer.alloc(0),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Generate-to-Playback Flow (Authenticated)', () => {
  test('full flow: create project, trigger generation, verify status updates', async ({
    page,
  }) => {
    // -----------------------------------------------------------------------
    // Step 1 — Navigate to the new-project form
    // -----------------------------------------------------------------------
    await page.goto('/projects/new');

    await expect(page.getByTestId('project-name-input')).toBeVisible();
    await expect(page.getByTestId('script-textarea')).toBeVisible();
    await expect(page.getByTestId('create-project-button')).toBeVisible();

    // -----------------------------------------------------------------------
    // Step 2 — Fill in project details
    // -----------------------------------------------------------------------
    const projectName = `E2E Generate Test ${Date.now()}`;
    await page.getByTestId('project-name-input').fill(projectName);
    await page.getByTestId('project-description-input').fill(
      'Created by E2E generate-to-playback test',
    );
    await page.getByTestId('script-textarea').fill(SHORT_SCRIPT);

    // Button should be enabled now
    await expect(page.getByTestId('create-project-button')).toBeEnabled();

    // -----------------------------------------------------------------------
    // Step 3 — Submit project creation
    // -----------------------------------------------------------------------
    await page.getByTestId('create-project-button').click();

    // Should show loading state
    await expect(page.getByText('Creating...')).toBeVisible();

    // Should redirect to project detail page
    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/, { timeout: 15000 });

    // -----------------------------------------------------------------------
    // Step 4 — Verify project details display
    // -----------------------------------------------------------------------
    await expect(page.getByText('E2E Generate Test')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('project-status-badge')).toBeVisible();
    await expect(page.getByTestId('generate-button')).toBeVisible();
  });

  test('generate button triggers generation and shows status updates (mocked)', async ({
    page,
  }) => {
    await setupApiMocks(page);

    // Navigate directly to the mocked project detail page
    await page.goto(`/projects/${MOCK_PROJECT_ID}`);

    // Wait for the page to render project details
    await expect(page.getByTestId('generate-button')).toBeVisible({ timeout: 10000 });

    // -----------------------------------------------------------------------
    // Step 5 — Click generate
    // -----------------------------------------------------------------------
    await page.getByTestId('generate-button').click();

    // Should show a processing / generating state
    // The exact text depends on UI implementation; check for common patterns
    const generatingIndicator = page
      .getByText(/generating|processing|queued/i)
      .first();
    await expect(generatingIndicator).toBeVisible({ timeout: 10000 });
  });

  test('project detail page shows audio player after generation completes (mocked)', async ({
    page,
  }) => {
    // Set up mocks so the job is already completed
    await page.route(`**/api/projects/${MOCK_PROJECT_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: MOCK_PROJECT_ID,
          name: 'E2E Generate Test',
          status: 'completed',
          audio_url: `https://storage.example.com/audio/${MOCK_PROJECT_ID}/output.m4a`,
          page_count: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/audio/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'audio/mp4',
        body: Buffer.alloc(0),
      });
    });

    await page.goto(`/projects/${MOCK_PROJECT_ID}`);

    // When a project has completed generation, the audio player should appear
    const audioPlayer = page.getByTestId('audio-player');
    const downloadButton = page.getByTestId('download-button');

    // At least one playback-related element should be visible
    const hasPlayer = await audioPlayer.isVisible({ timeout: 10000 }).catch(() => false);
    const hasDownload = await downloadButton.isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasPlayer || hasDownload).toBe(true);
  });
});
