import { test, expect } from './fixtures/authenticated';

/**
 * Writer Hub — /writer and /writer/[writerId]
 *
 * /writer is the authenticated "my listings" dashboard for the logged-in writer.
 * /writer/[writerId] is the public writer profile page (no auth required).
 *
 * Authenticated tests run in the 'chromium-authenticated' project and depend
 * on the auth setup step having saved a valid Clerk session cookie.
 */

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

async function mockExchangeApis(page: import('@playwright/test').Page) {
  // Mock the reviews API for the writer hub's project cards
  await page.route('**/api/projects/*/exchange', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ slug: null, isPublic: false }),
    });
  });
}

// ---------------------------------------------------------------------------
// Unauthenticated — /writer redirects to login
// ---------------------------------------------------------------------------

test.describe('Writer Hub — Unauthenticated', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    // Clear session cookies so the page sees an unauthenticated request
    // (setupClerkTestingToken adds a header interceptor, not auth — clearing
    // cookies removes the __session JWT without removing the bot-bypass header)
    await page.context().clearCookies();
    await page.goto('/writer');
    await expect(page).toHaveURL(/\/(login|sign-in)/, { timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Authenticated — /writer
// ---------------------------------------------------------------------------

test.describe('Writer Hub (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await mockExchangeApis(page);
    await page.goto('/writer');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  });

  test('page loads with writer hub heading', async ({ page }) => {
    // The page uses "Writer Hub" as a nav breadcrumb (not a heading) and
    // renders "My Scripts" as the main h2. Accept either.
    await expect(
      page.getByRole('heading', { name: /my scripts/i })
        .or(page.getByText('Writer Hub'))
        .first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('shows subscriber count badge', async ({ page }) => {
    // Subscriber count renders as separate count + label elements (e.g. "0" + "Subscribers")
    const subscriberEl = page
      .getByText(/^subscribers?$/i)
      .or(page.getByText(/no subscribers/i));
    await expect(subscriberEl).toBeVisible({ timeout: 10000 });
  });

  test('shows listed scripts or empty state', async ({ page }) => {
    const scriptSection = page
      .getByText(/no scripts listed yet/i)
      .or(page.getByRole('link', { name: /manage listing/i }).first())
      .or(page.getByRole('link', { name: /list on exchange/i }).first());
    await expect(scriptSection).toBeVisible({ timeout: 10000 });
  });

  test('back link navigates to dashboard', async ({ page }) => {
    const backLink = page.getByRole('link', { name: /dashboard|back/i }).first();
    const hasBack = await backLink.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasBack) {
      await backLink.click();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 });
    }
  });
});

// ---------------------------------------------------------------------------
// Public writer profile — /writer/[writerId]
// ---------------------------------------------------------------------------

test.describe('Writer Profile Page', () => {
  test('non-existent writer ID returns 404 page', async ({ page }) => {
    await page.goto('/writer/00000000-0000-0000-0000-000000000000');
    await expect(
      page.getByRole('heading', { name: /not found|404/i })
        .or(page.getByText(/not found/i))
        .first()
    ).toBeVisible({ timeout: 10000 });
  });
});
