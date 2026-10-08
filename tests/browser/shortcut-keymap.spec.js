import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('R3-S10A keymap + shortcut overlay', () => {
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

  test('? membuka overlay kontekstual dan preset dapat diganti setelah first-run', async ({ page }) => {
    await page.keyboard.press('Shift+/');
    await expect(page.locator('[data-action="shortcut-dialog"]')).toBeVisible();
    await expect(page.locator('[data-action="shortcut-keymap"][data-entity="songwriter"]'))
      .toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-action="shortcut-row"][data-entity="playback.togglePlayStop"]'))
      .toContainText('Space');

    await page.locator('[data-action="shortcut-keymap"][data-entity="openmpt"]').click();

    expect(await page.evaluate(() => window.tracker.getState().keymap)).toBe('openmpt');
    expect(await page.evaluate(() => localStorage.getItem('notastation.keymapPreset'))).toBe('openmpt');
    await expect(page.locator('[data-action="shortcut-keymap"][data-entity="openmpt"]'))
      .toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-action="shortcut-row"][data-entity="playback.playPatternStart"]'))
      .toContainText('F7');
    await expect(page.locator('[data-action="shortcut-row"][data-entity="audio.toggleActiveTrackMute"]'))
      .toContainText('F10');
    await expect(page.locator('[data-action="shortcut-row"][data-entity="playback.togglePlayStop"]'))
      .toHaveCount(0);

    await page.getByRole('button', { name: 'Tutup' }).click();
    await expect(page.locator('[data-action="shortcut-dialog"]')).toHaveCount(0);
    await expect(page.locator('[data-action="pattern-mode"]')).toHaveText('EDIT');
  });

  test('tombol ? di topbar membuka overlay yang sama', async ({ page }) => {
    const help = page.locator('[data-action="shortcut-help-button"]');
    await expect(help).toBeVisible();
    await help.click();
    await expect(page.locator('[data-action="shortcut-dialog"]')).toBeVisible();
  });

  test('shortcut bantuan tetap bekerja saat fokus pada tombol dan Song Map', async ({ page }) => {
    await page.getByRole('tab', { name: 'Song' }).click();
    const button = page.locator('[data-action="song-add-section"]');
    await button.focus();
    await page.keyboard.press('Shift+/');
    await expect(page.locator('[data-action="shortcut-dialog"]')).toBeVisible();
    await page.keyboard.press('Escape');

    const entry = page.locator('[data-action="song-entry"]').first();
    await entry.focus();
    await page.keyboard.press('Control+k');
    await expect(page.locator('[data-action="palette"]')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('shortcut bantuan tidak mengambil alih input teks di dialog', async ({ page }) => {
    await page.getByRole('tab', { name: 'Song' }).click();
    await page.locator('[data-action="song-add-section"]').click();
    const name = page.locator('[data-action="song-section-name"]');
    await name.focus();
    await page.keyboard.press('Shift+/');
    await expect(page.locator('[data-action="shortcut-dialog"]')).toHaveCount(0);
    await expect(name).toContainText('');
    await expect(name).toHaveValue('Verse?');
  });

  test('OpenMPT-like: Tab pindah channel, Ctrl+Space toggle EDIT, F10 mute, Ctrl+F10 solo', async ({ page }) => {
    await page.evaluate(() => window.tracker.commands.execute('ui.setKeymap', { preset: 'openmpt' }));

    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    expect((await page.evaluate(() => window.tracker.getState().patternUi)).channel).toBe(0);

    await page.keyboard.press('Tab');
    expect((await page.evaluate(() => window.tracker.getState().patternUi)).channel).toBe(1);

    await page.keyboard.press('Control+Space');
    await expect(page.locator('[data-action="pattern-mode"]')).toHaveText('AUDISI');

    await page.keyboard.press('F10');
    let state = await page.evaluate(() => window.tracker.getState());
    const activeTrackId = (await page.evaluate(() => window.tracker.getProject().song.tracks[1].id));
    expect(state.audio.trackMeters.find((item) => item.trackId === activeTrackId)?.mute).toBe(true);

    await page.keyboard.press('Control+F10');
    state = await page.evaluate(() => window.tracker.getState());
    expect(state.audio.trackMeters.find((item) => item.trackId === activeTrackId)?.solo).toBe(true);

    expect(state.transport.loopPattern).toBe(true);
    await grid.focus();
    await page.keyboard.press('Shift+F11');
    expect((await page.evaluate(() => window.tracker.getState().transport.loopPattern))).toBe(false);
  });

  test('Command Palette menampilkan shortcut sesuai preset aktif', async ({ page }) => {
    await page.evaluate(() => window.tracker.commands.execute('ui.setKeymap', { preset: 'openmpt' }));
    await page.keyboard.press('Control+k');

    const f7 = page.locator('[data-action="palette-item"][data-entity="playback.playPatternStart"]');
    await expect(f7.locator('kbd')).toHaveText('F7');

    const mute = page.locator('[data-action="palette-item"][data-entity="audio.toggleActiveTrackMute"]');
    await expect(mute.locator('kbd')).toHaveText('F10');

    const songwriterToggle = page.locator('[data-action="palette-item"][data-entity="playback.togglePlayStop"]');
    await expect(songwriterToggle.locator('kbd')).toHaveCount(0);
  });
});
