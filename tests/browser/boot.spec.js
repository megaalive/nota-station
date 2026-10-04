import { test, expect } from '@playwright/test';

import { gotoApp, waitForApp } from './helpers.js';

/**
 * Skenario boot R0 (§15 R0 exit): semua aset resolve di subpath /<repo>/,
 * tanpa galat console, build id terbaca, dan hook agent tersedia.
 */
test.describe('boot shell di subpath', () => {
  test('index.html 200 dan app boot tanpa galat konsol', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const response = await page.goto('./');
    expect(response.status()).toBe(200);

    await gotoApp(page);
    await expect(page.getByRole('banner')).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('window.tracker tersedia dengan command layer dan listCommands', async ({ page }) => {
    await gotoApp(page);

    const info = await page.evaluate(() => ({
      ready: window.tracker.getState().ready,
      hasRegistry: typeof window.tracker.commands.register === 'function',
      commands: window.tracker.commands.listCommands(),
      // Agent tidak boleh sampai bisa menyentuh AudioContext atau storage mentah (§9).
      leaked: ['audioContext', 'storage', 'indexedDB'].filter((k) => k in window.tracker),
    }));

    expect(info.ready).toBe(true);
    expect(info.hasRegistry).toBe(true);
    // Registry harus benar-benar berisi perintah, bukan PLACEHOLDER kosong.
    expect(info.commands.length).toBeGreaterThan(0);
    for (const command of info.commands) {
      expect(command).toHaveProperty('id');
      expect(command).toHaveProperty('labelKey');
      expect(command).toHaveProperty('enabled');
    }
    expect(info.leaked).toEqual([]);
  });

  test('build.json terbaca relatif sehingga SHA ikut', async ({ page }) => {
    await gotoApp(page);

    const build = await page.evaluate(() => window.tracker.getState().build);
    expect(build).not.toBeNull();
    expect(build.sha).toMatch(/^[0-9a-f]{7,40}$/);
  });

  test('locale bisa diganti lewat hook dan tersimpan di localStorage', async ({ page }) => {
    await gotoApp(page);

    await page.evaluate(() => window.tracker.setLocale('en'));
    expect(await page.evaluate(() => window.tracker.getState().locale)).toBe('en');

    await page.reload();
    await gotoApp(page);
    expect(await page.evaluate(() => window.tracker.getState().locale)).toBe('en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('lang di <html> ngikutin i18n, default Indonesia', async ({ page }) => {
    await gotoApp(page);

    const state = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      locale: window.tracker.getState().locale,
    }));
    expect(state.locale).toBe('id');
    expect(state.lang).toBe('id');
  });

  test('role=application tidak dipakai di wrapper halaman', async ({ page }) => {
    await gotoApp(page);
    // Role itu khusus elemen grid (§8.19); di R0 belum ada grid, jadi harus nihil.
    expect(await page.locator('[role="application"]').count()).toBe(0);
  });

  test('CSP tidak memblokir aset sendiri', async ({ page }) => {
    const failed = [];
    page.on('requestfailed', (req) => failed.push(req.url()));
    await gotoApp(page);
    expect(failed).toEqual([]);
  });

  test('refresh tidak 404 di subpath', async ({ page }) => {
    await gotoApp(page);
    const response = await page.reload();
    expect(response.status()).toBe(200);
    await waitForApp(page);
  });
});