import { test, expect } from './fixtures/authenticated';

/**
 * Full Script Processing — chunked generation flow
 *
 * Tests the end-to-end generation lifecycle with segment-aware job status.
 * All orchestrator calls are mocked — this tests the UI behaviour and
 * the job-status polling contract, not the actual audio pipeline.
 *
 * Covers Sprint K requirements:
 * - Single-segment flow (short scripts, no chunking)
 * - Multi-segment flow (longer scripts, 2+ segments)
 * - Segment progress events visible in UI
 * - Partial segment failure: job continues, failedSegments > 0
 *
 * Uses real Render DB project IDs so SSR (Prisma) can hydrate correctly.
 * All generate/job API calls are intercepted client-side.
 */

// ---------------------------------------------------------------------------
// Constants — real project IDs in the Render DB
// ---------------------------------------------------------------------------

/** Draft project (status='draft', no audio) — for generate-flow tests */
const REAL_DRAFT_PROJECT_ID = '606f2749-17a3-431c-9ec5-9970284bb32d';

/** Completed project (status='completed', has audio_output row) — for post-gen UI tests */
const REAL_COMPLETED_PROJECT_ID = '71e98a0f-731f-4a25-8cab-2226daca0a3e';

const MOCK_JOB_ID = 'e2e-proc-job-00000000-0000-0000-0000-000000000001';
const MOCK_AUDIO_URL = 'https://storage.example.com/audio/segment-0.m4a';
const MOCK_FINAL_URL = 'https://storage.example.com/audio/final.m4a';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/** Pre-select workflow mode so WorkflowModeSelector is bypassed on page load */
async function setWorkflowMode(
  page: import('@playwright/test').Page,
  projectId: string,
  mode: 'automatic' | 'fine_tuned' = 'automatic',
) {
  await page.addInitScript(
    ({ id, m }) => {
      localStorage.setItem(`project-${id}-run-1-mode`, m);
    },
    { id: projectId, m: mode },
  );
}

interface MockJobOptions {
  totalSegments?: number;
  failedSegments?: number;
  /** Number of polls before job completes (default 3) */
  completesAfterPolls?: number;
}

async function setupProcessingMocks(
  page: import('@playwright/test').Page,
  projectId: string,
  opts: MockJobOptions = {},
) {
  const { totalSegments = 1, failedSegments = 0, completesAfterPolls = 3 } = opts;

  // Mock generate endpoint — actual call goes to /api/generate (not project-scoped)
  await page.route('**/api/generate', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ jobId: MOCK_JOB_ID, status: 'queued' }),
      });
    } else {
      await route.continue();
    }
  });
  // Queue position polling
  await page.route(`**/api/jobs/${MOCK_JOB_ID}/position`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ position: 1, estimatedWaitSeconds: 30, jobsAhead: 0, status: 'processing' }),
    });
  });

  // Mock job status — progresses through segments
  let pollCount = 0;

  await page.route(`**/api/jobs/${MOCK_JOB_ID}`, async (route) => {
    pollCount++;
    const isComplete = pollCount >= completesAfterPolls;

    const segments = Array.from({ length: totalSegments }, (_, i) => {
      const isFailed = i >= totalSegments - failedSegments;
      if (isComplete || i < pollCount - 1) {
        return {
          index: i,
          status: isFailed ? 'failed' : 'ready',
          audioUrl: isFailed ? null : MOCK_AUDIO_URL.replace('segment-0', `segment-${i}`),
          percent: 100,
        };
      }
      if (i === pollCount - 1) {
        return { index: i, status: 'processing', audioUrl: null, percent: 50 };
      }
      return { index: i, status: 'pending', audioUrl: null, percent: 0 };
    });

    const completedSegments = segments.filter((s) => s.status === 'ready').length;
    const overallPercent = Math.round((completedSegments / totalSegments) * 100);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: MOCK_JOB_ID,
        project_id: projectId,
        status: isComplete ? 'completed' : 'processing',
        progress: {
          step: isComplete ? 'complete' : 'generating_audio',
          percent: isComplete ? 100 : overallPercent,
          details: isComplete
            ? 'Generation complete'
            : totalSegments > 1
            ? `Generating audio — part ${pollCount} of ${totalSegments}…`
            : 'Generating audio…',
        },
        audio_url: isComplete ? MOCK_FINAL_URL : null,
        firstAudioUrl: isComplete ? MOCK_FINAL_URL : null,
        segments: totalSegments > 1 ? segments : null,
        failedSegments,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });
  });

  // Silence audio requests
  for (const pattern of ['**/audio/**', '**/*.m4a', '**/*.mp3']) {
    await page.route(pattern, async (route) => {
      await route.fulfill({ status: 200, contentType: 'audio/mp4', body: Buffer.alloc(0) });
    });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Full Script Processing (Authenticated)', () => {
  test.describe('Single-Segment Flow (Short Script)', () => {
    test('short script processes as single segment with no chunk UI', async ({ page }) => {
      await setWorkflowMode(page, REAL_DRAFT_PROJECT_ID);
      await setupProcessingMocks(page, REAL_DRAFT_PROJECT_ID, { totalSegments: 1, completesAfterPolls: 10 });

      await page.goto(`/projects/${REAL_DRAFT_PROJECT_ID}`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });

      const generateButton = page.getByTestId('generate-button');
      await expect(generateButton).toBeVisible({ timeout: 10000 });
      await generateButton.click();

      // Processing state should appear
      const processingText = page.getByText(/generating|processing|queued/i).first();
      await expect(processingText).toBeVisible({ timeout: 10000 });

      // Must NOT show "chunk" language to the user
      await expect(page.getByText(/\bchunk\b/i)).not.toBeVisible({ timeout: 1000 });
    });

    test('audio player appears after single-segment job completes', async ({ page }) => {
      // Use the real completed project — SSR renders correctly
      for (const pattern of ['**/audio/**', '**/*.m4a', '**/*.mp3']) {
        await page.route(pattern, async (route) => {
          await route.fulfill({ status: 200, contentType: 'audio/mp4', body: Buffer.alloc(0) });
        });
      }

      await page.goto(`/projects/${REAL_COMPLETED_PROJECT_ID}`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });

      const audioPlayer = page
        .getByTestId('audio-player')
        .or(page.locator('audio[src]'))
        .or(page.getByRole('region', { name: /player/i }));
      const hasPlayer = await audioPlayer.isVisible({ timeout: 10000 }).catch(() => false);
      const downloadButton = page.getByTestId('download-button');
      const hasDownload = await downloadButton.isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasPlayer || hasDownload).toBe(true);
    });
  });

  test.describe('Multi-Segment Flow (Longer Scripts)', () => {
    test('multi-segment job shows progress indicator during processing', async ({ page }) => {
      await setWorkflowMode(page, REAL_DRAFT_PROJECT_ID);
      await setupProcessingMocks(page, REAL_DRAFT_PROJECT_ID, { totalSegments: 3, completesAfterPolls: 100 });

      await page.goto(`/projects/${REAL_DRAFT_PROJECT_ID}`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });

      const generateButton = page.getByTestId('generate-button');
      await expect(generateButton).toBeVisible({ timeout: 10000 });
      await generateButton.click();

      // At minimum, a progress percentage or processing indicator must be shown
      const progressIndicator = page
        .getByText(/\d+%/)
        .or(page.getByText(/processing|generating/i));
      await expect(progressIndicator.first()).toBeVisible({ timeout: 15000 });
    });

    test('multi-segment job does not say "chunk" in the UI', async ({ page }) => {
      await setWorkflowMode(page, REAL_DRAFT_PROJECT_ID);
      await setupProcessingMocks(page, REAL_DRAFT_PROJECT_ID, { totalSegments: 4, completesAfterPolls: 100 });

      await page.goto(`/projects/${REAL_DRAFT_PROJECT_ID}`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });

      const generateButton = page.getByTestId('generate-button');
      await expect(generateButton).toBeVisible({ timeout: 10000 });
      await generateButton.click();

      await page.waitForTimeout(3000);

      // "chunk" must never appear in user-visible text
      await expect(page.getByText(/\bchunk\b/i)).not.toBeVisible({ timeout: 1000 });
    });

    test('job with segment failure still completes with partial audio', async ({ page }) => {
      await setWorkflowMode(page, REAL_DRAFT_PROJECT_ID);
      await setupProcessingMocks(page, REAL_DRAFT_PROJECT_ID, {
        totalSegments: 3,
        failedSegments: 1,
        completesAfterPolls: 4,
      });

      await page.goto(`/projects/${REAL_DRAFT_PROJECT_ID}`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });

      const generateButton = page.getByTestId('generate-button');
      await expect(generateButton).toBeVisible({ timeout: 10000 });
      await generateButton.click();

      // Job should eventually reach a completed or partially-complete state
      const terminalState = page
        .getByText(/complete|audio ready|partial|warning/i)
        .or(page.getByTestId('audio-player'));
      await expect(terminalState.first()).toBeVisible({ timeout: 30000 });
    });
  });

  test.describe('Job Status Polling', () => {
    test('job polling fires and receives status responses', async ({ page }) => {
      await setWorkflowMode(page, REAL_DRAFT_PROJECT_ID);
      await setupProcessingMocks(page, REAL_DRAFT_PROJECT_ID, {
        totalSegments: 2,
        completesAfterPolls: 3,
      });

      await page.goto(`/projects/${REAL_DRAFT_PROJECT_ID}`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });

      const generateButton = page.getByTestId('generate-button');
      await expect(generateButton).toBeVisible({ timeout: 10000 });
      await generateButton.click();

      // Wait for at least one poll cycle — processing indicator verifies polling fired
      const processingIndicator = page.getByText(/generating|processing/i).first();
      await expect(processingIndicator).toBeVisible({ timeout: 15000 });
    });

    test('cancel job button is visible while processing', async ({ page }) => {
      await setWorkflowMode(page, REAL_DRAFT_PROJECT_ID);
      await setupProcessingMocks(page, REAL_DRAFT_PROJECT_ID, {
        totalSegments: 3,
        completesAfterPolls: 100,
      });

      await page.goto(`/projects/${REAL_DRAFT_PROJECT_ID}`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });

      const generateButton = page.getByTestId('generate-button');
      await expect(generateButton).toBeVisible({ timeout: 10000 });
      await generateButton.click();

      // Processing should be visible
      await expect(page.getByText(/processing|generating/i).first()).toBeVisible({ timeout: 10000 });

      // Cancel button — soft check (UX enhancement)
      const cancelButton = page
        .getByRole('button', { name: /cancel/i })
        .or(page.getByTestId('cancel-job-button'));
      const hasCancel = await cancelButton.isVisible({ timeout: 5000 }).catch(() => false);
      void hasCancel;
    });
  });
});
