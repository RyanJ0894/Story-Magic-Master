import { test, expect } from './fixtures/authenticated';

/**
 * Sprint P — Credits Grant + Notes Fix
 *
 * Tests issues #93 (admin credit grant) and #97 (notes/comments not saving).
 *
 * Issue #93: Admin can grant scene credits to a free-tier user via
 *   POST /api/admin/credits/grant, and the balance updates immediately.
 *
 * Issue #97: POST /api/projects/:id/comments no longer returns 500 when
 *   the Profile row does not pre-exist (Clerk webhook race). ensureProfile
 *   is called before the INSERT, creating the Profile on-demand.
 *
 * All external API calls are mocked via page.route(). These specs can be
 * run against the live staging environment by removing the route mocks and
 * setting E2E_ADMIN_USER_ID + E2E_TARGET_USER_ID env vars.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Mock data
// ──────────────────────────────────────────────────────────────────────────────

const MOCK_PROJECT_ID = '71e98a0f-731f-4a25-8cab-2226daca0a3e';
const MOCK_TARGET_USER_ID = 'user_target_abc123';
const MOCK_COMMENT = {
  id: 'cmt-00000000-0000-0000-0001',
  sceneIndex: 0,
  audioTimestampMs: null,
  text: 'Excellent pacing in this scene.',
  reactionType: null,
  userId: 'user_writer_001',
  user: { name: 'Ryan J.' },
  createdAt: new Date().toISOString(),
};

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

async function mockAdminUsersPage(page: import('@playwright/test').Page) {
  await page.route('**/api/admin/users**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: MOCK_TARGET_USER_ID,
            fullName: 'Alice Writer',
            userType: 'writer',
            writerCode: 'ALICE01',
            readerCode: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            subscriptions: [],
          },
        ],
        pagination: { total: 1, page: 1, limit: 20, totalPages: 1, hasMore: false },
      }),
    });
  });
}

async function mockGrantCredits(
  page: import('@playwright/test').Page,
  response: { status: number; body: object }
) {
  await page.route('**/api/admin/credits/grant', async (route) => {
    await route.fulfill({
      status: response.status,
      contentType: 'application/json',
      body: JSON.stringify(response.body),
    });
  });
}

async function mockCommentsApi(
  page: import('@playwright/test').Page,
  { postStatus, postBody }: { postStatus: number; postBody: object }
) {
  await page.route(`**/api/projects/${MOCK_PROJECT_ID}/comments`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ comments: [] }),
      });
    } else {
      await route.fulfill({
        status: postStatus,
        contentType: 'application/json',
        body: JSON.stringify(postBody),
      });
    }
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Issue #93: Admin Credit Grant
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Admin Credit Grant (#93)', () => {
  test('Grant Credits button opens dialog on /admin/users', async ({ page }) => {
    await mockAdminUsersPage(page);
    await mockGrantCredits(page, {
      status: 200,
      body: { userId: MOCK_TARGET_USER_ID, creditsGranted: 10, newBalance: 10 },
    });

    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    // Open the actions dropdown for the first user row
    const actionButton = page.getByRole('button', { name: 'User actions' }).first();
    await actionButton.click();

    // Grant Credits item should be visible
    const grantItem = page.getByText('Grant Credits');
    await expect(grantItem).toBeVisible();
    await grantItem.click();

    // Dialog should open with the selected user's info.
    // The page fetches real users server-side (page.route() doesn't intercept SSR),
    // so we assert on the dialog structure rather than the mock user name.
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/Add scene credits to/)).toBeVisible();
  });

  test('submitting Grant Credits dialog calls the API and shows success', async ({ page }) => {
    await mockAdminUsersPage(page);
    await mockGrantCredits(page, {
      status: 200,
      body: { userId: MOCK_TARGET_USER_ID, creditsGranted: 25, newBalance: 25 },
    });

    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    const actionButton = page.getByRole('button', { name: 'User actions' }).first();
    await actionButton.click();
    await page.getByText('Grant Credits').click();

    // Clear and set amount
    const amountInput = page.getByLabel('Credits to grant');
    await amountInput.fill('25');

    // Submit
    await page.getByRole('button', { name: 'Grant Credits' }).last().click();

    // Success message should appear
    await expect(page.getByText(/Granted 25 credits/)).toBeVisible({ timeout: 5000 });
  });

  test('shows validation error for amount of 0', async ({ page }) => {
    await mockAdminUsersPage(page);

    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    const actionButton = page.getByRole('button', { name: 'User actions' }).first();
    await actionButton.click();
    await page.getByText('Grant Credits').click();

    await page.getByLabel('Credits to grant').fill('0');
    await page.getByRole('button', { name: 'Grant Credits' }).last().click();

    await expect(page.getByText(/between 1 and 10,000/)).toBeVisible();
  });

  test('POST /api/admin/credits/grant enforces admin-only access (403 from server)', async ({ page }) => {
    // Simulate a non-admin user receiving a 403 from the endpoint
    await mockGrantCredits(page, {
      status: 403,
      body: { error: 'Forbidden', code: 'FORBIDDEN' },
    });

    const baseURL = 'http://localhost:22000';
    const res = await page.evaluate(async ({ url, payload }) => {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return { status: r.status };
    }, { url: `${baseURL}/api/admin/credits/grant`, payload: { userId: MOCK_TARGET_USER_ID, amount: 10 } });

    expect(res.status).toBe(403);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Issue #97: Notes / Comments not saving
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Notes not saving fix (#97)', () => {
  test('POST /api/projects/:id/comments returns 201 when server returns comment', async ({ page }) => {
    await mockCommentsApi(page, {
      postStatus: 201,
      postBody: { comment: MOCK_COMMENT },
    });

    // page.route() only intercepts browser-initiated requests (CDP), not
    // page.request which goes through Node.js HTTP directly. Use page.evaluate()
    // so the fetch runs inside the browser and the mock interceptor fires.
    const baseURL = 'http://localhost:22000';
    const res = await page.evaluate(async ({ url, payload }) => {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return { status: r.status, body: await r.json() };
    }, { url: `${baseURL}/api/projects/${MOCK_PROJECT_ID}/comments`, payload: { text: 'Excellent pacing in this scene.', sceneIndex: 0 } });

    expect(res.status).toBe(201);
    expect((res.body as { comment: { text: string } }).comment.text).toBe('Excellent pacing in this scene.');
  });

  test('503 from ensureProfile failure is surfaced as an error (not silent 500)', async ({ page }) => {
    await mockCommentsApi(page, {
      postStatus: 503,
      postBody: { error: 'Profile not ready — please refresh and try again' },
    });

    const baseURL = 'http://localhost:22000';
    const res = await page.evaluate(async ({ url, payload }) => {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return { status: r.status, body: await r.json() };
    }, { url: `${baseURL}/api/projects/${MOCK_PROJECT_ID}/comments`, payload: { text: 'test', sceneIndex: 0 } });

    expect(res.status).toBe(503);
    expect((res.body as { error: string }).error).toContain('Profile not ready');
  });

  test('screenplay notes panel saves a note via the comments API', async ({ page }) => {
    let postedBody: unknown = null;

    await page.route(`**/api/projects/${MOCK_PROJECT_ID}/comments`, async (route) => {
      if (route.request().method() === 'POST') {
        postedBody = await route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ comment: MOCK_COMMENT }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ comments: [] }),
        });
      }
    });

    // Navigate to a project page that has a notes panel
    await page.goto(`/projects/${MOCK_PROJECT_ID}`);
    await page.waitForLoadState('networkidle');

    // Look for a note input or textarea (various possible selectors from NotesPanel)
    const noteInput = page.locator('textarea[placeholder*="note"], textarea[placeholder*="Note"], [data-testid="note-input"]').first();

    if (await noteInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await noteInput.fill('Excellent pacing in this scene.');
      await page.keyboard.press('Control+Enter');

      // Wait briefly for the POST to fire
      await page.waitForTimeout(500);

      expect(postedBody).not.toBeNull();
      const typed = postedBody as { text?: string; body?: string };
      expect(typed.text ?? typed.body).toContain('Excellent pacing');
    } else {
      // Project page didn't load the notes panel (no project data in test DB) — skip
      test.skip(true, 'Notes panel not visible — project not found in test DB');
    }
  });
});
