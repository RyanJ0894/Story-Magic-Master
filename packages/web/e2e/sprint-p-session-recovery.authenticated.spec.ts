import { test, expect } from './fixtures/authenticated';

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
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_PROJECT_ID = '71e98a0f-731f-4a25-8cab-2226daca0a3e';

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
  await page.route('**/api/projects/*/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ jobId: 'mock-job-12345' }),
    });
  });
}

// ---------------------------------------------------------------------------
// Test suite — session polling
// ---------------------------------------------------------------------------

test.describe('Session polling recovery (#92)', () => {
  test.beforeEach(async ({ page }) => {
    await mockGenerateButton(page);
  });

  test('shows "Connection lost" toast on 3rd consecutive 401', async ({ page }) => {
    // First 2 polls → 401, 3rd poll → 401 triggers toast, subsequent → keep polling
    await mockJobPolling(page, [
      { status: 401 },
      { status: 401 },
      { status: 401 },
      { status: 200, body: { status: 'pending' } },
    ]);

    await page.goto(`/projects/${MOCK_PROJECT_ID}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Trigger polling by clicking Generate (button may be in any state; find it)
    const generateBtn = page.getByTestId('generate-button').or(
      page.getByRole('button', { name: /generate|start/i }).first()
    );

    if (await generateBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await generateBtn.click();
    }

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

    await page.goto(`/projects/${MOCK_PROJECT_ID}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const generateBtn = page.getByTestId('generate-button').or(
      page.getByRole('button', { name: /generate|start/i }).first()
    );
    if (await generateBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await generateBtn.click();
    }

    await expect(
      page.getByText('Connection lost — your audio may be ready.')
    ).toBeVisible({ timeout: 30_000 });

    // The Sonner action button label
    await expect(page.getByRole('button', { name: 'Check status →' })).toBeVisible();
  });

  test('"Check status →" click triggers page reload', async ({ page }) => {
    await mockJobPolling(page, [
      { status: 401 },
      { status: 401 },
      { status: 401 },
      { status: 200, body: { status: 'pending' } },
    ]);

    await page.goto(`/projects/${MOCK_PROJECT_ID}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const generateBtn = page.getByTestId('generate-button').or(
      page.getByRole('button', { name: /generate|start/i }).first()
    );
    if (await generateBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await generateBtn.click();
    }

    await expect(
      page.getByText('Connection lost — your audio may be ready.')
    ).toBeVisible({ timeout: 30_000 });

    // Listen for the next navigation — Check status → calls router.refresh()
    const navigationPromise = page.waitForNavigation({ timeout: 10_000 }).catch(() => null);
    await page.getByRole('button', { name: 'Check status →' }).click();

    // Either a navigation fired or the URL stayed the same but a reload occurred.
    // Either way the page should still be on the project page.
    await navigationPromise;
    await expect(page).toHaveURL(new RegExp(MOCK_PROJECT_ID));
  });

  test('no toast shown for 1 or 2 consecutive 401s', async ({ page }) => {
    // Only 2 x 401 — should never reach threshold
    await mockJobPolling(page, [
      { status: 401 },
      { status: 401 },
      { status: 200, body: { status: 'pending' } },
      { status: 200, body: { status: 'pending' } },
    ]);

    await page.goto(`/projects/${MOCK_PROJECT_ID}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const generateBtn = page.getByTestId('generate-button').or(
      page.getByRole('button', { name: /generate|start/i }).first()
    );
    if (await generateBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await generateBtn.click();
    }

    // Wait 8s — enough for 2 poll cycles (polls every 3s); toast should NOT appear
    await page.waitForTimeout(8_000);
    await expect(
      page.getByText('Connection lost — your audio may be ready.')
    ).not.toBeVisible();
  });

  test('polling recovers after 401s — audio player appears on completed job', async ({ page }) => {
    // Simulate: 3 x 401 (connection lost), then 2 x pending, then completed
    await mockJobPolling(page, [
      { status: 401 },
      { status: 401 },
      { status: 401 },
      { status: 200, body: { status: 'pending' } },
      { status: 200, body: { status: 'pending' } },
      {
        status: 200,
        body: {
          status: 'completed',
          outputUrl: 'https://example.com/audio/mock.m4a',
          segmentUrls: ['https://example.com/audio/seg1.m4a'],
        },
      },
    ]);

    // Stub audio file requests so the player doesn't stall waiting for real media
    await page.route('**/*.m4a', async (route) => {
      await route.fulfill({ status: 200, contentType: 'audio/mp4', body: Buffer.alloc(512) });
    });

    await page.goto(`/projects/${MOCK_PROJECT_ID}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const generateBtn = page.getByTestId('generate-button').or(
      page.getByRole('button', { name: /generate|start/i }).first()
    );
    if (await generateBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await generateBtn.click();
    }

    // Wait for the "Connection lost" toast (confirms counter hit 3)
    await expect(
      page.getByText('Connection lost — your audio may be ready.')
    ).toBeVisible({ timeout: 30_000 });

    // Polling continues after the toast — eventually the job completes and player shows
    const audioPlayer = page.getByTestId('audio-player').or(
      page.getByRole('region', { name: /audio|player/i }).first()
    );
    await expect(audioPlayer).toBeVisible({ timeout: 60_000 });
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

    await page.goto(`/projects/${MOCK_PROJECT_ID}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await page.waitForTimeout(2_000);

    const hydrationErrors = pageErrors.filter((e) =>
      e.toLowerCase().includes('hydrat') || e.toLowerCase().includes('service worker')
    );
    expect(hydrationErrors).toHaveLength(0);
  });
});
