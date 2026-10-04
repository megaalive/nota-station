import { test, expect } from '@playwright/test';

import { gotoApp, waitForApp } from '../browser/helpers.js';

/**
 * Smoke test terhadap build yang sudah live (§13.4).
 *
 * Cakupannya sengaja hanya hal yang benar-benar ada di R0. Butir §13.4 yang
 * menyangkut fitur milestone berikutnya (manifest factory sample R2, audio yang
 * bisa diinisialisasi R1, proyek baru + pattern yang bisa dimainkan R1) TIDAK diuji
 * di sini — mengujinya berarti harus membangun fitur R1, yang dilarang di luar
 * milestone-nya. Butir itu akan ditambahkan ke smoke test di R1/R2.
 */
const EXPECT_SHA = process.env.EXPECT_SHA ?? null;

test.describe('smoke build live', () => {
  test('index.html 200 dan app boot tanpa galat konsol', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const response = await page.goto('./');
    expect(response.status()).toBe(200);

    // Pages butuh sesaat untuk menyajikan artefak, jadi tunggu lebih lama dari tes lokal.
    await expect(page.locator('[data-action="topbar"]')).toBeVisible({ timeout: 30_000 });
    await waitForApp(page);
    await expect(page.locator('[data-action="workspace-tabs"]')).toBeVisible();
    await expect(page).toHaveTitle('NotaStation');

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('JS entry termuat dari subpath repo', async ({ page }) => {
    const scripts = [];
    page.on('request', (req) => {
      if (req.resourceType() === 'script') scripts.push(req.url());
    });

    await gotoApp(page);

    expect(scripts.length).toBeGreaterThan(0);
    // Semua skrip harus same-origin dan di bawah subpath repo, bukan root domain —
    // inilah yang bikin build lokal bisa beda dengan Pages. Subpath diambil dari URL
    // halaman supaya smoke ikut kalau repo di-rename.
    const origin = new URL(page.url()).origin;
    const subpath = new URL(page.url()).pathname.replace(/\/[^/]*$/, '/');
    expect(subpath).not.toBe('/');
    for (const url of scripts) {
      expect(new URL(url).origin).toBe(origin);
      expect(new URL(url).pathname.startsWith(subpath)).toBe(true);
    }
  });

  test('build metadata di UI cocok dengan commit yang di-deploy', async ({ page }) => {
    await gotoApp(page);

    const build = await page.evaluate(() => window.tracker.getState().build);
    expect(build).not.toBeNull();
    expect(build.sha).toMatch(/^[0-9a-f]{7,40}$/);

    if (EXPECT_SHA) {
      expect(build.sha).toBe(EXPECT_SHA);
    }

    // Build id juga harus TERLIHAT di UI, bukan cuma ada di state — kalau cuma di
    // state, user tidak bisa cek sendiri build mana yang sedang mereka pakai.
    await expect(page.locator('[data-action="build-id"]')).toContainText(build.sha.slice(0, 7));
  });

  test('CSP tidak memblokir aset sendiri', async ({ page }) => {
    const failed = [];
    page.on('requestfailed', (req) => failed.push(req.url()));

    await gotoApp(page);

    const csp = await page.evaluate(
      () => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content ?? '',
    );
    expect(csp).toContain("default-src 'self'");
    expect(failed).toEqual([]);
  });

  test('refresh tidak 404 di subpath', async ({ page }) => {
    await gotoApp(page);
    await page.reload();
    const response = await page.goto('./');
    expect(response.status()).toBe(200);
    await waitForApp(page);
  });

  test('lang di <html> berasal dari i18n, bukan hardcode', async ({ page }) => {
    await gotoApp(page);
    const lang = await page.evaluate(() => document.documentElement.lang);
    expect(['id', 'en']).toContain(lang);
    expect(lang).toBe(await page.evaluate(() => window.tracker.getState().locale));
  });

  test('role=application hanya dipakai grid, bukan wrapper', async ({ page }) => {
    await gotoApp(page);
    // Di R0 belum ada grid, jadi application role harus nihil di mana pun.
    const count = await page.locator('[role="application"]').count();
    expect(count).toBe(0);
  });
});