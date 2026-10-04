import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('tooltip shortcut R1-S14', () => {
  test('tooltip kontrol yang punya shortcut menampilkan shortcut nyata', async ({ page }) => {
    await gotoApp(page);

    const play = page.getByRole('button', { name: 'Putar' });
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
});
