import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('empty first cell R1-S13', () => {
  test('Pattern kosong memberi cue di NOTE pertama lalu hilang setelah note ditulis', async ({ page }) => {
    await gotoApp(page);

    const first = page.locator(
      '[data-action="pattern-cell"][data-row="0"][data-channel="0"][data-field="note"]',
    );
    await expect(first).toHaveText('Z=C');
    await expect(first).toHaveAttribute(
      'title',
      'Mulai di sini: tekan Z untuk C; Ctrl+E untuk EDIT.',
    );

    await page.locator('[data-action="pattern-grid"]').focus();
    await page.keyboard.press('Control+e');
    await page.keyboard.press('z');

    await expect(first).toHaveText('C-4');
    await expect(first).not.toHaveAttribute('title', /.+/);

    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Delete');
    await expect(first).toHaveText('Z=C');
  });
});
