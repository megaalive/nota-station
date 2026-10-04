import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

async function enterOneNote(page) {
  const grid = page.locator('[data-action="pattern-grid"]');
  await grid.focus();
  await page.keyboard.press('Control+e');
  await page.keyboard.press('z');
}

test.describe('Transport R1-S5', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('kontrol transport memakai ikon ringkas dan accessible name', async ({ page }) => {
    const topbar = page.locator('[data-action="topbar"]');
    await expect(topbar.getByRole('button', { name: 'Putar' })).toHaveText('▶');
    await expect(topbar.getByRole('button', { name: 'Jeda' })).toHaveText('⏸');
    await expect(topbar.getByRole('button', { name: 'Berhenti' })).toHaveText('■');
    await expect(topbar.getByRole('button', { name: 'Loop Pattern' })).toHaveText('↻');
    await expect(topbar.getByRole('button', { name: 'Metronom' })).toHaveText('♩');
    await expect(page.locator('[data-action="transport-seek"]')).toHaveAttribute('max', '7680');
  });

  test('metronom adalah toggle session dan tidak membuat history project', async ({ page }) => {
    const metronome = page.getByRole('button', { name: 'Metronom' });
    await metronome.click();
    await expect(metronome).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => window.tracker.getState().transport.metronome)).toBe(true);
    expect(await page.evaluate(() => window.tracker.getState().history.undoDepth)).toBe(0);
  });

  test('seek mengubah posisi transport dan Stop kembali ke awal', async ({ page }) => {
    const seek = page.locator('[data-action="transport-seek"]');
    await seek.evaluate((node) => {
      node.value = '960';
      node.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(await page.evaluate(() => window.tracker.getState().audio.positionTick)).toBe(960);
    await expect(seek).toHaveValue('960');

    await page.getByRole('button', { name: 'Berhenti' }).click();
    expect(await page.evaluate(() => window.tracker.getState().audio.positionTick)).toBe(0);
    await expect(seek).toHaveValue('0');
  });

  test('Play Pause resume dan Stop menjaga state transport', async ({ page }) => {
    await enterOneNote(page);
    const play = page.getByRole('button', { name: 'Putar' });
    const pause = page.getByRole('button', { name: 'Jeda' });
    const stop = page.getByRole('button', { name: 'Berhenti' });

    await play.click();
    await expect(page.locator('[data-action="audio-status"]')).toContainText('bermain', { timeout: 5000 });
    await expect(pause).toBeEnabled();

    await pause.click();
    await expect(page.locator('[data-action="audio-status"]')).toContainText('jeda');
    expect(await page.evaluate(() => window.tracker.getState().audio.state)).toBe('paused');

    await play.click();
    await expect(page.locator('[data-action="audio-status"]')).toContainText('bermain');

    await stop.click();
    await expect(page.locator('[data-action="audio-status"]')).toContainText('siap');
    expect(await page.evaluate(() => window.tracker.getState().audio.positionTick)).toBe(0);
  });

  test('ubah tempo saat playback tetap bermain dan re-anchor pada tick kini', async ({ page }) => {
    await enterOneNote(page);
    await page.getByRole('button', { name: 'Putar' }).click();
    await expect(page.locator('[data-action="audio-status"]')).toContainText('bermain', { timeout: 5000 });
    const before = await page.evaluate(() => window.tracker.getState().audio.scheduleRevision);

    const tempo = page.locator('[data-action="tempo-input"]');
    await tempo.fill('180');
    await tempo.blur();

    const state = await page.evaluate(() => window.tracker.getState().audio);
    expect(state.state).toBe('playing');
    expect(state.tempo).toBe(180);
    expect(state.scheduleRevision).toBeGreaterThan(before);
  });

  test('metronom menjadwalkan click pada audio clock', async ({ page }) => {
    await page.getByRole('button', { name: 'Metronom' }).click();
    await page.getByRole('button', { name: 'Putar' }).click();
    await expect(page.locator('[data-action="audio-status"]')).toContainText('bermain', { timeout: 5000 });

    expect(await page.evaluate(() => window.tracker.getState().audio.clicksScheduled)).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Berhenti' }).click();
    expect(await page.evaluate(() => window.tracker.getState().audio.activeClicks)).toBe(0);
  });
});
