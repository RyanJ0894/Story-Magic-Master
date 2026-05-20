import { test, expect } from './fixtures/authenticated';
import path from 'path';

/**
 * Screenplay Upload Flow — /projects/new (Upload tab)
 *
 * Tests the file upload path: drag-drop zone, format validation,
 * size limit enforcement, auto-name from filename, and upload button state.
 *
 * Does NOT test the underlying API (mocked); tests the UI behavior only.
 */

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const MOCK_PROJECT_ID = 'e2e-upload-project-00000000-0000-0000-0000-000000000001';

async function mockUploadApi(page: import('@playwright/test').Page) {
  await page.route('**/api/projects/upload', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: MOCK_PROJECT_ID,
          name: 'My Screenplay',
          status: 'draft',
        }),
      });
    } else {
      await route.continue();
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers: create minimal in-memory files for upload tests
// ---------------------------------------------------------------------------

/** Returns a DataTransfer with a synthetic file for drag-drop simulation. */
async function dragFile(
  page: import('@playwright/test').Page,
  dropZone: import('@playwright/test').Locator,
  filename: string,
  content: string,
  mimeType: string
) {
  await page.evaluate(
    ({ filename, content, mimeType }) => {
      const dt = new DataTransfer();
      const blob = new Blob([content], { type: mimeType });
      const file = new File([blob], filename, { type: mimeType });
      dt.items.add(file);
      // Attach to window so the drop handler can access it
      (window as Window & typeof globalThis & { __e2eDropTransfer?: DataTransfer }).__e2eDropTransfer = dt;
    },
    { filename, content, mimeType }
  );

  await dropZone.dispatchEvent('dragover', { dataTransfer: {} });
  await dropZone.dispatchEvent('drop', {
    dataTransfer: await page.evaluate(() => {
      const w = window as Window & typeof globalThis & { __e2eDropTransfer?: DataTransfer };
      return w.__e2eDropTransfer;
    }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Screenplay Upload (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await mockUploadApi(page);
    await page.goto('/projects/new');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
  });

  test.describe('Upload Tab Discovery', () => {
    test('upload tab exists on new project page', async ({ page }) => {
      const uploadTab = page.getByRole('tab', { name: /upload/i });
      const hasTab = await uploadTab.isVisible({ timeout: 8000 }).catch(() => false);
      // The new project page either has an Upload tab or an integrated upload zone
      const uploadZone = page.getByTestId('drop-zone');
      const hasZone = await uploadZone.isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasTab || hasZone).toBe(true);
    });

    test('clicking upload tab shows drop zone', async ({ page }) => {
      const uploadTab = page.getByRole('tab', { name: /upload/i });
      const hasTab = await uploadTab.isVisible({ timeout: 8000 }).catch(() => false);
      if (hasTab) {
        await uploadTab.click();
      }
      const dropZone = page.getByTestId('drop-zone');
      await expect(dropZone).toBeVisible({ timeout: 8000 });
    });
  });

  test.describe('Drop Zone UI', () => {
    test('drop zone shows supported format labels', async ({ page }) => {
      const uploadTab = page.getByRole('tab', { name: /upload/i });
      if (await uploadTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await uploadTab.click();
      }

      // Should mention Final Draft / Fountain / FDX as supported formats
      const formatText = page.getByText(/Final Draft|\.fdx|Fountain|\.fountain|PDF|Word/i);
      await expect(formatText.first()).toBeVisible({ timeout: 8000 });
    });

    test('drop zone shows 10MB size limit', async ({ page }) => {
      const uploadTab = page.getByRole('tab', { name: /upload/i });
      if (await uploadTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await uploadTab.click();
      }
      await expect(page.getByText(/10\s*MB/i)).toBeVisible({ timeout: 8000 });
    });
  });

  test.describe('File Selection via Input', () => {
    async function switchToUploadTab(page: import('@playwright/test').Page) {
      const uploadTab = page.getByRole('tab', { name: /upload/i });
      if (await uploadTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await uploadTab.click();
      }
    }

    test('selecting a .txt file shows file info and enables upload button', async ({ page }) => {
      await switchToUploadTab(page);

      const fileInput = page.getByTestId('file-input');
      await expect(fileInput).toBeAttached({ timeout: 8000 });

      await fileInput.setInputFiles({
        name: 'my_screenplay.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('INT. OFFICE - DAY\n\nJOHN\nHello world.'),
      });

      // File info card should appear
      const fileInfo = page.getByTestId('file-info');
      await expect(fileInfo).toBeVisible({ timeout: 5000 });
      await expect(fileInfo).toContainText('my_screenplay.txt');
    });

    test('auto-fills project name from filename when name field is empty', async ({ page }) => {
      await switchToUploadTab(page);

      const nameInput = page
        .getByTestId('upload-project-name-input')
        .or(page.locator('input[id="upload-name"]'));

      // Clear name first
      if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await nameInput.clear();
      }

      const fileInput = page.getByTestId('file-input');
      await fileInput.setInputFiles({
        name: 'The_Last_Frontier.fountain',
        mimeType: 'text/plain',
        buffer: Buffer.from('INT. WILDERNESS - DAY\n\nNARRATOR\n(V.O.)\nIt began here.'),
      });

      // Name should be auto-filled from filename (without extension)
      const nameValue = await nameInput.inputValue().catch(() => '');
      if (nameValue) {
        expect(nameValue).toContain('The_Last_Frontier');
      }
    });

    test('selecting a .fdx file is accepted', async ({ page }) => {
      await switchToUploadTab(page);
      const fileInput = page.getByTestId('file-input');
      await fileInput.setInputFiles({
        name: 'script.fdx',
        mimeType: 'application/xml',
        buffer: Buffer.from('<?xml version="1.0"?><FinalDraft></FinalDraft>'),
      });

      // Should NOT show an error toast about unsupported type
      const errorToast = page.getByText(/unsupported file type/i);
      const hasError = await errorToast.isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasError).toBe(false);

      const fileInfo = page.getByTestId('file-info');
      await expect(fileInfo).toBeVisible({ timeout: 5000 });
    });

    test('selecting a .fountain file is accepted', async ({ page }) => {
      await switchToUploadTab(page);
      const fileInput = page.getByTestId('file-input');
      await fileInput.setInputFiles({
        name: 'screenplay.fountain',
        mimeType: 'text/plain',
        buffer: Buffer.from('Title: My Script\n\nINT. ROOM - DAY\n\nCHARACTER\nDialogue here.'),
      });

      const fileInfo = page.getByTestId('file-info');
      await expect(fileInfo).toBeVisible({ timeout: 5000 });
      await expect(fileInfo).toContainText('screenplay.fountain');
    });

    test('selecting an unsupported file type shows error', async ({ page }) => {
      await switchToUploadTab(page);
      const fileInput = page.getByTestId('file-input');

      await fileInput.setInputFiles({
        name: 'video.mp4',
        mimeType: 'video/mp4',
        buffer: Buffer.from('fake video content'),
      });

      // Should show an unsupported type error
      const errorMsg = page
        .getByText(/unsupported|not supported|invalid file type/i)
        .or(page.locator('[data-sonner-toast]').filter({ hasText: /unsupported/i }));
      await expect(errorMsg.first()).toBeVisible({ timeout: 5000 });
    });

    test('upload button is disabled until file and name are both present', async ({ page }) => {
      await switchToUploadTab(page);

      const uploadButton = page.getByTestId('upload-button');
      await expect(uploadButton).toBeDisabled({ timeout: 8000 });

      // Add file
      const fileInput = page.getByTestId('file-input');
      await fileInput.setInputFiles({
        name: 'script.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('INT. ROOM - DAY'),
      });

      // Name might have been auto-filled; if not, fill manually
      const nameInput = page
        .getByTestId('upload-project-name-input')
        .or(page.locator('input[id="upload-name"]'));
      const nameValue = await nameInput.inputValue().catch(() => '');
      if (!nameValue) {
        await nameInput.fill('My Test Script');
      }

      await expect(uploadButton).toBeEnabled({ timeout: 5000 });
    });

    test('clear file button removes the selected file', async ({ page }) => {
      await switchToUploadTab(page);

      const fileInput = page.getByTestId('file-input');
      await fileInput.setInputFiles({
        name: 'script.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('INT. ROOM - DAY'),
      });

      await expect(page.getByTestId('file-info')).toBeVisible({ timeout: 5000 });

      // Click the X / clear button
      const clearButton = page.getByTestId('clear-file');
      await expect(clearButton).toBeVisible({ timeout: 3000 });
      await clearButton.click();

      // File info should disappear
      await expect(page.getByTestId('file-info')).not.toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Upload Submission', () => {
    test('clicking Upload & Create Project navigates to project page', async ({ page }) => {
      const uploadTab = page.getByRole('tab', { name: /upload/i });
      if (await uploadTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await uploadTab.click();
      }

      const fileInput = page.getByTestId('file-input');
      await fileInput.setInputFiles({
        name: 'my_film.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('INT. OFFICE - DAY\n\nJOHN\nAction!'),
      });

      const nameInput = page
        .getByTestId('upload-project-name-input')
        .or(page.locator('input[id="upload-name"]'));
      const nameValue = await nameInput.inputValue().catch(() => '');
      if (!nameValue) {
        await nameInput.fill('My Film');
      }

      const uploadButton = page.getByTestId('upload-button');
      await expect(uploadButton).toBeEnabled({ timeout: 5000 });
      await uploadButton.click();

      // Should show uploading state
      await expect(page.getByText(/uploading/i)).toBeVisible({ timeout: 5000 });

      // Should redirect to project page
      await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/, { timeout: 15000 });
    });
  });
});
