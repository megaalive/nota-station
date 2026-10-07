import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('R3-S10C header channel lengkap', () => {
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

  test('mini volume adalah mixer runtime dan tidak mengubah project/history', async ({ page }) => {
    const projectBefore = await page.evaluate(() => window.tracker.getProject());
    const historyBefore = await page.evaluate(() => window.tracker.getState().history);
    const trackId = projectBefore.song.tracks[0].id;

    const slider = page.locator(`[data-action="track-volume"][data-track-id="${trackId}"]`);
    await expect(slider).toBeVisible();
    await expect(slider).toHaveValue('100');
    await slider.fill('35');

    const audio = await page.evaluate(() => window.tracker.getState().audio);
    const meter = audio.trackMeters.find((item) => item.trackId === trackId);
    expect(meter.volume).toBeCloseTo(0.35, 3);

    expect(await page.evaluate(() => window.tracker.getProject())).toEqual(projectBefore);
    expect(await page.evaluate(() => window.tracker.getState().history)).toEqual(historyBefore);

    await page.locator(`[data-action="track-mute"][data-track-id="${trackId}"]`).click();
    let muted = await page.evaluate((id) => (
      window.tracker.getState().audio.trackMeters.find((item) => item.trackId === id)
    ), trackId);
    expect(muted.mute).toBe(true);
    expect(muted.volume).toBeCloseTo(0.35, 3);

    await page.locator(`[data-action="track-mute"][data-track-id="${trackId}"]`).click();
    muted = await page.evaluate((id) => (
      window.tracker.getState().audio.trackMeters.find((item) => item.trackId === id)
    ), trackId);
    expect(muted.mute).toBe(false);
    expect(muted.volume).toBeCloseTo(0.35, 3);
  });

  test('warna channel adalah data Track kanonik dan dapat di-Undo', async ({ page }) => {
    const trackId = await page.evaluate(() => window.tracker.getProject().song.tracks[0].id);
    const color = page.locator(`[data-action="track-color"][data-track-id="${trackId}"]`);

    await expect(color).toBeVisible();
    await color.fill('#336699');
    await color.dispatchEvent('change');

    expect(await page.evaluate((id) => (
      window.tracker.getProject().song.tracks.find((track) => track.id === id).color
    ), trackId)).toBe('#336699');

    await page.locator('[data-action="pattern-grid"]').focus();
    await page.keyboard.press('Control+z');
    expect(await page.evaluate((id) => (
      window.tracker.getProject().song.tracks.find((track) => track.id === id).color
    ), trackId)).toBeNull();
  });

  test('FX di header membuka disclosure dan memfokuskan channel yang dipilih', async ({ page }) => {
    const project = await page.evaluate(() => window.tracker.getProject());
    const trackId = project.song.tracks[1].id;
    const fx = page.locator(`[data-action="track-fx"][data-track-id="${trackId}"]`);

    await expect(fx).toBeVisible();
    await fx.click();

    expect(await page.evaluate(() => window.tracker.getState().patternUi)).toMatchObject({
      channel: 1,
      field: 'effect',
      voiceLane: 0,
      fxColumnsVisible: true,
    });
    await expect(page.locator('[data-action="pattern-effect-editor"]')).toBeVisible();
    await expect(page.locator('[data-action="pattern-effect-editor"]')).toHaveAttribute('data-channel', '1');
  });

  test('poly header mempertahankan fold lane bersama volume, warna, dan FX', async ({ page }) => {
    const trackId = await page.evaluate(() => {
      const project = window.tracker.getProject();
      const id = project.song.tracks[0].id;
      window.tracker.commands.execute('track.setPolyphony', { trackId: id, polyphony: 'poly' });
      return id;
    });

    await expect(page.locator(`[data-action="track-lanes-toggle"][data-track-id="${trackId}"]`)).toBeVisible();
    await expect(page.locator(`[data-action="track-volume"][data-track-id="${trackId}"]`)).toBeVisible();
    await expect(page.locator(`[data-action="track-color"][data-track-id="${trackId}"]`)).toBeVisible();
    await expect(page.locator(`[data-action="track-fx"][data-track-id="${trackId}"]`)).toBeVisible();
  });
});
