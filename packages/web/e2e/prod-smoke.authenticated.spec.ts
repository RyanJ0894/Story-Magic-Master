/**
 * Production smoke E2E — AUTH + FULL_GENERATION layers
 * =====================================================
 *
 * Authenticated end-to-end checks against a running prod (or staging)
 * deployment. The public layer lives in `prod-smoke-public.spec.ts` and
 * runs without auth.
 *
 * Layers (each gated by env):
 *
 *   1. AUTH            — Clerk session, dashboard renders. Runs when
 *                        E2E_TEST_EMAIL is set (and CLERK_SECRET_KEY in
 *                        env so @clerk/testing can mint sign-in tokens
 *                        for the *target* Clerk instance — production
 *                        Clerk if running against prod).
 *   2. FULL_GENERATION — creates a real project, kicks off real audio
 *                        generation, polls for completion, asserts an
 *                        audio output exists. Runs ONLY when
 *                        E2E_PROD_FULL_GENERATION=true. Costs roughly
 *                        $0.05–$0.15 per run (Anthropic + ElevenLabs).
 *                        Default: skipped.
 *
 * Run against prod (auth only):
 *   E2E_TEST_EMAIL=... CLERK_SECRET_KEY=<prod sk_live_…> \
 *   PLAYWRIGHT_BASE_URL=https://www.storymagicapp.net \
 *     pnpm --filter @story-magic/web exec playwright test \
 *     --project=chromium-authenticated e2e/prod-smoke.authenticated.spec.ts
 *
 * Or use the convenience script: `./scripts/e2e-prod.sh`.
 */

import { test, expect } from './fixtures/authenticated';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const RUN_FULL_GENERATION = process.env.E2E_PROD_FULL_GENERATION === 'true';
const HAS_TEST_EMAIL = !!process.env.E2E_TEST_EMAIL;

/** Minimal 1-page script — keeps generation cost ~$0.05 when FULL_GENERATION runs. */
const TINY_SCRIPT = `INT. KITCHEN - MORNING

ANNA pours coffee. She looks tired but resolved.

ANNA
Today is the day. No more waiting.

She picks up her keys and walks out the door.

FADE OUT.`;

// ─────────────────────────────────────────────────────────────────────────────
// Layer 1: AUTH
// ─────────────────────────────────────────────────────────────────────────────

test.describe('prod smoke — authenticated', () => {
  test.skip(!HAS_TEST_EMAIL, 'E2E_TEST_EMAIL not set — skipping authenticated layer');

  test('dashboard renders for authenticated user', async ({ page }) => {
    await page.goto('/dashboard');
    // Dashboard route is protected; if Clerk is broken we end up at /login,
    // which is a clear failure signal.
    await page.waitForLoadState('networkidle', { timeout: 30_000 });
    expect(page.url(), 'dashboard redirected — auth likely broken').not.toContain('/login');
  });

  test('writer dashboard reachable', async ({ page }) => {
    await page.goto('/writer/dashboard');
    await page.waitForLoadState('networkidle', { timeout: 30_000 });
    expect(page.url()).not.toContain('/login');
  });

  test('new-project form loads (no submission)', async ({ page }) => {
    await page.goto('/projects/new');
    await page.waitForLoadState('networkidle', { timeout: 30_000 });
    expect(page.url()).not.toContain('/login');
    // The form is heavy and React-rendered; just confirm one stable input
    // is present so we know hydration ran.
    await expect(
      page.locator('input, textarea, [contenteditable]').first(),
    ).toBeVisible({ timeout: 20_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 2: FULL_GENERATION (opt-in, costs money)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('prod smoke — full generation (opt-in)', () => {
  test.skip(!RUN_FULL_GENERATION, 'E2E_PROD_FULL_GENERATION!=true — skipping paid generation');
  test.skip(!HAS_TEST_EMAIL, 'E2E_TEST_EMAIL required for full-generation layer');

  // Pipeline can legitimately take 90+ s on a tiny script (cold whisper.cpp
  // path, voice assignment tool calls, TTS). 5 min is a generous ceiling.
  test.setTimeout(5 * 60_000);

  test('end-to-end: create project → generate → audio output exists', async ({ page, request }) => {
    // 1) Authenticated create-project via the same API the UI uses. Bypassing
    //    the UI keeps the test deterministic — UI selectors drift across deploys.
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle', { timeout: 30_000 });

    const projectName = `e2e-smoke-${Date.now()}`;

    const createRes = await page.request.post('/api/projects', {
      data: { name: projectName, scriptText: TINY_SCRIPT },
      headers: { 'X-Requested-With': 'story-magic' },
    });
    expect(createRes.status(), `create-project HTTP status`).toBeLessThan(400);
    const created = await createRes.json();
    const projectId: string = created.id ?? created.project?.id;
    expect(projectId, 'create-project response missing id').toBeTruthy();
    console.log(`[prod-smoke] created project ${projectId}`);

    // 2) Kick off generation via the same endpoint the UI's generate-button
    //    posts to (POST /api/generate → returns { jobId }). Script text is
    //    already attached to the project from step 1, so we only pass
    //    projectId + workflowMode.
    const jobRes = await page.request.post('/api/generate', {
      data: { projectId, workflowMode: 'automatic' },
      headers: { 'X-Requested-With': 'story-magic' },
    });
    expect(jobRes.status(), 'POST /api/generate HTTP status').toBeLessThan(400);
    const job = await jobRes.json();
    const jobId: string = job.jobId ?? job.id;
    expect(jobId, 'POST /api/generate response missing jobId').toBeTruthy();
    console.log(`[prod-smoke] queued job ${jobId}`);

    // 3) Poll for completion. Job lifecycle: queued → processing → completed.
    const POLL_INTERVAL_MS = 5_000;
    const DEADLINE = Date.now() + 4.5 * 60_000;
    let status = 'pending';
    let lastBody: Record<string, unknown> = {};
    while (Date.now() < DEADLINE) {
      const statusRes = await page.request.get(`/api/jobs/${jobId}`);
      if (statusRes.ok()) {
        lastBody = await statusRes.json();
        status = (lastBody.status as string) ?? status;
        console.log(`[prod-smoke] job ${jobId} status=${status}`);
        if (status === 'completed' || status === 'failed') break;
      }
      await page.waitForTimeout(POLL_INTERVAL_MS);
    }
    expect(status, `job did not complete within 4.5 min (last body: ${JSON.stringify(lastBody).slice(0, 200)})`).toBe('completed');

    // 4) Verify an audio output was produced. The job response surfaces the
    //    first completed audio URL at top-level `audio_url` and the
    //    pre-completion segment URL at `firstAudioUrl`. Either being a
    //    non-empty string is sufficient evidence the pipeline wrote to S3.
    const audioUrl = (lastBody.audio_url as string | null) ?? (lastBody.firstAudioUrl as string | null);
    expect(audioUrl, 'completed job has no audio_url or firstAudioUrl').toBeTruthy();
    expect(audioUrl!.length, 'audio_url is empty').toBeGreaterThan(0);
    console.log(`[prod-smoke] verified audio_url for job ${jobId}: ${audioUrl}`);
  });
});
