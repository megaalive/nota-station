import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('R3-S11 Song/Section transport surface', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      window.tracker.commands.execute('project.loadTemplate', {
        templateId: 'blank',
        locale: 'id',
        keymap: 'songwriter',
      });
    });
  });

  test('registry mengekspos command Shift+Space Songwriter sebagai aksi nyata', async ({ page }) => {
    const command = await page.evaluate(() => (
      window.tracker.commands.listCommands()
        .find((item) => item.id === 'playback.playSectionStart')
    ));

    expect(command).toBeTruthy();
    expect(command.shortcut).toBe('Shift+Space');
    expect(command.enabled).toBe(true);
  });

  test('overlay shortcut menampilkan Shift+Space untuk mulai dari awal Section', async ({ page }) => {
    await page.keyboard.press('Shift+/');

    const row = page.locator(
      '[data-action="shortcut-row"][data-entity="playback.playSectionStart"]',
    );
    await expect(row).toBeVisible();
    await expect(row.locator('kbd')).toHaveText('Shift+Space');
    await expect(row).not.toContainText('playback.playSectionStart');
  });
});
