import { test as base } from '@playwright/test';
import { setupClerkTestingToken, clerk } from '@clerk/testing/playwright';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || '';

/**
 * Authenticated Playwright fixture.
 *
 * Wraps the default `page` so that every test:
 * 1. Registers the Clerk FAPI route interceptor (bypasses bot protection)
 * 2. Ensures a fresh __session JWT exists before the test runs
 *
 * Clerk's __session JWTs expire after 60 seconds. With fullyParallel: true,
 * tests running >60s after auth.setup.ts will hit the expired JWT and land on
 * the sign-in page. This fixture calls clerk.signIn() to create a fresh
 * session; if the storageState already has a valid session it catches the
 * "already signed in" error and continues — the storageState session is used.
 *
 * Usage — replace the standard import in .authenticated.spec.ts files:
 *   import { test, expect } from '../fixtures/authenticated';
 */
export const test = base.extend<object>({
  page: async ({ page }, use) => {
    await setupClerkTestingToken({ page });

    // Always navigate to root so the page has a valid origin — tests that use
    // page.evaluate() with fetch() need a non-null base URL regardless of auth.
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    if (TEST_EMAIL) {
      try {
        await clerk.signIn({ page, emailAddress: TEST_EMAIL });
      } catch (err) {
        // Ignore "already signed in" — storageState has a valid session
        if (!(err as Error).message?.includes('already signed in')) {
          throw err;
        }
      }
    }

    await use(page);
  },
});

export { expect } from '@playwright/test';
