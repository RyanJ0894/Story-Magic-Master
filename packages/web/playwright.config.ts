import { defineConfig, devices } from '@playwright/test';
import path from 'path';

// Path to save/load authentication state
const authFile = path.join(__dirname, 'e2e/.auth/user.json');

/**
 * Playwright E2E Test Configuration for Story Magic
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  /* clerkSetup() is called in globalSetup so CLERK_FAPI + CLERK_TESTING_TOKEN
     are available to all worker processes before any test runs. */
  globalSetup: './e2e/global-setup',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  /* Shared settings for all projects */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:22000',
    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Configure projects */
  projects: [
    // Setup project - runs auth once
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // Unauthenticated tests (login, signup, etc.)
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [/auth\.setup\.ts/, /\.authenticated\.spec\.ts/],
    },

    // Authenticated tests - depend on setup
    {
      name: 'chromium-authenticated',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      testMatch: /\.(authenticated)\.spec\.ts/,
    },

    // Firefox (unauthenticated only for now)
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: [/auth\.setup\.ts/, /\.authenticated\.spec\.ts/],
    },

    // Safari (unauthenticated only for now)
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: [/auth\.setup\.ts/, /\.authenticated\.spec\.ts/],
    },

    // Mobile Chrome
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      testIgnore: [/auth\.setup\.ts/, /\.authenticated\.spec\.ts/],
    },

    // Mobile Safari
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
      testIgnore: [/auth\.setup\.ts/, /\.authenticated\.spec\.ts/],
    },
  ],

  /* Run local dev server before starting tests, unless targeting an external URL */
  ...(process.env.PLAYWRIGHT_BASE_URL && !process.env.PLAYWRIGHT_BASE_URL.includes('localhost')
    ? {}
    : {
        webServer: {
          command: 'pnpm dev',
          url: 'http://localhost:22000',
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
        },
      }),
});
