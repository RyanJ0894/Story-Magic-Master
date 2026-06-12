/**
 * Production smoke — PUBLIC layer
 * ================================
 *
 * No authentication required. Runs under the `chromium` project (no
 * auth.setup.ts dependency), so it works against prod even when no
 * E2E_TEST_EMAIL / CLERK_SECRET_KEY is configured for prod Clerk.
 *
 * The authenticated + paid-generation layers live in
 * `prod-smoke.authenticated.spec.ts` and require Clerk creds for the
 * target environment (prod Clerk if PLAYWRIGHT_BASE_URL points at prod).
 *
 * Run:
 *   PLAYWRIGHT_BASE_URL=https://www.storymagicapp.net \
 *     pnpm --filter @story-magic/web exec playwright test \
 *     --project=chromium e2e/prod-smoke-public.spec.ts
 *
 * Or via the wrapper: `./scripts/e2e-prod.sh`.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://www.storymagicapp.net';

test.describe('prod smoke — public surface', () => {
  test('homepage 200s and renders product copy', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response?.status(), `${BASE_URL} returned non-2xx`).toBeLessThan(400);
    await expect(page.locator('body')).toContainText(/story\s*magic/i, { timeout: 15_000 });
  });

  test('pricing page renders', async ({ page }) => {
    const response = await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('body')).toContainText(/pricing|plan/i, { timeout: 15_000 });
  });

  test('login route is reachable and serves Clerk', async ({ page }) => {
    const response = await page.goto('/login', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(400);
  });
});
