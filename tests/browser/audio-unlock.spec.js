import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('audio unlock banner R1-S11', () => {
  test('banner terkunci tampil lalu tombol aktivasi menyiapkan audio', async ({ page }) => {
    await gotoApp(page);

    const banner = page.locator('[data-action="audio-unlock-banner"]');
    await expect(banner).toBeVisible();
    await expect(page.locator('[data-action="audio-status"]')).toContainText('terkunci');

    await page.locator('[data-action="audio-unlock-button"]').click();

    await expect(banner).toBeHidden();
    await expect(page.locator('[data-action="audio-status"]')).toContainText('siap');
    const audio = await page.evaluate(() => window.tracker.getState().audio);
    expect(audio.sampleReady).toBe(true);
    expect(audio.state).toBe('ready');
  });

  test('Play dari gestur pengguna juga menghilangkan banner tanpa galat console', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await gotoApp(page);

    await page.getByRole('button', { name: 'Putar' }).click();
    await expect(page.locator('[data-action="audio-unlock-banner"]')).toBeHidden();
    await expect(page.locator('[data-action="audio-status"]')).toContainText('bermain', { timeout: 5000 });
    expect(errors).toEqual([]);

    await page.getByRole('button', { name: 'Berhenti' }).click();
  });
});
