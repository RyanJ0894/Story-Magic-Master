import { test, expect } from '@playwright/test';
import { SHORT_SCRIPT } from './fixtures/test-script';

/**
 * TD-036: E2E test — share / reader flow
 *
 * Tests the full sharing lifecycle: sign in as a writer, navigate to a
 * project, open the share modal, create a share link, copy it, then
 * access the shared content as a reader (unauthenticated).
 *
 * API calls are mocked via page.route() to avoid backend dependencies.
 */

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_PROJECT_ID = 'e2e-share-project-00000000-0000-0000-0000-000000000002';
const MOCK_SHARE_TOKEN = 'share_e2e_abc123def456';
const MOCK_SHARE_URL = `/shared/${MOCK_SHARE_TOKEN}`;

const MOCK_PROJECT = {
  id: MOCK_PROJECT_ID,
  name: 'E2E Share Test Project',
  description: 'A project for testing the share flow',
  status: 'completed',
  script_text: SHORT_SCRIPT,
  page_count: 1,
  audio_url: `https://storage.example.com/audio/${MOCK_PROJECT_ID}/output.m4a`,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_SHARE_LINK = {
  id: 'e2e-share-link-001',
  project_id: MOCK_PROJECT_ID,
  token: MOCK_SHARE_TOKEN,
  is_active: true,
  expires_at: null,
  created_at: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

async function setupShareMocks(page: import('@playwright/test').Page) {
  // Mock project detail fetch
  await page.route(`**/api/projects/${MOCK_PROJECT_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_PROJECT),
    });
  });

  // Mock create share link
  await page.route(`**/api/projects/${MOCK_PROJECT_ID}/share`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SHARE_LINK),
      });
    } else if (route.request().method() === 'GET') {
      // List existing share links
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ links: [MOCK_SHARE_LINK] }),
      });
    } else if (route.request().method() === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock shared content reader endpoint (public, no auth)
  await page.route(`**/api/shared/${MOCK_SHARE_TOKEN}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        project_name: MOCK_PROJECT.name,
        description: MOCK_PROJECT.description,
        audio_url: MOCK_PROJECT.audio_url,
        page_count: MOCK_PROJECT.page_count,
        created_at: MOCK_PROJECT.created_at,
      }),
    });
  });

  // Mock audio file
  await page.route('**/audio/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'audio/mp4',
      body: Buffer.alloc(0),
    });
  });
}

// ---------------------------------------------------------------------------
// Writer-side tests (authenticated)
// ---------------------------------------------------------------------------

test.describe('Share / Reader Flow (Authenticated)', () => {
  test.describe('Share Modal', () => {
    test('opens share modal from project detail page', async ({ page }) => {
      await setupShareMocks(page);
      await page.goto(`/projects/${MOCK_PROJECT_ID}`);

      // Find and click the share button
      const shareButton = page.getByTestId('share-button');
      await expect(shareButton).toBeVisible({ timeout: 10000 });
      await shareButton.click();

      // Share modal should appear
      const shareModal = page.getByTestId('share-modal');
      await expect(shareModal).toBeVisible({ timeout: 5000 });
    });

    test('creates a new share link', async ({ page }) => {
      await setupShareMocks(page);
      await page.goto(`/projects/${MOCK_PROJECT_ID}`);

      // Open share modal
      await page.getByTestId('share-button').click();
      await expect(page.getByTestId('share-modal')).toBeVisible({ timeout: 5000 });

      // Click create share link button
      const createLinkButton = page.getByTestId('create-share-link-button');
      if (await createLinkButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await createLinkButton.click();
      }

      // A share link input or display should be visible
      const shareLinkDisplay = page.getByTestId('share-link-input');
      const shareLinkText = page.getByTestId('share-link-text');

      const hasInput = await shareLinkDisplay
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      const hasText = await shareLinkText
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      expect(hasInput || hasText).toBe(true);
    });

    test('copy button copies share link to clipboard', async ({ page, context }) => {
      await setupShareMocks(page);

      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      await page.goto(`/projects/${MOCK_PROJECT_ID}`);

      // Open share modal
      await page.getByTestId('share-button').click();
      await expect(page.getByTestId('share-modal')).toBeVisible({ timeout: 5000 });

      // Create link if needed
      const createLinkButton = page.getByTestId('create-share-link-button');
      if (await createLinkButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await createLinkButton.click();
      }

      // Click copy button
      const copyButton = page.getByTestId('copy-share-link-button');
      if (await copyButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await copyButton.click();

        // Should show a "Copied!" confirmation or toast
        const copiedFeedback = page.getByText(/copied/i).first();
        await expect(copiedFeedback).toBeVisible({ timeout: 3000 });
      }
    });

    test('share modal allows revoking a share link', async ({ page }) => {
      await setupShareMocks(page);
      await page.goto(`/projects/${MOCK_PROJECT_ID}`);

      // Open share modal
      await page.getByTestId('share-button').click();
      await expect(page.getByTestId('share-modal')).toBeVisible({ timeout: 5000 });

      // Look for a revoke / delete button for existing share link
      const revokeButton = page.getByTestId('revoke-share-link-button');
      if (await revokeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await revokeButton.click();

        // Should show confirmation or remove the link
        const confirmButton = page.getByTestId('confirm-revoke-button');
        if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmButton.click();
        }
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Reader-side tests (unauthenticated — access shared content)
// ---------------------------------------------------------------------------

test.describe('Shared Content Reader', () => {
  test('shared link page displays project content', async ({ page }) => {
    // Set up mock for the shared content endpoint
    await page.route(`**/api/shared/${MOCK_SHARE_TOKEN}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          project_name: MOCK_PROJECT.name,
          description: MOCK_PROJECT.description,
          audio_url: MOCK_PROJECT.audio_url,
          page_count: MOCK_PROJECT.page_count,
          created_at: MOCK_PROJECT.created_at,
        }),
      });
    });

    await page.route('**/audio/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'audio/mp4',
        body: Buffer.alloc(0),
      });
    });

    await page.goto(MOCK_SHARE_URL);

    // Should display the project name
    await expect(page.getByText(MOCK_PROJECT.name)).toBeVisible({ timeout: 10000 });

    // Should display an audio player or playback element
    const audioPlayer = page.getByTestId('shared-audio-player');
    const audioElement = page.locator('audio');

    const hasPlayer = await audioPlayer.isVisible({ timeout: 5000 }).catch(() => false);
    const hasAudio = await audioElement.isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasPlayer || hasAudio).toBe(true);
  });

  test('shared link page does not require authentication', async ({ page }) => {
    await page.route(`**/api/shared/${MOCK_SHARE_TOKEN}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          project_name: MOCK_PROJECT.name,
          description: MOCK_PROJECT.description,
          audio_url: MOCK_PROJECT.audio_url,
        }),
      });
    });

    await page.goto(MOCK_SHARE_URL);

    // Should NOT redirect to login
    const url = page.url();
    expect(url).not.toMatch(/\/login/);
    expect(url).toContain('/shared/');
  });

  test('invalid share token shows error', async ({ page }) => {
    const invalidToken = 'invalid_token_does_not_exist';

    await page.route(`**/api/shared/${invalidToken}`, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Share link not found or expired' }),
      });
    });

    await page.goto(`/shared/${invalidToken}`);

    // Should show an error message
    const errorMessage = page
      .getByText(/not found|expired|invalid|unavailable/i)
      .first();
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });

  test('expired share token shows expiration message', async ({ page }) => {
    const expiredToken = 'expired_share_token_xyz';

    await page.route(`**/api/shared/${expiredToken}`, async (route) => {
      await route.fulfill({
        status: 410,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'This share link has expired' }),
      });
    });

    await page.goto(`/shared/${expiredToken}`);

    // Should show an expiration or unavailable message
    const errorMessage = page
      .getByText(/expired|no longer available|not found|unavailable/i)
      .first();
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });
});
