import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('tooltip shortcut R1-S14', () => {
  test('tooltip kontrol yang punya shortcut menampilkan shortcut nyata', async ({ page }) => {
    await gotoApp(page);

    const play = page.getByRole('button', { name: 'Putar', exact: true });
    await expect(play.locator('xpath=..').locator('[role="tooltip"]')).toHaveText('Putar (Space)');

    const mode = page.locator('[data-action="pattern-mode"]');
    await expect(mode.locator('xpath=..').locator('[role="tooltip"]'))
      .toHaveText('Ganti mode EDIT/AUDISI (Ctrl+E)');

    const octaveDown = page.locator('[data-action="pattern-octave-down"]');
    await expect(octaveDown.locator('xpath=..').locator('[role="tooltip"]'))
      .toHaveText('Turunkan oktaf (-)');

    const octaveUp = page.locator('[data-action="pattern-octave-up"]');
    await expect(octaveUp.locator('xpath=..').locator('[role="tooltip"]'))
      .toHaveText('Naikkan oktaf (=)');
  });

  test('tooltip top bar tidak terpotong dan tampil di atas konten berikutnya', async ({ page }) => {
    await gotoApp(page);

    const play = page.getByRole('button', { name: 'Putar', exact: true });
    await play.hover();
    const tooltip = play.locator('xpath=..').locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toBeInViewport();

    const layout = await page.evaluate(() => {
      const topbar = document.querySelector('[data-action="topbar"]');
      const banner = document.querySelector('[data-action="audio-unlock-banner"]');
      const style = getComputedStyle(topbar);
      return {
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        topbarZIndex: Number(style.zIndex),
        bannerTop: banner.getBoundingClientRect().top,
      };
    });

    expect(layout.overflowX).toBe('visible');
    expect(layout.overflowY).toBe('visible');
    expect(layout.topbarZIndex).toBeGreaterThan(0);
    expect(layout.bannerTop).toBeGreaterThan(0);
  });
});
