import { test as setup } from '@playwright/test';
import { setupClerkTestingToken, clerk } from '@clerk/testing/playwright';
import path from 'path';

// Email address of the dedicated E2E test account in Clerk.
// The account must exist in your Clerk instance.
// Required env vars: E2E_TEST_EMAIL + CLERK_SECRET_KEY (already in Doppler dev).
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || '';

const authFile = path.join(__dirname, '.auth/user.json');

/**
 * Authenticates using @clerk/testing — no UI interaction required.
 * Flow:
 *   1. setupClerkTestingToken registers a route interceptor on the FAPI
 *   2. clerk.signIn looks up the user by email via Clerk Backend API,
 *      mints a sign-in token, and executes the ticket strategy client-side
 *   3. Storage state (cookies + localStorage) is saved for reuse
 *
 * Skip gracefully when E2E_TEST_EMAIL is absent so unauthenticated tests
 * still run in environments without credentials configured.
 */
setup('authenticate', async ({ page, context }) => {
  if (!TEST_EMAIL) {
    console.warn('⚠️  E2E_TEST_EMAIL not set — skipping authenticated setup');
    setup.skip();
    return;
  }

  // Intercept Clerk FAPI calls to inject the testing token (bypasses bot checks).
  await setupClerkTestingToken({ page });

  // Navigate to the app so Clerk initialises in the browser.
  await page.goto('/');

  // Sign in using a server-minted sign-in token (no password needed).
  await clerk.signIn({ page, emailAddress: TEST_EMAIL });

  // Navigate to dashboard to confirm the session is active.
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle', { timeout: 30_000 });

  // Persist auth state for all .authenticated.spec.ts tests.
  await context.storageState({ path: authFile });

  console.log('✅ Clerk auth state saved to:', authFile);
});
