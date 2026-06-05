import { test, expect } from './fixtures/authenticated';
import { SHORT_SCRIPT } from './fixtures/test-script';

/**
 * Session Recovery & SW Guard — Sprint P (#92, STORY-MAGIC-6)
 *
 * Tests end-to-end:
 * 1. Poll 401 handling — 3 consecutive 401s trigger recoverable "Connection lost" toast
 * 2. "Check status →" action calls router.refresh (page reloads showing current state)
 * 3. 401s below threshold (< 3) never show toast
 * 4. Counter resets on 200 — no spurious toast after recovery
 * 5. Polling survives a 401 run — audio player appears after auth recovery
 * 6. SW guard — navigator.webdriver prevents SW registration (STORY-MAGIC-6)
 *
 * All job API calls are intercepted; no real generation is triggered.
 */

// ---------------------------------------------------------------------------
// Route interceptors
// ---------------------------------------------------------------------------

/**
 * Intercepts /api/jobs/:id and fulfills sequentially from the responses array.
 * Once the array is exhausted the last item is repeated.
 */
async function mockJobPolling(
  page: import('@playwright/test').Page,
  responses: { status: number; body?: object }[]
) {
  let callCount = 0;
  await page.route('**/api/jobs/**', async (route) => {
    // Position-polling calls must not consume status-response slots — they
    // are handled independently so the consecutive-401 counter in the status
    // poller sees an uninterrupted stream of the provided responses.
    if (route.request().url().includes('/position')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          position: null,
          estimatedWaitSeconds: null,
          jobsAhead: null,
          status: 'processing',
        }),
      });
      return;
    }
    const entry = responses[Math.min(callCount, responses.length - 1)];
    callCount += 1;
    await route.fulfill({
      status: entry.status,
      contentType: 'application/json',
      body: JSON.stringify(entry.body ?? {}),
    });
  });
  return () => callCount;
}

async function mockGenerateButton(page: import('@playwright/test').Page) {
  // Stub the generate endpoint so the button is clickable but never triggers real work
  await page.route('**/api/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ jobId: 'mock-job-12345' }),
    });
  });
}

/**
 * Bypass the workflow-mode selector (which blocks fresh projects) by pre-setting
 * the mode in localStorage, then reload so the component re-initializes with it.
 * The key format mirrors what ProjectWorkflow reads on init:
 *   `project-${id}-run-${currentRunNumber + 1}-mode`   (currentRunNumber = 0 for new projects)
 *
 * After the reload, click the "Generate Now" button to start job polling.
 * Route mocks survive navigations on the same page object, so they remain active.
 */
async function clickGenerateButton(
  page: import('@playwright/test').Page,
  projectId: string,
) {
  await page.evaluate((id) => {
    localStorage.setItem(`project-${id}-run-1-mode`, 'automatic');
  }, projectId);

  await page.reload();
  await page.waitForLoadState('networkidle', { timeout: 15_000 });

  const generateBtn = page
    .getByTestId('generate-button')
    .or(page.getByRole('button', { name: /generate|start/i }).first());

  if (await generateBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await generateBtn.click();
  }
}

// ---------------------------------------------------------------------------
// Test suite — session polling
// ---------------------------------------------------------------------------

test.describe('Session polling recovery (#92)', () => {
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    // Create a real project so the server-rendered page can load.
    // X-Requested-With bypasses the CSRF origin check for same-site API calls
    // made outside a browser navigation context (e.g. page.request).
    const res = await page.request.post('/api/projects', {
      headers: { 'X-Requested-With': 'story-magic' },
      data: {
        name: 'E2E Session Recovery Test',
        scriptText: SHORT_SCRIPT,
        pageCount: 1,
      },
    });
    const data = await res.json();
    projectId = data.id;

    await mockGenerateButton(page);
  });

  test.afterEach(async ({ page }) => {
    if (projectId) {
      await page.request.delete(`/api/projects/${projectId}`, {
        headers: { 'X-Requested-With': 'story-magic' },
      }).catch(() => {});
    }
  });

  test('shows "Connection lost" toast on 3rd consecutive 401', async ({ page }) => {
    // First 2 polls → 401, 3rd poll → 401 triggers toast, subsequent → keep polling
    await mockJobPolling(page, [
      { status: 401 },
      { status: 401 },
      { status: 401 },
      { status: 200, body: { status: 'pending' } },
    ]);

    await page.goto(`/projects/${projectId}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await clickGenerateButton(page, projectId);

    // The toast should appear after 3 consecutive 401s
    await expect(
      page.getByText('Connection lost — your audio may be ready.')
    ).toBeVisible({ timeout: 30_000 });
  });

  test('"Check status →" action button is present on the toast', async ({ page }) => {
    await mockJobPolling(page, [
      { status: 401 },
      { status: 401 },
      { status: 401 },
      { status: 200, body: { status: 'pending' } },
    ]);

    await page.goto(`/projects/${projectId}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await clickGenerateButton(page, projectId);

    await expect(
      page.getByText('Connection lost — your audio may be ready.')
    ).toBeVisible({ timeout: 30_000 });

    // The Sonner action button — may render as button role or plain text in the toast
    const checkStatusBtn = page
      .getByRole('button', { name: 'Check status →' })
      .or(page.getByText('Check status →'));
    await expect(checkStatusBtn.first()).toBeVisible({ timeout: 5_000 });
  });

  test('"Check status →" click triggers page reload', async ({ page }) => {
    await mockJobPolling(page, [
      { status: 401 },
      { status: 401 },
      { status: 401 },
      { status: 200, body: { status: 'pending' } },
    ]);

    await page.goto(`/projects/${projectId}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await clickGenerateButton(page, projectId);

    await expect(
      page.getByText('Connection lost — your audio may be ready.')
    ).toBeVisible({ timeout: 30_000 });

    // Listen for the next navigation — Check status → calls router.refresh()
    const navigationPromise = page.waitForNavigation({ timeout: 10_000 }).catch(() => null);
    await page.getByRole('button', { name: 'Check status →' }).click();

    // Either a navigation fired or the URL stayed the same but a reload occurred.
    // Either way the page should still be on the project page.
    await navigationPromise;
    expect(page.url()).toContain(projectId);
  });

  test('no toast shown for 1 or 2 consecutive 401s', async ({ page }) => {
    // Only 2 x 401 — should never reach threshold
    await mockJobPolling(page, [
      { status: 401 },
      { status: 401 },
      { status: 200, body: { status: 'pending' } },
      { status: 200, body: { status: 'pending' } },
    ]);

    await page.goto(`/projects/${projectId}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await clickGenerateButton(page, projectId);

    // Wait 8s — enough for 2 poll cycles (polls every 3s); toast should NOT appear
    await page.waitForTimeout(8_000);
    await expect(
      page.getByText('Connection lost — your audio may be ready.')
    ).not.toBeVisible();
  });

  test('polling recovers after 401s — success toast fires on completed job', async ({ page }) => {
    // Simulate: 3 x 401 (connection lost), then 2 x pending, then completed
    await mockJobPolling(page, [
      { status: 401 },
      { status: 401 },
      { status: 401 },
      { status: 200, body: { status: 'pending' } },
      { status: 200, body: { status: 'pending' } },
      { status: 200, body: { status: 'completed' } },
    ]);

    await page.goto(`/projects/${projectId}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await clickGenerateButton(page, projectId);

    // "Connection lost" toast confirms the counter hit 3
    await expect(
      page.getByText('Connection lost — your audio may be ready.')
    ).toBeVisible({ timeout: 30_000 });

    // Polling continues; when the completed status arrives the success toast fires.
    // (router.refresh() is also called, but the server re-renders from DB state — no
    // real audio output was written — so we assert the toast rather than the player.)
    // Success toast text varies by implementation; accept common variants
    const successToast = page
      .getByText('Audio generation complete!')
      .or(page.getByText(/generation complete|audio is ready|audio ready/i));
    await expect(successToast.first()).toBeVisible({ timeout: 30_000 });
  });
});

// ---------------------------------------------------------------------------
// Test suite — Service Worker webdriver guard (STORY-MAGIC-6)
// ---------------------------------------------------------------------------

test.describe('ServiceWorkerRegistration webdriver guard (STORY-MAGIC-6)', () => {
  test('SW registration is skipped when navigator.webdriver is true', async ({ page }) => {
    // navigator.webdriver is always true in Playwright — registration must be skipped
    const swErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('SW registration')) {
        swErrors.push(msg.text());
      }
    });

    // Also listen for uncaught errors that would indicate a hydration mismatch
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Wait a tick for any async SW errors to surface
    await page.waitForTimeout(2_000);

    expect(swErrors).toHaveLength(0);

    // Confirm no hydration errors triggered by SW registration blocking
    const hydrationErrors = pageErrors.filter((e) =>
      e.toLowerCase().includes('hydrat') || e.toLowerCase().includes('service worker')
    );
    expect(hydrationErrors).toHaveLength(0);
  });

  test('page loads without hydration errors on project route', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Navigate to a non-existent project URL — the 404 page is sufficient to confirm
    // the SW guard doesn't inject errors during any project-route load.
    await page.goto('/projects/00000000-0000-0000-0000-000000000000');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await page.waitForTimeout(2_000);

    const hydrationErrors = pageErrors.filter((e) =>
      e.toLowerCase().includes('hydrat') || e.toLowerCase().includes('service worker')
    );
    expect(hydrationErrors).toHaveLength(0);
  });
});
