import { test, expect } from '@playwright/test';

/**
 * Skenario boot R0 (§15 R0 exit): semua aset resolve di subpath /<repo>/,
 * tanpa galat console, build id terbaca, dan hook agent tersedia.
 */
test.describe('boot shell di subpath', () => {
  test('index.html 200 dan memuat app tanpa galat konsol', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const response = await page.goto('./');
    expect(response.status()).toBe(200);

    await expect(page.getByRole('application')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('NotaStation');
    await expect(page.locator('[data-action="shell-placeholder"]')).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('window.tracker tersedia dengan command layer dan listCommands', async ({ page }) => {
    await page.goto('./');
    await page.waitForFunction(() => Boolean(window.tracker));

    const info = await page.evaluate(() => ({
      ready: window.tracker.getState().ready,
      hasRegistry: typeof window.tracker.commands.register === 'function',
      commandCount: window.tracker.commands.listCommands().length,
      // Agent tidak boleh sampai bisa menyentuh AudioContext atau storage mentah (§9).
      leaked: ['audioContext', 'storage', 'indexedDB'].filter((k) => k in window.tracker),
    }));

    expect(info.ready).toBe(true);
    expect(info.hasRegistry).toBe(true);
    expect(info.commandCount).toBeGreaterThanOrEqual(0);
    expect(info.leaked).toEqual([]);
  });

  test('build.json terbaca relatif sehingga SHA ikut', async ({ page }) => {
    await page.goto('./');
    await page.waitForFunction(() => Boolean(window.tracker));

    const build = await page.evaluate(() => window.tracker.getState().build);
    expect(build).not.toBeNull();
    expect(build.sha).toMatch(/^[0-9a-f]{7,40}$/);
  });

  test('locale bisa diganti lewat hook dan tersimpan di localStorage', async ({ page }) => {
    await page.goto('./');
    await page.waitForFunction(() => Boolean(window.tracker));

    await page.evaluate(() => window.tracker.setLocale('id'));
    expect(await page.evaluate(() => window.tracker.getState().locale)).toBe('id');

    await page.reload();
    await page.waitForFunction(() => Boolean(window.tracker));
    expect(await page.evaluate(() => window.tracker.getState().locale)).toBe('id');
    await expect(page.locator('html')).toHaveAttribute('lang', 'id');
  });

  test('CSP tidak memblokir aset sendiri', async ({ page }) => {
    const failed = [];
    page.on('requestfailed', (req) => failed.push(req.url()));
    await page.goto('./');
    await page.waitForFunction(() => Boolean(window.tracker));
    expect(failed).toEqual([]);
  });
});