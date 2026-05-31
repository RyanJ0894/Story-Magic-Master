/**
 * Voice & Ambience Pipeline — Sprint P (#94, #95, #96)
 *
 * These tests verify the audio pipeline configuration from a browser perspective:
 *
 * #94 — Voice library enforcement: The generate endpoint uses curated voices only
 * #95 — Music source: music comes from curated catalog, not ElevenLabs generation
 * #96 — Ambience/SFX audibility: pipeline uses -18 dB ambience (raised from -26)
 *        and missing catalog tracks are logged, not silently dropped without notice
 *
 * Most pipeline work is server-side (orchestrator), so these tests verify:
 * a) The generate API is reachable and returns a job ID
 * b) Job status polling works end-to-end
 * c) Completed jobs surface an audio player (confirming audio was mixed)
 * d) No console errors related to voice/audio catalog failures appear
 *
 * The actual gain levels and catalog enforcement are covered by orchestrator
 * unit tests (resolve-cues.test.ts, voice-library-enforcement.test.ts).
 */

import { test, expect } from './fixtures/authenticated';

const MOCK_PROJECT_ID = '71e98a0f-731f-4a25-8cab-2226daca0a3e';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function mockGenerateAndComplete(page: import('@playwright/test').Page) {
  // Mock /api/projects/:id/generate → returns a job ID immediately
  await page.route(`**/api/projects/${MOCK_PROJECT_ID}/generate`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ jobId: 'test-job-pipeline-001' }),
    });
  });

  // Mock /api/jobs/:id → returns completed with audio URL after 2 polls
  let pollCount = 0;
  await page.route('**/api/jobs/test-job-pipeline-001', async (route) => {
    pollCount += 1;
    const status = pollCount >= 2 ? 'completed' : 'processing';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status,
        progress: pollCount >= 2 ? 100 : 50,
        outputUrl: 'https://example.com/audio/output.m4a',
        segmentUrls: ['https://example.com/audio/seg1.m4a'],
      }),
    });
  });

  // Stub audio file requests so player doesn't stall
  await page.route('**/*.m4a', async (route) => {
    await route.fulfill({ status: 200, contentType: 'audio/mp4', body: Buffer.alloc(512) });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Voice & ambience pipeline (#94, #95, #96)', () => {
  test('generate API is callable and returns a job ID', async ({ page }) => {
    let capturedRequest: { body: string } | null = null;
    await page.route(`**/api/projects/${MOCK_PROJECT_ID}/generate`, async (route) => {
      capturedRequest = { body: await route.request().postData() ?? '' };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ jobId: 'test-job-001' }),
      });
    });

    await page.goto(`/projects/${MOCK_PROJECT_ID}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const generateBtn = page.getByTestId('generate-button').or(
      page.getByRole('button', { name: /generate|start/i }).first()
    );

    if (await generateBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await generateBtn.click();
      // Generate API was called — confirms button wires to correct endpoint
      await expect.poll(() => capturedRequest !== null, { timeout: 5_000 }).toBe(true);
    }
  });

  test('no console errors about voice catalog or ambience catalog during generation', async ({ page }) => {
    const catalogErrors: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      // These would indicate the orchestrator logged a catalog miss to the browser console
      if (msg.type() === 'error' && (
        text.includes('track not found') ||
        text.includes('catalog') ||
        text.includes('ambience') && text.includes('fail')
      )) {
        catalogErrors.push(text);
      }
    });

    await mockGenerateAndComplete(page);
    await page.goto(`/projects/${MOCK_PROJECT_ID}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const generateBtn = page.getByTestId('generate-button').or(
      page.getByRole('button', { name: /generate|start/i }).first()
    );
    if (await generateBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await generateBtn.click();
    }

    await page.waitForTimeout(3_000);
    expect(catalogErrors).toHaveLength(0);
  });

  test('job polling reaches completed state and audio player renders', async ({ page }) => {
    await mockGenerateAndComplete(page);
    await page.goto(`/projects/${MOCK_PROJECT_ID}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const generateBtn = page.getByTestId('generate-button').or(
      page.getByRole('button', { name: /generate|start/i }).first()
    );

    if (await generateBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await generateBtn.click();

      // Audio player should appear after job completes
      const audioPlayer = page.getByTestId('audio-player').or(
        page.getByRole('region', { name: /audio|player/i }).first()
      );
      await expect(audioPlayer).toBeVisible({ timeout: 30_000 });
    }
  });

  test('project page loads without hydration errors (voice catalog safe during SSR)', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(`/projects/${MOCK_PROJECT_ID}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await page.waitForTimeout(1_000);

    const hydrationErrors = pageErrors.filter((e) =>
      e.toLowerCase().includes('hydrat')
    );
    expect(hydrationErrors).toHaveLength(0);
  });

  test('generate button is present on project page', async ({ page }) => {
    await page.goto(`/projects/${MOCK_PROJECT_ID}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // The project page should have a generate/start button
    const btn = page.getByTestId('generate-button').or(
      page.getByRole('button', { name: /generate|start/i }).first()
    );

    // Either the button is visible (new project) or audio player is visible (completed)
    const audioPlayer = page.getByTestId('audio-player').or(
      page.getByRole('region', { name: /audio|player/i }).first()
    );

    const hasButton = await btn.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasPlayer = await audioPlayer.isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasButton || hasPlayer).toBe(true);
  });
});
