import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright E2E configuration for the DEPLOYED environment.
 *
 * Run with:
 *   pnpm --filter @story-magic/web test:e2e:prod
 *
 * Optionally provide authenticated test credentials:
 *   E2E_TEST_EMAIL=user@example.com E2E_TEST_PASSWORD=secret pnpm ...
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://story-magic-web.onrender.com';
const authFile = path.join(__dirname, 'e2e/.auth/user.json');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,   // sequential against prod to avoid hammering the server
  forbidOnly: true,
  retries: 1,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report-prod', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Longer timeouts for remote server cold starts
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // Auth setup — skips gracefully if no credentials provided
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // Unauthenticated tests — run on Chromium only for speed
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [/auth\.setup\.ts/, /\.authenticated\.spec\.ts/],
    },

    // Authenticated tests — depend on setup, only if credentials provided
    {
      name: 'chromium-authenticated',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      testMatch: /\.authenticated\.spec\.ts/,
    },
  ],

  // No webServer — tests run against the already-deployed service
});
